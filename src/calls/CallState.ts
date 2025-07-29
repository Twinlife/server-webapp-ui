/*
 *  Copyright (c) 2022-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
import { PeerCallService, TerminateReason } from "../services/PeerCallService";
import { UUID } from "../utils/UUID";
import { CallConnection } from "./CallConnection";
import { CallParticipant } from "./CallParticipant";
import { CallParticipantEvent } from "./CallParticipantEvent";
import { CallParticipantObserver } from "./CallParticipantObserver";
import { CallService } from "./CallService";
import { CallStatus, CallStatusOps } from "./CallStatus";
import { ConversationService } from "./ConversationService";
import { PushObjectIQ } from "./PushObjectIQ.ts";

/**
 * The call state associated with an Audio or Video call:
 *
 * - the audio/video call can have one or several P2P connections (P2P group call)
 * - it can have one or several participants (group call)
 *
 * Each P2P connection and participant are maintained separately:
 *
 * - we could have a 1-1 mapping between P2P connection and Participant
 * - we could have a 1-N mapping when the P2P connection is using an SFU as the peer
 * and we can get several participant for the same P2P connection.
 *
 * When the call is a group call, we have:
 *
 * - a call room identifier,
 * - a member identifier that identifies us within the call room,
 * - the call room configuration (max number of participants, call room options),
 * - a list of member identifiers that participate in the call room (each identifier is a String).
 *
 */
export class CallState {
	private readonly mCallService: CallService;
	private readonly mPeerCallService: PeerCallService;
	private mIdentityAvatar: ArrayBuffer;
	private mIdentityName: string;
	private readonly mSenderId: UUID;
	private mPeers: Array<CallConnection> = [];
	private mLocalRenderer: unknown = null;
	private mConnectionStartTime: number = 0;
	private mPeerConnected: boolean = false;
	private mCallRoomId: UUID | null = null;
	private mCallRoomMemberId: string | null = null;
	private mMaxMemberCount: number = 0;
	private mState: number = 0;
	private mParticipantCounter: number = 1; // Start at 1 and use 0 for ourselves.
	private mRequestCounter: number = 0;
	private mSequenceCounter: number = 0;
	private mIsScreenSharing: boolean = false;

	public readonly transfer: boolean = false;
	public transferDirection: CallState.TransferDirection | null = null;
	public transferToConnection: CallConnection | null = null;
	public transferFromConnection: CallConnection | null = null;
	public transferToMemberId: string | null = null;
	private readonly mPendingCallRoomMembers: Map<string, CallConnection> = new Map<string, CallConnection>();
	private readonly mPendingPrepareTransfers: Set<string> = new Set<string>();
	/**
	 * Get the identity name.
	 *
	 * @return {string} the identity name.
	 */
	public getIdentityName(): string {
		return this.mIdentityName;
	}

	/**
	 * Get the identity avatar (when it was resolved).
	 *
	 * @return {ArrayBuffer} the identity avatar.
	 */
	public getIdentityAvatarData(): ArrayBuffer {
		return this.mIdentityAvatar;
	}

	/**
	 * Returns true if the peer is connected.
	 *
	 * @return {boolean} true if the peer is connected.
	 */
	public isConnected(): boolean {
		return this.mPeerConnected;
	}

	/**
	 * Returns true if the call handles video.
	 *
	 * @return {boolean} true if the call handles video.
	 */
	public isVideo(): boolean {
		return CallStatusOps.isVideo(this.getStatus());
	}

	/**
	 * Returns true if this call is a group call.  The call is changed to a group call when a first participant is added.
	 *
	 * @return {boolean} true if this is a group call.
	 */
	public isGroupCall(): boolean {
		return this.mCallRoomId !== null || this.mPeers.length > 1;
	}

	public isScreenSharing(): boolean {
		return this.mIsScreenSharing;
	}

	/**
	 * Get the current call status.
	 *
	 * @return {CallStatus} the current call status.
	 */
	public getStatus(): CallStatus {
		if (this.mPeers.length === 0) {
			return CallStatus.TERMINATED;
		}
		return this.mPeers[0].getStatus();
	}

	/**
	 * Get the main participant for the call.
	 *
	 * @return {CallParticipant} the main participant.
	 */
	public getMainParticipant(): CallParticipant | null {
		if (this.mPeers.length === 0) {
			return null;
		} else {
			return this.mPeers[0].getMainParticipant();
		}
	}

	/**
	 * Get the local video renderer if the camera is opened.
	 *
	 * @return {*} the local video renderer or null.
	 */
	public getLocalRenderer(): unknown {
		return this.mLocalRenderer;
	}

	/**
	 * Get the list of call participants.
	 *
	 * @return {CallParticipant[]} the current frozen list of participants.
	 */
	public getParticipants(): Array<CallParticipant> {
		const result: Array<CallParticipant> = [];
		for (const connection of this.mPeers) {
			connection.getParticipants(result);
		}
		return result;
	}

	public getCurrentConnection(): CallConnection | null {
		if (this.mPeers.length === 0) {
			return null;
		}
		return this.mPeers[0];
	}

	/**
	 * Get the call room identifier.
	 *
	 * @return {UUID} the call room identifier or null if this is not a group call.
	 */
	public getCallRoomId(): UUID | null {
		return this.mCallRoomId;
	}

	public getCallRoomMemberId(): string | null {
		return this.mCallRoomMemberId;
	}

	/**
	 * Get the maximum number of participants
	 *
	 * @return {number} the maximum number of participants.
	 */
	public getMaxMemberCount(): number {
		return this.mMaxMemberCount;
	}

	/**
	 * Send a message to each peer connected with us.
	 *
	 * @param message the message to send.
	 * @param copyAllowed true if the message can be copied.
	 * @returns the descriptor that was sent.
	 */
	public pushMessage(message: string, copyAllowed: boolean): ConversationService.MessageDescriptor {
		const now: number = Date.now();
		const sequenceId: number = this.newSequenceId();
		const descriptor: ConversationService.MessageDescriptor = new ConversationService.MessageDescriptor(
			this.mSenderId,
			sequenceId,
			0,
			null,
			null,
			now,
			message,
			copyAllowed,
		);

		// Serialize the message only once for each connection.
		const pushMessageIQ: PushObjectIQ = new PushObjectIQ(
			CallConnection.IQ_PUSH_OBJECT_SERIALIZER,
			this.newRequestId(),
			descriptor,
		);

		// Send only to the peers that support receiving messages.
		let sent: boolean = false;
		for (const connection of this.mPeers) {
			if (connection.isMessageSupported() && connection.sendMessage(pushMessageIQ)) {
				sent = true;
			}
		}
		if (sent) {
			descriptor.sentTimestamp = Date.now();
		} else {
			descriptor.sentTimestamp = -1;
		}
		return descriptor;
	}

	/**
	 * Update the identity name and avatar.
	 *
	 * @param identityName the new identity name.
	 * @param identityAvatar the new identity avatar.
	 */
	public updateIdentity(identityName: string, identityAvatar: ArrayBuffer): void {
		this.mIdentityName = identityName;
		this.mIdentityAvatar = identityAvatar;
		for (const connection of this.mPeers) {
			connection.sendParticipantInfoIQ();
		}
	}

	/**
	 * A new participant is added to the call group.
	 *
	 * @param {CallParticipant} participant the participant.
	 */
	onAddParticipant(participant: CallParticipant): void {
		this.performTransfer(participant);

		const observer: CallParticipantObserver | null = this.mCallService.getParticipantObserver();
		if (observer != null) {
			observer.onAddParticipant(participant);
		}
	}

	/**
	 * One or several participants are removed from the call.
	 *
	 * @param {CallParticipant[]} participants the list of participants being removed.
	 */
	onRemoveParticipants(participants: Array<CallParticipant>): void {
		const observer: CallParticipantObserver | null = this.mCallService.getParticipantObserver();
		if (observer != null) {
			observer.onRemoveParticipants(participants);
		}
	}

	/**
	 * An event occurred for the participant and its state was changed.
	 *
	 * @param {CallParticipant} participant the participant.
	 * @param {CallParticipantEvent} event the event that occurred.
	 */
	onEventParticipant(participant: CallParticipant, event: CallParticipantEvent): void {
		const observer: CallParticipantObserver | null = this.mCallService.getParticipantObserver();
		if (observer != null) {
			observer.onEventParticipant(participant, event);
		}
	}

	/**
	 * A descriptor (message, invitation) was send by the participant.
	 *
	 * @param {CallParticipant} participant the participant.
	 * @param {ConversationService.Descriptor} descriptor the descriptor that was received.
	 */
	onPopDescriptor(participant: CallParticipant, descriptor: ConversationService.Descriptor): void {
		const observer: CallParticipantObserver | null = this.mCallService.getParticipantObserver();
		if (observer != null) {
			observer.onPopDescriptor(participant, descriptor);
		}
	}

	allocateParticipantId(): number {
		return this.mParticipantCounter++;
	}

	constructor(
		callService: CallService,
		peerCallService: PeerCallService,
		identityName: string,
		identityImage: ArrayBuffer,
		transfer: boolean = false,
	) {
		this.mCallService = callService;
		this.mPeerCallService = peerCallService;
		this.mIdentityName = identityName;
		this.mIdentityAvatar = identityImage;
		this.transfer = transfer;
		const bytes = crypto.getRandomValues(new Uint8Array(16));
		this.mSenderId = new UUID(bytes);
	}

	/**
	 * Set the local video renderer when the camera is opened.
	 * @param {*} localRenderer
	 */
	setLocalRenderer(localRenderer: unknown): void {
		this.mLocalRenderer = localRenderer;
	}

	/**
	 * Set the audio direction to either 'recvonly' or 'sendrecv'.
	 *
	 * @param direction the audio direction to set.
	 */
	setAudioDirection(direction: RTCRtpTransceiverDirection): void {
		console.info("User audio direction", direction);

		for (const callConnection of this.mPeers) {
			callConnection.setAudioDirection(direction);
		}
	}

	setAudioTrack(audioTrack: MediaStreamTrack) {
		console.info("Replace audio track with ", audioTrack.label);

		if (CallStatusOps.isActive(this.getStatus())) {
			for (const callConnection of this.mPeers) {
				callConnection.replaceAudioTrack(audioTrack);
			}
		}
	}

	setVideoTrack(videoTrack: MediaStreamTrack | null, isScreenSharing: boolean, replace: boolean): void {
		let scaleDown;
		if (videoTrack) {
			const settings = videoTrack.getSettings();
			console.info(
				"Replace video",
				videoTrack.label,
				"width",
				settings.width,
				"height",
				settings.height,
				"scale down",
				scaleDown,
				"screenSharing",
				isScreenSharing,
			);
			scaleDown = this.scaleDownFactor(settings.width, settings.height);
		} else {
			scaleDown = 0;
			console.info("Stop video track");
		}

		if (CallStatusOps.isActive(this.getStatus())) {
			for (const connection of this.mPeers) {
				if (!videoTrack) {
					connection.stopVideoTrack();
				} else if (replace) {
					connection.replaceVideoTrack(videoTrack, scaleDown);
				} else {
					connection.addVideoTrack(videoTrack, scaleDown);
				}
				if (this.mIsScreenSharing != isScreenSharing) {
					connection.sendScreenSharingIQ(isScreenSharing);
				}
			}
		}
		this.mIsScreenSharing = isScreenSharing;
	}

	scaleDownFactor(width: number | undefined, height: number | undefined): number {
		const MAX_WIDTH = 1280;
		const MAX_HEIGHT = 1024;

		// No scaling needed
		if (width === undefined || height === undefined || (width <= MAX_WIDTH && height <= MAX_HEIGHT)) {
			return 1;
		}

		return 2;
		/*const scaleWidth = width / MAX_WIDTH;
		const scaleHeight = height / MAX_HEIGHT;
		const scale = Math.max(scaleWidth, scaleHeight);

		// Choose the smallest factor from the allowed set that is >= scale
		if (scale <= 1.5) {
			return 1.5;
		} else if (scale <= 2.0) {
			return 2.0;
		} else {
			return 3.0; // fallback to max scale-down if still too big
		}*/
	}

	/**
	 * Add a new peer connection to a contact.
	 *
	 * @param {CallConnection} callConnection the peer connection to add.
	 */
	addPeerConnection(callConnection: CallConnection): void {
		this.mPeers.push(callConnection);

		// If we know the peer connection id, take into account this new participant.
		if (callConnection.getPeerConnectionId()) {
			this.onAddParticipant(callConnection.getMainParticipant());
		}
	}

	/**
	 * Update the call connection state after the P2P connection has reached the given connection state.
	 *
	 * @param {CallConnection} callConnection the P2P connection.
	 * @param {RTCPeerConnectionState} state the connection state of that P2P connection.
	 * @return {CallState.UpdateState} the update state of this connection.
	 */
	updateConnectionState(callConnection: CallConnection, state: RTCIceConnectionState): CallState.UpdateState {
		const status: CallStatus = callConnection.getStatus();
		if (!callConnection.updateConnectionState(state)) {
			return CallState.UpdateState.IGNORE;
		}
		if (this.mConnectionStartTime !== 0) {
			if (this.mPeers.length === 1) {
				return CallState.UpdateState.IGNORE;
			} else if (this.mCallRoomId == null) {
				return CallState.UpdateState.FIRST_GROUP;
			} else {
				return CallState.UpdateState.NEW_CONNECTION;
			}
		}
		if (!CallStatusOps.isAccepted(status)) {
			return CallState.UpdateState.IGNORE;
		}
		this.mConnectionStartTime = callConnection.getConnectionStartTime();
		this.mPeerConnected = true;
		return CallState.UpdateState.FIRST_CONNECTION;
	}

	/**
	 * Check if the operation was executed for this call and prepare to execute it.
	 *
	 * This is used only for the creation and management of the call room which is shared by all P2P connections.
	 *
	 * @param {number} operation the operation to execute.
	 * @return {boolean} true if the operation must be executed NOW.
	 */
	checkOperation(operation: number): boolean {
		if ((this.mState & operation) === 0) {
			this.mState |= operation;
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Check if the operation was executed and finished.
	 *
	 * @param {number} operation the operation done flag to check.
	 * @return {boolean} true if the operation was done.
	 */
	isDoneOperation(operation: number): boolean {
		return (this.mState & operation) !== 0;
	}

	updateCallRoom(callRoomId: string, memberId: string): void {
		this.mCallRoomId = UUID.fromString(callRoomId);
		this.mCallRoomMemberId = memberId;
	}

	/**
	 * Remove the peer connection and release the resources allocated for it (remote renderer).
	 *
	 * @param {CallConnection} callConnection the peer connection to remove.
	 * @return {boolean} true if the call has no peer connection.
	 */
	remove(callConnection: CallConnection): boolean {
		const index = this.mPeers.indexOf(callConnection);
		if (index >= 0) {
			this.mPeers.splice(index, 1);
		}
		const empty: boolean = this.mPeers.length === 0;
		this.onRemoveParticipants(callConnection.release());
		return empty;
	}

	/**
	 * Terminate the call with the given reason.
	 *
	 * @param terminateReason the call terminate reason.
	 */
	terminateCall(terminateReason: TerminateReason): void {
		console.info("User terminate call", terminateReason);

		while (this.mPeers.length > 0) {
			const callConnection = this.mPeers[0];
			if (callConnection.getStatus() !== CallStatus.TERMINATED) {
				const sessionId: string | null = callConnection.terminate(terminateReason);
				this.mCallService.onTerminatePeerConnection(sessionId, callConnection, terminateReason);
			} else {
				this.remove(callConnection);
			}
		}
	}

	/**
	 * Release all the resources used by the call participants.
	 */
	release(): void {
		for (const callConnection of this.mPeers) {
			callConnection.release();
		}
		this.mPeers = [];

		if (this.transferFromConnection) {
			this.transferFromConnection.release();
			this.transferFromConnection = null;
		}

		this.mPendingCallRoomMembers.clear();
		this.mPendingPrepareTransfers.clear();
	}

	onEventParticipantTransfer(memberId: string): void {
		this.transferToMemberId = memberId;

		for (const [sessionId, callConnection] of this.mPendingCallRoomMembers) {
			this.mCallService.onSessionInitiate(callConnection.getCallMemberId()!, sessionId);
		}
		this.mPendingCallRoomMembers.clear();
	}

	onPrepareTransfer(peerConnection: CallConnection): void {
		this.transferFromConnection = peerConnection;
	}

	addPendingPrepareTransfer(peerConnectionId: string): void {
		this.mPendingPrepareTransfers.add(peerConnectionId);
	}

	removePendingPrepareTransfer(peerConnectionId: string): void {
		this.mPendingPrepareTransfers.delete(peerConnectionId);
	}

	hasPendingPrepareTransfer(): boolean {
		return this.mPendingPrepareTransfers.size > 0;
	}

	addPendingCallRoomConnection(peerConnectionId: string, callConnection: CallConnection): void {
		this.mPendingCallRoomMembers.set(peerConnectionId, callConnection);
	}

	performTransfer(transfertTarget: CallParticipant): boolean {
		if (!this.transferFromConnection) {
			return false;
		}

		const transferToMemberId = this.transferFromConnection.transferToMemberId;

		if (transferToMemberId && transferToMemberId === transfertTarget.getCallConnection()?.getCallMemberId()) {
			transfertTarget.transferParticipant(this.transferFromConnection.getMainParticipant());
			this.transferFromConnection.transferToMemberId = null;
			this.transferFromConnection = null;
			this.transferToMemberId = null;

			this.onEventParticipant(transfertTarget, CallParticipantEvent.EVENT_IDENTITY);

			return true;
		}

		return false;
	}

	prepareTransfer(sessionId: string): void {
		for (const connection of this.mPeers) {
			const peerConnectionId = connection.getPeerConnectionId();

			if (peerConnectionId && peerConnectionId != sessionId) {
				connection.sendPrepareTransferIQ();
				this.addPendingPrepareTransfer(peerConnectionId);
			}
		}
	}

	private newRequestId(): number {
		this.mRequestCounter++;
		return this.mRequestCounter;
	}

	private newSequenceId(): number {
		this.mSequenceCounter++;
		return this.mSequenceCounter;
	}
}

export namespace CallState {
	export enum UpdateState {
		IGNORE,
		FIRST_CONNECTION,
		FIRST_GROUP,
		NEW_CONNECTION,
	}

	export enum TransferDirection {
		TO_DEVICE,
		TO_BROWSER,
	}
}
