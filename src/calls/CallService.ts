/*
 *  Copyright (c) 2019-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 */

import { UUID } from "../utils/UUID";
import { CallConnection } from "./CallConnection";
import { CallParticipant } from "./CallParticipant";
import { CallParticipantObserver } from "./CallParticipantObserver";
import { CallState } from "./CallState";
import { CallStatus } from "./CallStatus";
import { CallObserver } from "./CallObserver";
import { PeerCallService, PeerCallServiceObserver, TransportCandidate, Offer, MemberInfo, TerminateReason } from '../services/PeerCallService';
import { ConnectionOperation } from "./ConnectionOperation";
import { Version } from "../utils/Version";

type Timer = ReturnType<typeof setTimeout>;

/**
 * Audio or video call foreground service.
 *
 * The service manages a P2P audio/video call and it runs as a foreground service.  It is associated with a notification
 * that allows to control the audio/video call.  Some important notes:
 *
 * Calls:
 * - The CallService manages two audio/video calls: an active audio/video call represented by mActiveCall and a possible
 * second audio/video call which is on-hold (is it worth to manage several on-hold calls? probably not).
 * - When an incoming call is received which we are already in a call, a mHoldCall is created (it is not accepted).
 * - The holding call can be accepted in which case it becomes active and the active call is put on-hold.
 * - If the active call terminates, the mHoldCall becomes active.
 *
 * Connections:
 * - The CallService maintains a list of active peer connections for the 1-1 call, for 1-N group calls and for 1-1 call
 * with the ability to put a call on hold.  Each connection is represented by a CallConnection.
 * - To prepare to the future, the CallParticipant represents a user that participate in a call. It is separated
 * from the CallConnection to allow different architectures (ex: a same P2P connection that provides different tracks
 * one for each participant).
 *
 * Videos:
 * - The video EGL context is created only when the video call is accepted for an incoming call, or when we start the outgoing video call.
 * This is done by 'setupVideo()' which must be called from the main UI thread only.
 * - The video SurfaceView(s) are allocated by the CallService and the VideoCallActivity retrieves them through static methods.
 * They cannot be passed to Intent.  SurfaceView(s) are associated with CallParticipant.
 *
 * Notifications:
 * - When an audio/video call wakes up the application, the Firebase message starts the CallService but we don't know the
 * contact yet.  We MUST create a notification and associate it with the service.  The CallService will trigger the Twinlife
 * service initialization through the JobService.  This is handled by onActionIncomingNotification().
 * - The audio/video incoming call can also be started without Firebase.  In that case, onActionIncomingCall() is invoked and
 * we know the contact.  We also create a notification and associate it with the service.  We have to be careful that
 * onActionIncomingNotifcation() will ALSO be called.
 * - We must call the Service.startForeground() several times because some call will be ignored by Android 10 and 11 when the
 * application is in background.  Only the call made as a result of Firebase message will allow us to start the CallService
 * as a foreground service.
 * - The CallService is now started from the main thread to limit the risks of not calling the startForground()
 * within the 5 seconds constraints.
 * - For an incoming call, we use a first notification ID either CALL_SERVICE_INCOMING_AUDIO_NOTIFICATION_ID or
 * CALL_SERVICE_INCOMING_VIDEO_NOTIFICATION_ID and when the call is accepted we switch to a second notification ID
 * CALL_SERVICE_INCALL_NOTIFICATION_ID.  This is necessary on Android 12 because the notification content is not updated.
 *
 * Executors & timers:
 * - a dedicated executor thread is used to perform some possibly blocking tasks such as some media player operations
 * - the P2P connection timer is specific to each CallConnection so that they are independent from each other
 * - the CallService has a shutdown timer that is fired at the end to terminate the CallService 3s after the last call terminate
 * (see FINISH_TIMEOUT)
 * @class
 * @extends Service
 */
export class CallService implements PeerCallServiceObserver {
	static LOG_TAG: string = "CallService";

	static DEBUG: boolean = false;

	static CALL_TIMEOUT: number = 30;

	static FINISH_TIMEOUT: number = 3;

	private readonly mPeerCallService : PeerCallService;
	private readonly mObserver: CallObserver;
	private mParticipantObserver: CallParticipantObserver | null = null;
	private mShutdownTimer: Timer | null = null;
	private mAudioMute: boolean = false;
	private mIsCameraMute: boolean = false;
	private mPeers: Map<String, CallConnection> = new Map<any, any>();
	private mPeerTo: Map<String, CallConnection> = new Map<String, CallConnection>();
	private mActiveCall: CallState | null = null;
	private mLocalStream: MediaStream | null = null;

	/**
	 * Constructor to build the main CallService and maintain the state of current call with one or
	 * several WebRTC connection and one or several call participant.
	 *
	 * @param peerCallService  the peer call service for the signaling.
	 * @param observer the call observer.
	 */
	constructor(peerCallService: PeerCallService, observer: CallObserver, participantObserver: CallParticipantObserver) {
		this.mPeerCallService = peerCallService;
		this.mObserver = observer;
		this.mParticipantObserver = participantObserver;
		peerCallService.setObserver(this);
	}

	actionOutgoingCall(twincodeId: string, video: boolean, identityName: string, identityImage: ArrayBuffer): void {

		let call: CallState | null = this.getActiveCall();
		if (call != null && call.getStatus() !== CallStatus.TERMINATED) {
			return;
		}
		if (this.mShutdownTimer) {
			clearTimeout(this.mShutdownTimer);
			this.mShutdownTimer = null;
		}
		call = new CallState(this, this.mPeerCallService, identityName, identityImage);
		let callStatus: CallStatus = video ? CallStatus.OUTGOING_VIDEO_CALL : CallStatus.OUTGOING_CALL;
		let callConnection: CallConnection = new CallConnection(this,
			this.mPeerCallService,
			call,
			null,
			callStatus,
			this.mLocalStream,
			twincodeId
		);
		this.mActiveCall = call;
		call.addPeerConnection(callConnection);
		this.mPeerTo.set(twincodeId, callConnection);
	}

	actionTerminateCall(terminateReason: TerminateReason): void {

		let call: CallState | null = this.getActiveCall();
		if (!call) {
			return;
		}

		if (call.getCallRoomId() != null) {
			call.leaveCallRoom();
		}

		let connections: Array<CallConnection> = call.getConnections();
		for (let callConnection of connections) {
			if (callConnection.getStatus() !== CallStatus.TERMINATED) {
				callConnection.terminate(terminateReason);
				this.onTerminatePeerConnection(callConnection, terminateReason);
			}
		}
	}

	actionAudioMute(audioMute: boolean): void {

		let call: CallState | null = this.getActiveCall();
		if (call == null) {
			return;
		}

		this.mAudioMute = audioMute;
		let connections: Array<CallConnection> = call.getConnections();
		for (let callConnection of connections) {
			callConnection.setAudioDirection(this.mAudioMute ? "recvonly" : "sendrecv");
		}
	}

	actionCameraMute(cameraMute: boolean): void {

		let call: CallState | null = this.mActiveCall;
		if (call == null) {
			return;
		}

		this.mIsCameraMute = cameraMute;
		let connections: Array<CallConnection> = call.getConnections();
		for (let connection of connections) {
			if (!this.mIsCameraMute && !connection.isVideo()) {
				// this.setupVideo(connection.getMainParticipant());
				// connection.initSources(CallStatus_$WRAPPER.toVideo(connection.getStatus()));
			}
			connection.setVideoDirection(this.mIsCameraMute ? "recvonly" : "sendrecv");
		}
	}

	setMediaStream(mediaStream: MediaStream): void {

		this.mLocalStream = mediaStream;
	}

	/**
	 * Get the list of participants in this P2P connection.
	 *
	 * @return the list of participants are returned.
	 */
	getParticipants() : Array<CallParticipant> {

		let participants : Array<CallParticipant> = [];
		let connections : Array<CallConnection> = this.getConnections();
		for (let callConnection of connections) {
			callConnection.getParticipants(participants);
		}
		return participants;
	}

	getParticipantObserver(): CallParticipantObserver | null {
		return this.mParticipantObserver;
	}

	/**
	 * IQs received from the proxy server.
	 */
    onIncomingSessionInitiate(sessionId: string, peerId: string, offer: Offer) : void {
		console.log("session-initiate created " + sessionId);

		let call: CallState | null = this.mActiveCall;
		let pos: number = peerId.indexOf("@");
		if (!call || pos < 0) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}

		let domain: string = peerId.substring(pos + 1);
		pos = domain.indexOf(".");
		if (pos < 0 || !domain.substring(pos).startsWith(".callroom.")) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}
		let callRoomId: UUID = UUID.fromString(domain.substring(0, pos));
		if (callRoomId == null) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}
		if (!callRoomId.equals(call.getCallRoomId())) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}

		let status: CallStatus = offer.video ? CallStatus.ACCEPTED_INCOMING_VIDEO_CALL : CallStatus.ACCEPTED_INCOMING_CALL;
		let callConnection : CallConnection = new CallConnection(this,
				this.mPeerCallService,
				call,
				UUID.fromString(sessionId),
				status,
				this.mLocalStream,
				peerId
			);
		callConnection.setPeerVersion(new Version(offer.version));
		this.mPeers.set(sessionId, callConnection);
		call.addPeerConnection(callConnection);
	}

	onSessionInitiate(to: string, sessionId: string) : void {
        console.log("session-initiate created " + sessionId);

		let callConnection : CallConnection | undefined = this.mPeerTo.get(to);
		if (callConnection) {
			callConnection.onSessionInitiate(sessionId);
			this.mPeers.set(sessionId, callConnection);
			console.log("Peer added, mPeers items: " + this.mPeers.size);
		}
	}

    onSessionAccept(sessionId: string, sdp: string, offer: Offer, offerToReceive: Offer) : void {
        console.log("P2P " + sessionId + " is accepted for " + offer);

		const callConnection : CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection || !callConnection.onSessionAccept(sdp, offer, offerToReceive)) {
			this.mPeerCallService.sessionTerminate(sessionId, "gone");
		}
    }

    onSessionUpdate(sessionId: string, updateType: string, sdp: string) : void {
        console.log("P2P " + sessionId + "update " + updateType);

		const callConnection : CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection || !callConnection.onSessionUpdate(updateType, sdp)) {
            this.mPeerCallService.sessionTerminate(sessionId, "gone");
		}
    }

    onTransportInfo(sessionId: string, candidates: TransportCandidate[]) : void {
        // console.log("transport-info " + sessionId + " candidates: " + candidates);

		const callConnection : CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection || !callConnection?.onTransportInfo(candidates)) {
            this.mPeerCallService.sessionTerminate(sessionId, "gone");
            return;
        }
    }

    onSessionTerminate(sessionId: string, reason: TerminateReason): void {

        console.log("session " + sessionId + " terminated with " + reason);

		const callConnection : CallConnection | undefined = this.mPeers.get(sessionId);
		if (callConnection) {
			this.onTerminatePeerConnection(callConnection, reason);
        }
    }

	onJoinCallRoom(callRoomId: string, memberId: string, members: MemberInfo[]): void {

		if (!this.mActiveCall) {
			return;
		}

		let video: boolean = this.mActiveCall.isVideo();
		let mode: CallStatus = video ? CallStatus.OUTGOING_VIDEO_CALL : CallStatus.OUTGOING_CALL;
		this.mActiveCall.updateCallRoom(callRoomId, memberId);
		for (let member of members) {
			if (member.status !== "member-need-session" && member.sessionId) {
				let callConnection: CallConnection | undefined = this.mPeers.get(member.sessionId);
				if (callConnection) {
					callConnection.setCallMemberId(member.memberId);
					callConnection.checkOperation(ConnectionOperation.INVITE_CALL_ROOM);
				}
				continue;
			}
			let peerId: string = member.memberId;
			let callConnection: CallConnection = new CallConnection(this,
				this.mPeerCallService,
				this.mActiveCall,
				null,
				mode,
				this.mLocalStream,
				peerId
			);
			this.mActiveCall.addPeerConnection(callConnection);
		}
	}

	onInviteCallRoom(callRoomId: string, sessionId: string, maxCount: number): void {

		if (sessionId && this.mPeerCallService) {
			let connection: CallConnection | undefined = this.mPeers.get(sessionId);
			if (connection) {
				this.mPeerCallService.joinCallRoom(callRoomId, sessionId);
			}
		}
	}

	onChangeConnectionState(callConnection: CallConnection, state: RTCIceConnectionState): void {

		let call: CallState = callConnection.getCall();
		let status: CallState.UpdateState = call.updateConnectionState(callConnection, state);
		if (status === CallState.UpdateState.FIRST_CONNECTION) {
			// this.stopRingtone();

		} else if (status === CallState.UpdateState.FIRST_GROUP) {
			// this.stopRingtone();

		} else if (status === CallState.UpdateState.NEW_CONNECTION && callConnection.getCallMemberId() == null) {
			// this.stopRingtone();
		}
		console.log("Connection state=" + state);
		this.mObserver.onUpdateCallStatus(call.getStatus());
	}

	onTerminatePeerConnection(callConnection: CallConnection, terminateReason: TerminateReason): void {

		let call: CallState = callConnection.getCall();
		let sessionId: UUID | null = callConnection.getPeerConnectionId();
		if (sessionId) {
			console.log("Remove peer session " + sessionId.toString());
			this.mPeers.delete(sessionId.toString());
		}
		if (!call.remove(callConnection, terminateReason)) {
			return;
		}

		this.mObserver.onTerminateCall(terminateReason);
		this.mActiveCall = null;
	}

	/**
	 * Get the list of connections.
	 *
	 * @return {CallConnection[]} the current frozen list of connections.
	 * @private
	 */
	getConnections(): Array<CallConnection> {

		return this.mPeers.values() as any;
	}

	/**
	 * Get the current active audio/video call.
	 *
	 * @return {CallState} the active audio/video call.
	 * @private
	 */
	getActiveCall(): CallState | null {

		return this.mActiveCall;
	}

	getMode(): CallStatus | null {
		let call: CallState | null = this.getActiveCall();
		let callConnection: CallConnection | null = call != null ? call.getCurrentConnection() : null;
		return callConnection != null ? callConnection.getStatus() : null;
	}

	setupVideo(participant: CallParticipant): void {

		if (participant == null) {
			return;
		}
		//if (!participant.setupVideo(this, this.mLocalRenderer)) {
		//	this.sendError(ErrorType.CAMERA_ERROR);
		//}
	}

	callTimeout(callConnection: CallConnection): void {

		callConnection.terminate("expired");
		this.onTerminatePeerConnection(callConnection, "expired");
	}
}
