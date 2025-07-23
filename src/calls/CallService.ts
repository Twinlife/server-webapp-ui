/*
 *  Copyright (c) 2019-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
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
import { WakelockHandler } from "../utils/WakelockHandler.ts";
import { CallConnection } from "./CallConnection";
import { CallObserver } from "./CallObserver";
import { CallParticipant } from "./CallParticipant";
import { CallParticipantObserver } from "./CallParticipantObserver";
import { CallState } from "./CallState";
import { CallStatus, CallStatusOps } from "./CallStatus";
import { ConnectionOperation } from "./ConnectionOperation";
import { ConversationService } from "./ConversationService";
import TransferDirection = CallState.TransferDirection;

// type Timer = ReturnType<typeof setTimeout>;
const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

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
	static readonly CALL_TIMEOUT: number = 30 * 1000;
	static readonly FINISH_TIMEOUT: number = 5 * 1000;

	private readonly mPeerCallService: PeerCallService;
	private readonly mObserver: CallObserver;
	private mParticipantObserver: CallParticipantObserver | null = null;
	private mAudioMute: boolean = false;
	private mIsCameraMute: boolean = false;
	private readonly mPeers: Map<string, CallConnection> = new Map<string, CallConnection>();
	private readonly mPeerTo: Map<string, CallConnection> = new Map<string, CallConnection>();
	private mActiveCall: CallState | null = null;
	private readonly mLocalStream: MediaStream = new MediaStream();
	private mIdentityName: string = "Unknown";
	private mIdentityImage: ArrayBuffer = new ArrayBuffer(0);
	private wakeLock: WakelockHandler | null = null;
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
		participantObserver: CallParticipantObserver,
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

	updateIdentity(identityName: string, identityImage: ArrayBuffer): void {
		this.mIdentityName = identityName;
		this.mIdentityImage = identityImage;
		const call: CallState | null = this.mActiveCall;
		if (call) {
			call.updateIdentity(identityName, identityImage);
		}
	}

	actionOutgoingCall(
		twincodeId: string,
		video: boolean,
		transfer: boolean,
		contactName: string,
		contactURL: string,
	): void {
		const activeCall: CallState | null = this.mActiveCall;
		if (activeCall && activeCall.getStatus() !== CallStatus.TERMINATED) {
			return;
		}

		console.info("Calling", twincodeId);
		const call = new CallState(this, this.mPeerCallService, this.mIdentityName, this.mIdentityImage, transfer);
		const callStatus: CallStatus = video ? CallStatus.OUTGOING_VIDEO_CALL : CallStatus.OUTGOING_CALL;
		this.mActiveCall = call;
		this.mIsCameraMute = !video;
		// Start the CallConnection once the peer call service is ready.
		this.mPeerCallService.onReady(() => {
			const callConnection: CallConnection = new CallConnection(
				this,
				this.mPeerCallService,
				call,
				null,
				callStatus,
				this.mLocalStream,
				twincodeId,
				null,
				this.getAudioDirection(),
				transfer,
			);
			call.addPeerConnection(callConnection);
			callConnection.getMainParticipant()?.setInformation(contactName, "", contactURL);
			if (transfer) {
				call.transferDirection = TransferDirection.TO_BROWSER;
				call.transferToConnection = callConnection;
			}
			this.mPeerTo.set(twincodeId, callConnection);

			this.wakeLock = new WakelockHandler();
			this.wakeLock.acquire();
		});

		this.mObserver.onUpdateCallStatus(callStatus);
	}

	actionAddCallParticipant(twincodeId: string, transfer: boolean, contactName: string, contactURL: string): void {
		if (!this.mActiveCall) {
			return;
		}

		const call = this.mActiveCall;
		if (!CallStatusOps.isActive(call.getStatus())) {
			console.error("actionAddCallParticipant call status invalid, call=");
			console.error(call);
			return;
		}

		const callStatus = this.mIsCameraMute ? CallStatus.OUTGOING_CALL : CallStatus.OUTGOING_VIDEO_CALL;
		const callConnection: CallConnection = new CallConnection(
			this,
			this.mPeerCallService,
			call,
			null,
			callStatus,
			this.mLocalStream,
			twincodeId,
			null,
			this.getAudioDirection(),
			transfer,
		);

		call.addPeerConnection(callConnection);
		callConnection.getMainParticipant()?.setInformation(contactName, "", contactURL);
		if (transfer) {
			call.transferDirection = TransferDirection.TO_DEVICE;
			call.transferToConnection = callConnection;
		}
		this.mPeerTo.set(twincodeId, callConnection);
		this.mObserver.onUpdateCallStatus(callStatus);
	}

	actionTerminateCall(terminateReason: TerminateReason): void {
		const call: CallState | null = this.mActiveCall;
		if (!call) {
			return;
		}

		call.terminateCall(terminateReason);
	}

	actionAudioMute(audioMute: boolean): void {
		console.info("User audio mute", audioMute);

		this.mAudioMute = audioMute;
		const call: CallState | null = this.mActiveCall;
		if (!call) {
			return;
		}

		call.setAudioDirection(this.getAudioDirection());
	}

	actionCameraMute(cameraMute: boolean): void {
		console.info("User camera mute", cameraMute);

		const call: CallState | null = this.mActiveCall;
		const videoTracks: MediaStreamTrack[] = this.mLocalStream.getVideoTracks();
		this.mIsCameraMute = cameraMute;
		if (videoTracks.length === 0) {
			return;
		}
		const track = videoTracks[0];
		if (track) {
			// Release the camera and stop the track before removing it.
			if (cameraMute) {
				track.stop();
				this.mLocalStream.removeTrack(track);
			}

			if (call) {
				call.setVideoTrack(cameraMute ? null : track, false, true);
			}
		}
	}

	/**
	 * Send a message to each peer connected with us.
	 *
	 * @param message the message to send.
	 * @param copyAllowed true if the message can be copied.
	 * @returns the descriptor that was sent.
	 */
	pushMessage(message: string, copyAllowed: boolean): ConversationService.MessageDescriptor | null {
		const call: CallState | null = this.mActiveCall;
		if (!call) {
			return null;
		}
		return call.pushMessage(message, copyAllowed);
	}

	getMediaStream(): MediaStream {
		return this.mLocalStream;
	}

	addOrReplaceAudioTrack(audioTrack: MediaStreamTrack) {
		console.info("Replace audio track with ", audioTrack.label);

		if (this.hasAudioTrack()) {
			// Replace track
			const currentTrack = this.mLocalStream.getAudioTracks()[0];
			currentTrack.stop();
			this.mLocalStream.removeTrack(currentTrack);
			const call = this.mActiveCall;
			if (call) {
				call.setAudioTrack(audioTrack);
			}
		}
		this.mLocalStream.addTrack(audioTrack);
	}

	/**
	 * Stop the video track to release the camera.
	 */
	stopVideoTrack() {
		if (this.mLocalStream) {
			this.mLocalStream.getVideoTracks().forEach((track) => {
				track.stop();
			});
		}
	}

	addOrReplaceVideoTrack(mediaStream: MediaStream | MediaStreamTrack, isScreenSharing: boolean): MediaStreamTrack {
		const tracks: MediaStreamTrack[] = this.mLocalStream.getVideoTracks();
		let videoTrack;
		if (mediaStream instanceof MediaStreamTrack) {
			videoTrack = mediaStream;
		} else {
			videoTrack = mediaStream.getVideoTracks()[0];
		}

		const call = this.mActiveCall;
		if (tracks.length > 0) {
			// Replace track
			const currentTrack = tracks[0];
			currentTrack.stop();
			this.mLocalStream.removeTrack(currentTrack);
			if (call) {
				call.setVideoTrack(videoTrack, isScreenSharing, true);
			}
		} else if (call && CallStatusOps.isActive(call.getStatus())) {
			call.setVideoTrack(videoTrack, isScreenSharing, false);
		}
		this.mLocalStream.addTrack(videoTrack);
		return videoTrack;
	}

	hasAudioTrack(): boolean {
		return this.mLocalStream.getAudioTracks().length > 0;
	}

	hasVideoTrack(): boolean {
		return this.mLocalStream.getVideoTracks().length > 0;
	}

	isAudioSourceOn(): boolean {
		return !this.mAudioMute;
	}

	isVideoSourceOn(): boolean {
		return !this.mIsCameraMute;
	}

	/**
	 * Get the list of participants in this audio/video call.
	 *
	 * @return the list of participants are returned.
	 */
	getParticipants(): Array<CallParticipant> {
		if (this.mActiveCall) {
			return this.mActiveCall.getParticipants();
		} else {
			return [];
		}
	}

	getParticipantObserver(): CallParticipantObserver | null {
		return this.mParticipantObserver;
	}

	/**
	 * IQs received from the proxy server.
	 */
	onIncomingSessionInitiate(sessionId: string, peerId: string, sdp: string, offer: Offer): void {
		console.info(sessionId, ": incoming session-initiate");

		const call: CallState | null = this.mActiveCall;
		let pos: number = peerId.indexOf("@");
		if (!call || pos < 0) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}

		const domain: string = peerId.substring(pos + 1);
		pos = domain.indexOf(".");
		if (pos < 0 || !domain.substring(pos).startsWith(".callroom.")) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}
		const callRoomId: UUID = UUID.fromString(domain.substring(0, pos));
		if (callRoomId == null) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}
		if (!callRoomId.equals(call.getCallRoomId())) {
			this.mPeerCallService.sessionTerminate(sessionId, "not-authorized");
			return;
		}

		const status: CallStatus = offer.video
			? CallStatus.ACCEPTED_INCOMING_VIDEO_CALL
			: CallStatus.ACCEPTED_INCOMING_CALL;
		const callConnection: CallConnection = new CallConnection(
			this,
			this.mPeerCallService,
			call,
			sessionId,
			status,
			this.mLocalStream,
			peerId,
			sdp,
			this.getAudioDirection(),
		);
		callConnection.setPeerVersion(new Version(offer.version));
		this.mPeers.set(sessionId, callConnection);
		call.addPeerConnection(callConnection);
	}

	onSessionInitiate(to: string, sessionId: string): void {
		if (DEBUG) {
			console.log(sessionId, ": received session-initiate creation response");
		}

		const callConnection: CallConnection | undefined = this.mPeerTo.get(to);
		if (callConnection) {
			callConnection.onSessionInitiate(sessionId);
			this.mPeers.set(sessionId, callConnection);
			if (DEBUG) {
				console.log(sessionId, ": peer added, mPeers items: ", this.mPeers.size);
			}
		}
	}

	onSessionAccept(sessionId: string, sdp: string, offer: Offer, offerToReceive: Offer): void {
		console.info(sessionId, ": is accepted with:", offer);

		const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection?.onSessionAccept(sdp, offer, offerToReceive)) {
			this.mPeerCallService.sessionTerminate(sessionId, "gone");
			return;
		}

		const call = callConnection.getCall();

		if (call.transferFromConnection) {
			// We've received a PrepareTransferIQ from the transferred participant
			// => this new incoming connection is likely from the transfer target
			// (but it could also be a new group member joining at the same time)
			if (!call.transferToMemberId) {
				// We haven't received the ParticipantTransferIQ yet,
				// so we don't know which new member is the transfer target.
				// Wait for the IQ before doing anything with the new connection.
				call.addPendingCallRoomConnection(sessionId, callConnection);
				return;
			} else if (call.transferToMemberId === callConnection.getCallMemberId()) {
				// We've received a ParticipantTransferIQ from the transferred participant,
				// and this is the transfer target's connection => perform the transfer
				call.performTransfer(callConnection.getMainParticipant());
			}
		}

		if (call.transfer) {
			switch (call.transferDirection) {
				case TransferDirection.TO_BROWSER:
					if (call.getCurrentConnection()?.getPeerConnectionId() == sessionId) {
						// We're transferring the call to this browser and we're connected to the transferred device =>
						// copy the audio/video setting from the device as we want the browser to be in the same mode as the device.
						this.mObserver.onOverrideAudioVideo(offer.audio, offer.video);
					}
					break;
				case TransferDirection.TO_DEVICE:
					call.prepareTransfer(sessionId);
					break;
			}
		}
	}

	async onSessionUpdate(sessionId: string, updateType: string, sdp: string): Promise<void> {
		console.info(sessionId, ": update", updateType);

		const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
		const result = (await callConnection?.onSessionUpdate(updateType, sdp)) ?? false;
		if (!result) {
			this.mPeerCallService.sessionTerminate(sessionId, "gone");
		}
	}

	onTransportInfo(sessionId: string, candidates: TransportCandidate[]): void {
		// console.log("transport-info " + sessionId + " candidates: " + candidates);

		const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
		if (!callConnection?.onTransportInfo(candidates)) {
			this.mPeerCallService.sessionTerminate(sessionId, "gone");
			return;
		}
	}

	onSessionTerminate(sessionId: string | null, reason: TerminateReason): void {
		console.info(sessionId, ": terminated by peer with ", reason);

		if (sessionId) {
			const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
			if (callConnection) {
				this.onTerminatePeerConnection(sessionId, callConnection, reason);
			}
		} else {
			this.terminateCall(reason);
		}
	}

	onJoinCallRoom(callRoomId: string, memberId: string, members: MemberInfo[]): void {
		console.info("join call room", callRoomId, "as", memberId);

		if (!this.mActiveCall) {
			return;
		}

		const mode: CallStatus = this.mIsCameraMute ? CallStatus.OUTGOING_CALL : CallStatus.OUTGOING_VIDEO_CALL;
		this.mActiveCall.updateCallRoom(callRoomId, memberId);
		for (const member of members) {
			if (member.status !== "member-need-session" && member.sessionId) {
				const callConnection: CallConnection | undefined = this.mPeers.get(member.sessionId);
				if (callConnection) {
					callConnection.setCallMemberId(member.memberId);
					callConnection.checkOperation(ConnectionOperation.INVITE_CALL_ROOM);
				}
				continue;
			}
			const peerId: string = member.memberId;
			const callConnection: CallConnection = new CallConnection(
				this,
				this.mPeerCallService,
				this.mActiveCall,
				null,
				mode,
				this.mLocalStream,
				peerId,
				null,
				this.getAudioDirection(),
			);
			this.mActiveCall.addPeerConnection(callConnection);
			this.mPeerTo.set(peerId, callConnection);
		}
	}

	onMemberJoin(sessionId: string | null, memberId: string, status: MemberStatus): void {
		if (sessionId == null || memberId == null) {
			return;
		}
		console.info(sessionId, ": member join memberId: ", memberId, " status: ", status);

		const callConnection = this.mPeers.get(sessionId);

		if (!callConnection) {
			console.warn(sessionId, ": connection not found");
			return;
		}

		if (
			callConnection.getMainParticipant()?.transfer &&
			callConnection.getCall().transferDirection === TransferDirection.TO_DEVICE
		) {
			// We're transferring our call, and the transfer target has joined the call room.
			// Tell the other participants that they need to transfer us.
			for (const connection of this.mPeers.values()) {
				if (connection.getPeerConnectionId() && connection.getPeerConnectionId() !== sessionId) {
					connection.sendParticipantTransferIQ(memberId);
				}
			}
		}
	}

	onServerClose(): void {
		console.warn("server connection is closed");

		// Connection to the proxy server was closed:
		// - we could report some non-fatal error message if we have some connection,
		//   the existing connected WebRTC P2P connection can continue to work but as soon
		//   as we loose the proxy server connection, it will automatically close the existing
		//   P2P connection hence disconnecting us from our peers.
		// - if we re-connect to the server, we will be seen as a new client and all existing
		//   P2P connection are closed.
		// To be improved by keeping some state on our side and giving some information to
		// the proxy so that it 1/ trust us and 2/ avoid close/resurect the P2P connections.
		this.actionTerminateCall("disconnected");
	}

	onDeviceRinging(sessionId: string | null) {
		if (sessionId == null) {
			return;
		}

		console.info(sessionId, ": device-ringing");

		const callConnection = this.mPeers.get(sessionId);
		callConnection?.setDeviceRinging();
	}

	onChangeConnectionState(callConnection: CallConnection, state: RTCIceConnectionState): void {
		const call: CallState = callConnection.getCall();
		const status: CallState.UpdateState = call.updateConnectionState(callConnection, state);
		if (status === CallState.UpdateState.FIRST_CONNECTION) {
			// this.stopRingtone();
		} else if (status === CallState.UpdateState.FIRST_GROUP) {
			// this.stopRingtone();
		} else if (status === CallState.UpdateState.NEW_CONNECTION && callConnection.getCallMemberId() == null) {
			// this.stopRingtone();
		}

		if (
			(state === "connected" || state === "completed") &&
			call.getMainParticipant()?.transfer &&
			call.transferDirection === TransferDirection.TO_BROWSER &&
			call.getCurrentConnection()?.getPeerConnectionId() !== callConnection.getPeerConnectionId()
		) {
			// We're transferring the call to this browser
			// and we're connected with the other participant =>
			// Tell the transferred device that the transfer is done so that it disconnects
			// TODO handle group calls (i.e. wait for all connections to be accepted)
			call.getCurrentConnection()?.sendTransferDoneIQ();
		}

		if (DEBUG) {
			console.log("Connection state=", state);
		}
		this.mObserver.onUpdateCallStatus(call.getStatus());
	}

	onTerminatePeerConnection(
		sessionId: string | null,
		callConnection: CallConnection,
		terminateReason: TerminateReason,
	): void {
		const call: CallState = callConnection.getCall();
		if (sessionId) {
			if (DEBUG) {
				console.log(sessionId, ": remove peer session");
			}
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

		this.terminateCall(terminateReason);
	}

	onOnPrepareTransfer(callConnection: CallConnection): void {
		const call = callConnection.getCall();
		const peerConnectionId = callConnection.getPeerConnectionId();

		if (!peerConnectionId) {
			if (DEBUG) {
				console.error("onOnPrepareTransfer: no peerConnectionId for CallConnection:", callConnection);
			}
			return;
		}

		console.info(peerConnectionId, ": onOnPrepareTransfer");
		call.removePendingPrepareTransfer(peerConnectionId);

		if (!call.hasPendingPrepareTransfer()) {
			if (!call.transferToConnection) {
				console.error("onOnPrepareTransfer: call.transferToConnection not set, aborting transfer");
				return;
			}

			call.transferToConnection.inviteCallRoom();
		}
	}

	onTransferDone(_callConnection: CallConnection) {
		this.actionTerminateCall("transfer-done");
	}

	/**
	 * Check whether we have an active call and the websocket to the server proxy is necessary.
	 *
	 * @returns true if a call is active (connected or not) and we need the server connection.
	 */
	public needConnection(): boolean {
		return this.mActiveCall ? this.mActiveCall.getStatus() !== CallStatus.TERMINATED : false;
	}

	callTimeout(callConnection: CallConnection): void {
		const sessionId: string | null = callConnection.terminate("expired");
		this.onTerminatePeerConnection(sessionId, callConnection, "expired");
	}

	/**
	 * Call is terminated, notify the observer, cleanup and release the screen lock.
	 *
	 * @param terminateReason the terminate reason
	 */
	private terminateCall(terminateReason: TerminateReason): void {
		console.info("call terminated with", terminateReason);
		this.mObserver.onTerminateCall(terminateReason);
		this.mActiveCall = null;

		if (this.wakeLock !== null) {
			this.wakeLock.release();
			this.wakeLock = null;
		}
	}

	private getAudioDirection(): RTCRtpTransceiverDirection {
		return this.mAudioMute ? "recvonly" : "sendrecv";
	}
}
