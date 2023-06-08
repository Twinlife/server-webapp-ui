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

import {
	MemberInfo,
	MemberStatus,
	Offer,
	PeerCallService,
	PeerCallServiceObserver,
	TerminateReason,
	TransportCandidate,
} from "../services/PeerCallService";
import { UUID } from "../utils/UUID";
import { Version } from "../utils/Version";
import { CallConnection } from "./CallConnection";
import { CallObserver } from "./CallObserver";
import { CallParticipant } from "./CallParticipant";
import { CallParticipantObserver } from "./CallParticipantObserver";
import { CallState } from "./CallState";
import { CallStatus } from "./CallStatus";
import { ConnectionOperation } from "./ConnectionOperation";

// type Timer = ReturnType<typeof setTimeout>;

/**
 * Audio or video call service.
 *
 * The service manages a P2P audio/video call.  Some important notes:
 *
 * Calls:
 * - The CallService manages two audio/video calls: an active audio/video call represented by mActiveCall and a possible
 * second audio/video call which is on-hold (is it worth to manage several on-hold calls? probably not).
 *
 * Connections:
 * - The CallService maintains a list of active peer connections for the 1-1 call, for 1-N group calls and for 1-1 call
 * with the ability to put a call on hold.  Each connection is represented by a CallConnection.
 * - To prepare to the future, the CallParticipant represents a user that participate in a call. It is separated
 * from the CallConnection to allow different architectures (ex: a same P2P connection that provides different tracks
 * one for each participant).
 *
 * Timers:
 * - the P2P connection timer is specific to each CallConnection so that they are independent from each other
 * - the CallService has a shutdown timer that is fired at the end to terminate the CallService 3s after the last call terminate
 * (see FINISH_TIMEOUT)
 */
export class CallService implements PeerCallServiceObserver {
	static readonly LOG_TAG: string = "CallService";

	static readonly DEBUG: boolean = false;
	static readonly CALL_TIMEOUT: number = 30 * 1000;
	static readonly FINISH_TIMEOUT: number = 3 * 1000;

	private readonly mPeerCallService: PeerCallService;
	private readonly mObserver: CallObserver;
	private mParticipantObserver: CallParticipantObserver | null = null;
	private mAudioMute: boolean = false;
	private mIsCameraMute: boolean = false;
	private mPeers: Map<String, CallConnection> = new Map<any, any>();
	private mPeerTo: Map<String, CallConnection> = new Map<String, CallConnection>();
	private mActiveCall: CallState | null = null;
	private mLocalStream: MediaStream | null = null;
	private mIdentityName: string = "Unknown";
	private mIdentityImage: ArrayBuffer = new ArrayBuffer(0);

	/**
	 * Constructor to build the main CallService and maintain the state of current call with one or
	 * several WebRTC connection and one or several call participant.
	 *
	 * @param peerCallService  the peer call service for the signaling.
	 * @param observer the call observer.
	 */
	constructor(
		peerCallService: PeerCallService,
		observer: CallObserver,
		participantObserver: CallParticipantObserver
	) {
		this.mPeerCallService = peerCallService;
		this.mObserver = observer;
		this.mParticipantObserver = participantObserver;
		peerCallService.setObserver(this);
	}

	setIdentity(identityName: string, identityImage: ArrayBuffer): void {
		this.mIdentityName = identityName;
		this.mIdentityImage = identityImage;
	}

	actionOutgoingCall(twincodeId: string, video: boolean, contactName: string, contactURL: string): void {
		let call: CallState | null = this.mActiveCall;
		if (call && call.getStatus() !== CallStatus.TERMINATED) {
			return;
		}

		call = new CallState(this, this.mPeerCallService, this.mIdentityName, this.mIdentityImage);
		let callStatus: CallStatus = video ? CallStatus.OUTGOING_VIDEO_CALL : CallStatus.OUTGOING_CALL;
		let callConnection: CallConnection = new CallConnection(
			this,
			this.mPeerCallService,
			call,
			null,
			callStatus,
			this.mLocalStream,
			twincodeId,
			null
		);
		this.mActiveCall = call;
		call.addPeerConnection(callConnection);
		callConnection.getMainParticipant()?.setInformation(contactName, "", contactURL);
		this.mPeerTo.set(twincodeId, callConnection);
		this.mObserver.onUpdateCallStatus(callStatus);
	}

	actionTerminateCall(terminateReason: TerminateReason): void {
		let call: CallState | null = this.mActiveCall;
		if (!call) {
			return;
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
		let call: CallState | null = this.mActiveCall;
		if (!call) {
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
		if (!call) {
			return;
		}

		this.mIsCameraMute = cameraMute;
		let connections: Array<CallConnection> = call.getConnections();
		for (let connection of connections) {
			if (!this.mIsCameraMute && !connection.isVideo()) {
				console.log("NEED ACTIVATE CAMERA");
				const track = this.mLocalStream!.getVideoTracks()[0];
				if (track) {
					connection.addVideoTrack(track);
				}
			} else {
				connection.setVideoDirection(this.mIsCameraMute ? "recvonly" : "sendrecv");
			}
		}
	}

	setMediaStream(mediaStream: MediaStream): MediaStream {
		this.mLocalStream = mediaStream;
		return this.mLocalStream;
	}

	addVideoTrack(videoTrack: MediaStreamTrack) {
		if (this.mLocalStream) {
			this.mLocalStream.addTrack(videoTrack);
		}
	}

	hasVideoTrack(): boolean {
		if (this.mLocalStream) {
			return this.mLocalStream.getVideoTracks().length > 0;
		}
		return false;
	}

	/**
	 * Get the list of participants in this audio/video call.
	 *
	 * @return the list of participants are returned.
	 */
	getParticipants(): Array<CallParticipant> {
		let participants: Array<CallParticipant> = [];
		let connections: Array<CallConnection> = this.getConnections();
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
	onIncomingSessionInitiate(sessionId: string, peerId: string, sdp: string, offer: Offer): void {
		console.log("session-initiate received " + sessionId);

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

		let status: CallStatus = offer.video
			? CallStatus.ACCEPTED_INCOMING_VIDEO_CALL
			: CallStatus.ACCEPTED_INCOMING_CALL;
		let callConnection: CallConnection = new CallConnection(
			this,
			this.mPeerCallService,
			call,
			sessionId,
			status,
			this.mLocalStream,
			peerId,
			sdp
		);
		callConnection.setPeerVersion(new Version(offer.version));
		this.mPeers.set(sessionId, callConnection);
		call.addPeerConnection(callConnection);
	}

	onSessionInitiate(to: string, sessionId: string): void {
		console.log("session-initiate created " + sessionId);

		let callConnection: CallConnection | undefined = this.mPeerTo.get(to);
		if (callConnection) {
			callConnection.onSessionInitiate(sessionId);
			this.mPeers.set(sessionId, callConnection);
			console.log("Peer added, mPeers items: " + this.mPeers.size);
		}
	}

	onSessionAccept(sessionId: string, sdp: string, offer: Offer, offerToReceive: Offer): void {
		console.log("P2P " + sessionId + " is accepted for " + offer);

		const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection || !callConnection.onSessionAccept(sdp, offer, offerToReceive)) {
			this.mPeerCallService.sessionTerminate(sessionId, "gone");
		}
	}

	onSessionUpdate(sessionId: string, updateType: string, sdp: string): void {
		console.log("P2P " + sessionId + "update " + updateType);

		const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection || !callConnection.onSessionUpdate(updateType, sdp)) {
			this.mPeerCallService.sessionTerminate(sessionId, "gone");
		}
	}

	onTransportInfo(sessionId: string, candidates: TransportCandidate[]): void {
		// console.log("transport-info " + sessionId + " candidates: " + candidates);

		const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection || !callConnection?.onTransportInfo(candidates)) {
			this.mPeerCallService.sessionTerminate(sessionId, "gone");
			return;
		}
	}

	onSessionTerminate(sessionId: string, reason: TerminateReason): void {
		console.log("session " + sessionId + " terminated with " + reason);

		const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
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
			let callConnection: CallConnection = new CallConnection(
				this,
				this.mPeerCallService,
				this.mActiveCall,
				null,
				mode,
				this.mLocalStream,
				peerId,
				null
			);
			this.mActiveCall.addPeerConnection(callConnection);
			this.mPeerTo.set(peerId, callConnection);
		}
	}

	onMemberJoin(sessionId: string | null, memberId: string, status: MemberStatus): void {
		console.log("Member join sessionId: " + sessionId + " memberId: " + memberId + " status: " + status);
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
		let sessionId: string | null = callConnection.getPeerConnectionId();
		if (sessionId) {
			console.log("Remove peer session " + sessionId);
			this.mPeers.delete(sessionId);
		}
		if (!call.remove(callConnection)) {
			return;
		}

		if (this.mLocalStream) {
			for (const track of this.mLocalStream.getTracks()) {
				track.stop();
				this.mLocalStream.removeTrack(track);
			}
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
		return Array.from(this.mPeers.values());
	}

	callTimeout(callConnection: CallConnection): void {
		callConnection.terminate("expired");
		this.onTerminatePeerConnection(callConnection, "expired");
	}
}
