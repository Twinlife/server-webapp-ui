/*
 *  Copyright (c) 2019-2023 twinlife SA.
 *
 *  All Rights Reserved.
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
import {UUID} from "../utils/UUID";
import {Version} from "../utils/Version";
import {CallConnection} from "./CallConnection";
import {CallObserver} from "./CallObserver";
import {CallParticipant} from "./CallParticipant";
import {CallParticipantObserver} from "./CallParticipantObserver";
import {CallState} from "./CallState";
import {CallStatus, CallStatusOps} from "./CallStatus";
import {ConnectionOperation} from "./ConnectionOperation";
import TransferDirection = CallState.TransferDirection;

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
    private mLocalStream: MediaStream = new MediaStream();
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

    actionOutgoingCall(twincodeId: string, video: boolean, transfer: boolean, contactName: string, contactURL: string): void {
        let call: CallState | null = this.mActiveCall;
        if (call && call.getStatus() !== CallStatus.TERMINATED) {
            return;
        }

        call = new CallState(this, this.mPeerCallService, this.mIdentityName, this.mIdentityImage, transfer);
        let callStatus: CallStatus = video ? CallStatus.OUTGOING_VIDEO_CALL : CallStatus.OUTGOING_CALL;
        let callConnection: CallConnection = new CallConnection(
            this,
            this.mPeerCallService,
            call,
            null,
            callStatus,
            this.mLocalStream,
            twincodeId,
            null,
            transfer
        );
        callConnection.setAudioDirection(this.getAudioDirection());

        this.mActiveCall = call;
        call.addPeerConnection(callConnection);
        callConnection.getMainParticipant()?.setInformation(contactName, "", contactURL);
        if (transfer) {
            call.transferDirection = TransferDirection.TO_BROWSER;
            call.transferToConnection = callConnection;
        }
        this.mPeerTo.set(twincodeId, callConnection);
        this.mObserver.onUpdateCallStatus(callStatus);
    }

    actionAddCallParticipant(twincodeId: string, transfer: boolean, contactName: string, contactURL: string): void {
        if(!this.mActiveCall){
            return;
        }

        let call = this.mActiveCall;
        if (!CallStatusOps.isActive(call.getStatus())) {
            console.error("actionAddCallParticipant call status invalid, call=");
            console.error(call);
            return;
        }

        let callStatus = call.isVideo() ? CallStatus.OUTGOING_VIDEO_CALL : CallStatus.OUTGOING_CALL;
        let callConnection: CallConnection = new CallConnection(
            this,
            this.mPeerCallService,
            call,
            null,
            callStatus,
            this.mLocalStream,
            twincodeId,
            null,
            transfer
        );
        callConnection.setAudioDirection(this.getAudioDirection());

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
            callConnection.setAudioDirection(this.getAudioDirection());
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

    getMediaStream(): MediaStream {
        return this.mLocalStream;
    }

    addOrReplaceAudioTrack(audioTrack: MediaStreamTrack) {
        if (this.mLocalStream) {
            if (this.hasAudioTrack()) {
                // Replace track
                const currentTrack = this.mLocalStream.getAudioTracks()[0];
                currentTrack.stop();
                this.mLocalStream.removeTrack(currentTrack);
                const call = this.mActiveCall;
                if (call && CallStatusOps.isActive(call.getStatus())) {
                    let connections: Array<CallConnection> = call.getConnections();
                    for (let callConnection of connections) {
                        callConnection.replaceAudioTrack(audioTrack);
                    }
                }
            }
            this.mLocalStream.addTrack(audioTrack);
        }
    }

    addOrReplaceVideoTrack(videoTrack: MediaStreamTrack) {
        if (this.mLocalStream) {
            if (this.hasVideoTrack()) {
                // Replace track
                const currentTrack = this.mLocalStream.getVideoTracks()[0];
                currentTrack.stop();
                this.mLocalStream.removeTrack(currentTrack);
                const call = this.mActiveCall;
                if (call && CallStatusOps.isActive(call.getStatus())) {
                    let connections: Array<CallConnection> = call.getConnections();
                    for (let callConnection of connections) {
                        callConnection.replaceVideoTrack(videoTrack);
                    }
                }
            }
            this.mLocalStream.addTrack(videoTrack);
        }
    }

    hasAudioTrack(): boolean {
        return this.mLocalStream.getAudioTracks().length > 0;
    }

    hasVideoTrack(): boolean {
        return this.mLocalStream.getVideoTracks().length > 0;
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
        callConnection.setAudioDirection(this.getAudioDirection());
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
        console.log("P2P " + sessionId + " is accepted for:", offer);

        const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
        if (!callConnection?.onSessionAccept(sdp, offer, offerToReceive)) {
            this.mPeerCallService.sessionTerminate(sessionId, "gone");
            return;
        }

        if (callConnection?.getCall().transfer) {
            switch (callConnection.getCall().transferDirection) {
                case TransferDirection.TO_BROWSER:
                    if (callConnection.getCall().getCurrentConnection()?.getPeerConnectionId() == sessionId) {
                        // We're transferring the call to this browser and we're connected to the transferred device =>
                        // copy the audio/video setting from the device as we want the browser to be in the same mode as the device.
                        this.mObserver.onOverrideAudioVideo(offer.audio, offer.video);
                    }
                    break;
                case TransferDirection.TO_DEVICE:
                    for (const connection of callConnection.getCall().getConnections()) {
                        const peerConnectionId = connection.getPeerConnectionId();

                        if (peerConnectionId && peerConnectionId != sessionId) {
                            connection.sendPrepareTransferIQ();
                            callConnection.getCall().addPendingPrepareTransfer(peerConnectionId);
                        }
                    }
                    break;
            }
        }
    }

    onSessionUpdate(sessionId: string, updateType: string, sdp: string): void {
        console.log("P2P " + sessionId + "update " + updateType);

        const callConnection: CallConnection | undefined = this.mPeers.get(sessionId);
        if (!callConnection?.onSessionUpdate(updateType, sdp)) {
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

        const video: boolean = !this.mIsCameraMute;
        const mode: CallStatus = video ? CallStatus.OUTGOING_VIDEO_CALL : CallStatus.OUTGOING_CALL;
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
                null
            );
            callConnection.setAudioDirection(this.getAudioDirection());
            this.mActiveCall.addPeerConnection(callConnection);
            this.mPeerTo.set(peerId, callConnection);
        }
    }

    onMemberJoin(sessionId: string | null, memberId: string, status: MemberStatus): void {
        console.log("Member join sessionId: " + sessionId + " memberId: " + memberId + " status: " + status);

        if(sessionId == null || memberId == null){
            return;
        }

        const callConnection = this.mPeers.get(sessionId);

        if(!callConnection){
            return;
        }

        if(callConnection.getMainParticipant()?.transfer && callConnection.getCall().transferDirection === TransferDirection.TO_DEVICE){
            // We're transferring our call, and the transfer target has joined the call room.
            // Tell the other participants that they need to transfer us.
            for(const connection of this.mPeers.values()){
                if(connection.getPeerConnectionId() && connection.getPeerConnectionId() !== sessionId){
                    connection.sendParticipantTransferIQ(memberId);
                }
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

        if (state === "connected" &&
            call.getMainParticipant()?.transfer && call.transferDirection === TransferDirection.TO_BROWSER &&
            call.getCurrentConnection()?.getPeerConnectionId() !== callConnection.getPeerConnectionId()) {
            // We're transferring the call to this browser
            // and we're connected with the other participant =>
            // Tell the transferred device that the transfer is done so that it disconnects
            // TODO handle group calls (i.e. wait for all connections to be accepted)
            call.getCurrentConnection()?.sendTransferDoneIQ();
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

    onOnPrepareTransfer(callConnection: CallConnection): void {
        const call = callConnection.getCall();
        const peerConnectionId = callConnection.getPeerConnectionId();

        if (!peerConnectionId) {
            console.error("onOnPrepareTransfer: no peerConnectionId for CallConnection:", callConnection);
            return;
        }

        console.log("onOnPrepareTransfer");
        call.removePendingPrepareTransfer(peerConnectionId);

        if (!call.hasPendingPrepareTransfer()) {
            if(!call.transferToConnection){
                console.error("onOnPrepareTransfer: call.transferToConnection not set, aborting transfer");
                return;
            }

            call.transferToConnection.inviteCallRoom();
        }
    }

    onTransferDone(callConnection: CallConnection) {
        this.actionTerminateCall("transfer-done");
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

    private getAudioDirection(): RTCRtpTransceiverDirection {
        return this.mAudioMute ? "recvonly" : "sendrecv";
    }
}
