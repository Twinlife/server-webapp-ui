/*
 *  Copyright (c) 2022-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 */
import { Offer, PeerCallService, TerminateReason, TransportCandidate } from "../services/PeerCallService";
import { BinaryCompactDecoder } from "../utils/BinaryCompactDecoder";
import { BinaryPacketIQ } from "../utils/BinaryPacketIQ";
import { ByteArrayInputStream } from "../utils/ByteArrayInputStream";
import { SchemaKey } from "../utils/SchemaKey";
import { Serializer } from "../utils/Serializer";
import { UUID } from "../utils/UUID";
import { Version } from "../utils/Version";
import { CallParticipant } from "./CallParticipant";
import { CallParticipantEvent } from "./CallParticipantEvent";
import { CallService } from "./CallService";
import { CallState } from "./CallState";
import { CallStatus, CallStatusOps } from "./CallStatus";
import { ParticipantInfoIQ } from "./ParticipantInfoIQ";
import {TransferDoneIQ} from "./TransferDoneIQ.ts";

type PacketHandler = {
	serializer: Serializer;
	handler: (this: PacketHandler, callConnection: CallConnection, packet: BinaryPacketIQ) => any;
};

type Timer = ReturnType<typeof setTimeout>;

/**
 * A P2P call connection in an Audio or Video call.
 *
 * The call connection can have one or several participant depending on the target it is connected to.
 * If it is connected to another device, there is only one participant.  If it is connected to a SFU,
 * there could be several participants.
 *
 * Calls are associated with a callId which allow to accept/hold/terminate the call.
 * The callId can be associated with one or several peer connection when the call is a meshed P2P group call.
 * @class
 */
export class CallConnection {
    static LOG_TAG: string = "CallConnection";

    static DEBUG: boolean = false;

    static DATA_VERSION: string = "CallService:1.0.0";

    static CONNECT_TIMEOUT: number = 15000; // 15 second timeout between accept and connection.

    static PARTICIPANT_INFO_SCHEMA_ID: UUID;

    public static PARTICIPANT_INFO_SCHEMA_ID_$LI$(): UUID {
        if (CallConnection.PARTICIPANT_INFO_SCHEMA_ID == null)
            CallConnection.PARTICIPANT_INFO_SCHEMA_ID = UUID.fromString("a8aa7e0d-c495-4565-89bb-0c5462b54dd0");
        return CallConnection.PARTICIPANT_INFO_SCHEMA_ID;
    }

    static IQ_PARTICIPANT_INFO_SERIALIZER: BinaryPacketIQ.BinaryPacketIQSerializer;

    public static IQ_PARTICIPANT_INFO_SERIALIZER_$LI$(): BinaryPacketIQ.BinaryPacketIQSerializer {
        if (CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER == null)
            CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER = ParticipantInfoIQ.createSerializer(
                CallConnection.PARTICIPANT_INFO_SCHEMA_ID_$LI$(),
                1
            );
        return CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER;
    }

    static TRANSFER_DONE_SCHEMA_ID: UUID;

    public static TRANSFER_DONE_SCHEMA_ID_$LI$(): UUID {
        if (CallConnection.TRANSFER_DONE_SCHEMA_ID == null)
            CallConnection.TRANSFER_DONE_SCHEMA_ID = UUID.fromString("641bf1f6-ebbf-4501-9151-76abc1b9adad");
        return CallConnection.TRANSFER_DONE_SCHEMA_ID;
    }

    static IQ_TRANSFER_DONE_SERIALIZER: BinaryPacketIQ.BinaryPacketIQSerializer;

    public static IQ_TRANSFER_DONE_SERIALIZER_$LI$(): BinaryPacketIQ.BinaryPacketIQSerializer {
        if (CallConnection.IQ_TRANSFER_DONE_SERIALIZER == null)
            CallConnection.IQ_TRANSFER_DONE_SERIALIZER = TransferDoneIQ.createSerializer(
                CallConnection.TRANSFER_DONE_SCHEMA_ID_$LI$(),
                1
            );
        return CallConnection.IQ_TRANSFER_DONE_SERIALIZER;
    }

    private readonly mCallService: CallService;
    private readonly mPeerCallService: PeerCallService;
    private readonly mTo: string;
    private readonly mInitiator: boolean;
    private readonly mCall: CallState;
    private mPeerConnectionId: string | null = null;
    private mPeerConnection: RTCPeerConnection | null;
    private mInDataChannel: RTCDataChannel | null;
    private mOutDataChannel: RTCDataChannel | null;
    private mIcePending: Array<RTCIceCandidate> | null = null;
    private mRenegotiationNeeded: boolean = false;
    private mMakingOffer: boolean = false;
    private mRemoteAnswerPending: boolean = false;
    private mIgnoreOffer: boolean = false;
    private mAudioDirection: RTCRtpTransceiverDirection = "inactive";
    private mVideoDirection: RTCRtpTransceiverDirection = "inactive";
    private mState: number = 0;
    private mAudioTrack: MediaStreamTrack | null = null;
    private mVideoTrack: MediaStreamTrack | null = null;
    private mConnectionState: RTCIceConnectionState = "closed";
    private mParticipants: Map<String, CallParticipant>;
    private mBinaryListeners: Map<String, PacketHandler> = new Map();

    private mMainParticipant: CallParticipant;

    private mVideoTrackId: string | null = null;
    private mAudioTrackId: string | null = null;
    private mConnectionStartTime: number = 0;

    private mTimer: Timer | null = null;

    private mVideo: boolean = false;
    private mAudioSourceOn: boolean = false;
    private mVideoSourceOn: boolean = false;
    private mPeerConnected: boolean = false;
    private mPeerVersion: Version | null = null;

    mStatus: CallStatus = CallStatus.TERMINATED;

    private mCallMemberId: string | null = null;

    /**
     * Get the main call participant.
     *
     * @return {CallParticipant} the main participant of this call.
     */
    public getMainParticipant(): CallParticipant | null {
        return this.mMainParticipant;
    }

    /**
     * Get the peer connection id or null.
     *
     * @return {String} the peer connectin id or null.
     */
    public getPeerConnectionId(): string | null {
        return this.mPeerConnectionId;
    }

    public isVideo(): boolean {
        return this.mVideo;
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
     * Get the current connection state.
     *
     * @return {CallStatus} the current connection state.
     */
    public getStatus(): CallStatus {
        return this.mStatus;
    }

    public getCall(): CallState {
        return this.mCall;
    }

    public getConnectionState(): RTCIceConnectionState {
        return this.mConnectionState;
    }

    /**
     * Get the connection start time.
     *
     * @return {number} the time when the connection reached CONNECTED state for the first time.
     */
    public getConnectionStartTime(): number {
        return this.mConnectionStartTime;
    }

    /**
     * Check if this connection supports P2P group calls.
     *
     * @return {boolean} NULL if we don't know, TRUE if P2P group calls are supported.
     */
    public isGroupSupported(): boolean | null {
        let v: Version | null = this.mPeerVersion;
        if (v == null) {
            return null;
        }
        return v.major >= 2;
    }

    constructor(
        callService: CallService,
        peerCallService: PeerCallService,
        call: CallState,
        peerConnectionId: string | null,
        callStatus: CallStatus,
        mediaStream: MediaStream | null,
        memberId: string | null,
        sdp: string | null,
        transfer: boolean = false
    ) {
        this.mCallService = callService;
        this.mPeerCallService = peerCallService;
        this.mCall = call;
        this.mTo = memberId ? memberId : "";
        this.mState = 0;
        this.mStatus = callStatus;
        this.mPeerConnectionId = peerConnectionId;
        this.mPeerConnected = false;
        this.mIcePending = [];
        this.mConnectionState = "closed";
        this.mConnectionStartTime = 0;
        this.mPeerVersion = null;
        this.mInitiator = sdp === null;
        this.mVideo = CallStatusOps.isVideo(callStatus);
        this.mCallMemberId = memberId;
        this.mParticipants = new Map();
        this.mMainParticipant = new CallParticipant(this, call.allocateParticipantId());

        this.mTimer = setTimeout(() => {
            this.mCallService.callTimeout(this);
        }, CallService.CALL_TIMEOUT);

        if (peerConnectionId != null) {
            this.mParticipants.set(peerConnectionId.toString(), this.mMainParticipant);
            this.mCall.onAddParticipant(this.mMainParticipant);
        }
        this.addListener({
            serializer: CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER_$LI$(),
            handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
                return callConnection.onParticipantInfoIQ(iq);
            },
        });

        let config: RTCConfiguration = peerCallService.getConfiguration();
        const pc: RTCPeerConnection = new RTCPeerConnection(config);
        this.mPeerConnection = pc;

        // Handle ICE connection state.
        pc.oniceconnectionstatechange = (event: Event) => {
            console.log("oniceconnection state event=" + event);
            if (this.mPeerConnection) {
                const state = pc.iceConnectionState;
                console.log("IceConnectionState: " + state + " state=" + state);
                if (state === "connected") {
                    if (this.mAudioTrack) {
                        this.mAudioTrack.enabled = this.mAudioDirection === "sendrecv";
                    }
                    if (this.mVideoTrack) {
                        this.mVideoTrack.enabled = this.mVideoDirection === "sendrecv";
                    }
                }

                // Forward to CallService
                callService.onChangeConnectionState(this, state);
            }
        };

        // Handle ICE candidates and propagates to the peer.
        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            const candidate: RTCIceCandidate | null = event.candidate;
            if (!candidate || !this.mPeerConnection || !candidate.candidate) {
                return;
            }
            if (!this.mPeerConnectionId) {
                this.mIcePending?.push(candidate);
                return;
            }

            if (candidate.candidate && candidate.sdpMid != null && candidate.sdpMLineIndex != null) {
                this.mPeerCallService.transportInfo(
                    this.mPeerConnectionId,
                    candidate.candidate,
                    candidate.sdpMid,
                    candidate.sdpMLineIndex
                );
            }
        };

        pc.onicecandidateerror = (event: Event) => {
            console.log("ice candidate error: " + event);
        };

        // Handle signaling state errors.
        pc.onsignalingstatechange = (event: Event) => {
            if (this.mPeerConnection) {
                let signalingState = this.mPeerConnection.signalingState;
                if (signalingState === "closed" && this.mPeerConnectionId) {
                    this.mPeerCallService.sessionTerminate(this.mPeerConnectionId, "connectivity-error");
                }
            }
        };

        // Handle WebRTC renegotiation to send a new offer.
        pc.onnegotiationneeded = (event: Event) => {
            console.log("on negotiation needed");
            if (!this.mRenegotiationNeeded || !this.mPeerConnection) {
                return;
            }
            this.mRenegotiationNeeded = false;
            this.mMakingOffer = true;
            this.mPeerConnection
                .setLocalDescription()
                .then(() => {
                    this.mMakingOffer = false;
                    if (this.mPeerConnection && this.mPeerConnectionId) {
                        let description: RTCSessionDescription | null = this.mPeerConnection.localDescription;
                        if (description) {
                            this.mPeerCallService.sessionUpdate(this.mPeerConnectionId, description.sdp, "offer");
                        }
                    }
                })
                .catch();
        };

        // Handle the audio/video track.
        pc.ontrack = (event: RTCTrackEvent) => {
            console.log("Received on track event");

            for (let stream of event.streams) {
                stream.onremovetrack = (ev: MediaStreamTrackEvent) => {
                    let trackId: string = ev.track.id;

                    this.removeRemoteTrack(trackId);
                };
            }
            this.addRemoteTrack(event.track, event.streams[0]);
        };

        // Setup the input data channel to handle incoming data messages.
        this.mInDataChannel = null;
        pc.ondatachannel = (event: RTCDataChannelEvent): void => {
            let channel: RTCDataChannel = event.channel;
            channel.onopen = (event: Event): any => {
                let label: string = channel.label;

                console.log("Input data channel " + label + " is opened");
            };
            channel.onmessage = async (event: MessageEvent<Blob>): Promise<any> => {
                let schemaId: UUID | null = null;
                let schemaVersion: number = 0;
                console.log("Received a data channel message");

                try {
                    const data = await event.data.arrayBuffer();
                    let inputStream: ByteArrayInputStream = new ByteArrayInputStream(data);
                    let binaryDecoder: BinaryCompactDecoder = new BinaryCompactDecoder(inputStream);
                    schemaId = binaryDecoder.readUUID();
                    schemaVersion = binaryDecoder.readInt();
                    let key: SchemaKey = new SchemaKey(schemaId, schemaVersion);
                    let listener: PacketHandler | undefined = this.mBinaryListeners.get(key.toString());
                    if (listener !== undefined) {
                        let iq: BinaryPacketIQ = listener.serializer.deserialize(binaryDecoder) as BinaryPacketIQ;
                        listener.handler(this, iq);
                    } else {
                        console.log("Schema " + key + " is not recognized");
                    }
                } catch (exception) {
                    console.log("Exception raised when handling data channel message");
                    console.log(exception);
                }
            };
        };

        // Setup the output data channel.
        this.mOutDataChannel = pc.createDataChannel("data");
        this.mOutDataChannel.onopen = (event: Event): any => {
            console.log("Output data channel is now opened");
            if (this.mOutDataChannel && this.mCall) {
                this.sendParticipantInfoIQ();
            }
        };

        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => {
                console.log("Found track " + track.id);
                if (track.kind === "audio") {
                    this.mAudioTrack = track;
                    pc.addTrack(track, mediaStream);
                } else if (track.kind === "video") {
                    this.mVideoTrack = track;
                    pc.addTrack(track, mediaStream);
                }
            });
        }

        switch (callStatus) {
            case CallStatus.OUTGOING_VIDEO_BELL:
                this.mAudioSourceOn = false;
                this.mVideoSourceOn = true;
                break;
            case CallStatus.OUTGOING_CALL:
            case CallStatus.INCOMING_CALL:
            case CallStatus.ACCEPTED_INCOMING_CALL:
                this.mAudioSourceOn = true;
                this.mVideoSourceOn = false;
                break;
            case CallStatus.OUTGOING_VIDEO_CALL:
            case CallStatus.INCOMING_VIDEO_CALL:
            case CallStatus.ACCEPTED_INCOMING_VIDEO_CALL:
                this.mAudioSourceOn = true;
                this.mVideoSourceOn = true;
                break;
            case CallStatus.INCOMING_VIDEO_BELL:
            default:
                this.mAudioSourceOn = false;
                this.mVideoSourceOn = false;
                break;
        }
        if (this.mAudioSourceOn) {
            this.mAudioDirection = "sendrecv";
        }
        if (this.mVideoSourceOn) {
            this.mVideoDirection = "sendrecv";
        }

        const offerOptions: RTCOfferOptions = {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        };
        const offer: Offer = {
            audio: true,
            video: this.mVideoSourceOn,
            data: true,
            group: false,
            transfer: false ,
            version: "1.0.0",
        };
        // this.mVideoSourceOn ? "video" : "audio";
        if (sdp) {
            this.mMakingOffer = false;
            this.mPeerConnection
                .setRemoteDescription({
                    sdp: sdp,
                    type: "offer",
                })
                .then(() => {
                    console.log("Set remote is done");
                    this.createAnswer(offer);
                })
                .catch((error: any) => {
                    console.log("Set remote failed: " + error);
                });

            /* if (this.mTimer) {
               clearTimeout(this.mTimer);
           }
           this.mTimer = setTimeout(() => {
               this.mCallService.callTimeout(this);
           }, CallConnection.CONNECT_TIMEOUT);*/
        } else {
            this.mMakingOffer = true;
            pc.createOffer(offerOptions)
                .then((description: RTCSessionDescriptionInit) => {
                    console.log("SDP " + description.sdp);
                    pc.setLocalDescription(description)
                        .then(() => {
                            this.mMakingOffer = false;
                            if (this.mTo && description.sdp) {
                                if (description.type === "offer" || !this.mPeerConnectionId) {
                                    console.log("sending session-initiate with " + offer);
                                    this.mPeerCallService.sessionInitiate(this.mTo, description.sdp, offer);
                                } else {
                                    console.log("sending session-accept with " + offer);
                                    this.mPeerCallService.sessionAccept(
                                        this.mPeerConnectionId,
                                        this.mTo,
                                        description.sdp,
                                        offer
                                    );
                                }
                            }
                        })
                        .catch((reason: any) => {
                            console.log("setLocalDescription failed: " + reason);
                        });
                    console.log("setLocalDescription is done");
                })
                .catch((reason: any) => {
                    console.error("createOffer failed: " + reason);
                });
        }
    }

    addVideoTrack(track: MediaStreamTrack) {
        this.mVideo = true;
        this.mVideoTrack = track;
        this.mPeerConnection?.addTrack(track);
    }

    onSessionInitiate(sessionId: string): void {
        console.log("session-initiate created " + sessionId);
        this.mPeerConnectionId = sessionId;
        this.mParticipants.set(sessionId, this.mMainParticipant);
        console.log("Add new participant");
        this.mCall.onAddParticipant(this.mMainParticipant);
        if (this.mIcePending && this.mIcePending.length > 0) {
            console.log("Flush " + this.mIcePending.length + " candidates");
            for (var candidate of this.mIcePending) {
                if (candidate.candidate && candidate.sdpMid != null && candidate.sdpMLineIndex != null) {
                    this.mPeerCallService.transportInfo(
                        sessionId,
                        candidate.candidate,
                        candidate.sdpMid,
                        candidate.sdpMLineIndex
                    );
                }
            }
            console.log("Flush candidates ok");
        }
        this.mIcePending = null;
    }

    onSessionAccept(sdp: string, offer: Offer, offerToReceive: Offer): boolean {
        if (!this.mPeerConnection) {
            if (this.mPeerConnectionId) {
            }
            return false;
        }
        this.setPeerVersion(new Version(offer.version));

        this.mPeerConnection
            .setRemoteDescription({
                sdp: sdp,
                type: "answer",
            })
            .then(() => {
                console.log("Set remote is done");
            })
            .catch((error: any) => {
                console.log("Set remote failed: " + error);
            });
        if (this.mTimer) {
            clearTimeout(this.mTimer);
        }
        this.mTimer = setTimeout(() => {
            this.mCallService.callTimeout(this);
        }, CallConnection.CONNECT_TIMEOUT);
        return true;
    }

    onSessionUpdate(updateType: string, sdp: string): boolean {
        if (!this.mPeerConnection) {
            return false;
        }

        const isOffer: boolean = updateType === "offer";
        const state: RTCSignalingState = this.mPeerConnection.signalingState;
        const readyForOffer: boolean = !this.mMakingOffer && (state === "stable" || this.mRemoteAnswerPending);
        const offerCollision: boolean = isOffer && !readyForOffer;
        this.mIgnoreOffer = !this.mInitiator && offerCollision;
        if (this.mIgnoreOffer || (state === "stable" && !isOffer)) {
            return true;
        }

        const type: RTCSdpType = isOffer ? "offer" : "answer";
        this.mRemoteAnswerPending = !isOffer;
        this.mPeerConnection
            .setRemoteDescription({
                sdp: sdp,
                type: type,
            })
            .then(() => {
                this.mRemoteAnswerPending = false;
                if (isOffer) {
                    this.createAnswer(null);
                }
            });
        return true;
    }

    createAnswer(offer: Offer | null): void {
        const pc: RTCPeerConnection | null = this.mPeerConnection;

        if (!pc) {
            return;
        }

        this.mMakingOffer = false;
        pc.createAnswer()
            .then((description: RTCSessionDescriptionInit) => {
                pc.setLocalDescription(description)
                    .then(() => {
                        if (this.mTo && description.sdp && this.mPeerConnectionId) {
                            if (offer) {
                                this.mPeerCallService.sessionAccept(
                                    this.mPeerConnectionId,
                                    this.mTo,
                                    description.sdp,
                                    offer
                                );
                            } else {
                                this.mPeerCallService.sessionUpdate(this.mPeerConnectionId, description.sdp, "answer");
                            }
                        }
                    })
                    .catch((reason: any) => {
                        console.error("setLocalDescription failed: " + reason);
                    });
            })
            .catch((reason: any) => {
                console.error("createAnswer failed: " + reason);
            });
    }

    onTransportInfo(candidates: TransportCandidate[]): boolean {
        if (!this.mPeerConnection) {
            return false;
        }

        for (var candidate of candidates) {
            if (!candidate.removed) {
                let startPos: number = candidate.candidate.indexOf(" ufrag ") + 7;
                let endPos: number = candidate.candidate.indexOf(" ", startPos);
                let ufrag: string = candidate.candidate.substring(startPos, endPos);
                let c: RTCIceCandidateInit = {
                    candidate: candidate.candidate,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: candidate.sdpMLineIndex,
                    usernameFragment: ufrag,
                };

                let ice: RTCIceCandidate = new RTCIceCandidate(c);
                // console.log("Adding candidate " + c.candidate + " label=" + c.sdpMid + " id=" + c.sdpMLineIndex
                // + " ufrag=" + ice.usernameFragment);
                this.mPeerConnection.addIceCandidate(ice).then(
                    () => {
                        console.log("Add ice candidate ok " + JSON.stringify(ice.toJSON()));
                    },
                    (err) => {
                        console.log("Add ice candidate error: " + err);
                    }
                );
            }
        }
        return true;
    }

    private addListener(handler: PacketHandler): void {
        let key: SchemaKey = new SchemaKey(handler.serializer.schemaId, handler.serializer.schemaVersion);
        this.mBinaryListeners.set(key.toString(), handler);
    }

    getCallMemberId(): string | null {
        return this.mCallMemberId;
    }

    setCallMemberId(memberId: string): void {
        this.mCallMemberId = memberId;
    }

    checkOperation(operation: number): boolean {
        if ((this.mState & operation) === 0) {
            this.mState |= operation;
            return true;
        } else {
            return false;
        }
    }

    isDoneOperation(operation: number): boolean {
        return (this.mState & operation) !== 0;
    }

    setPeerVersion(version: Version): void {
        this.mPeerVersion = version;
    }

    /**
     * Set the connection state for this P2P connection.
     *
     * @param {RTCPeerConnectionState} state the new connection state.
     * @return {boolean} true if we are now connected.
     */
    updateConnectionState(state: RTCIceConnectionState): boolean {
        this.mConnectionState = state;
        if (state !== "connected") {
            return false;
        }

        if (this.mTimer) {
            clearTimeout(this.mTimer);
            this.mTimer = null;
        }
        if (this.mConnectionStartTime === 0) {
            this.mConnectionStartTime = performance.now();
            this.setAudioDirection(this.mAudioDirection);
            this.setVideoDirection(this.mVideoDirection);
        }
        this.mPeerConnected = true;
        this.mStatus = CallStatusOps.toActive(this.mStatus);
        return true;
    }

    setAudioDirection(direction: RTCRtpTransceiverDirection): void {
        this.mAudioDirection = direction;
        if (this.mPeerConnection != null && this.mAudioTrack) {
            if (this.mConnectionState === "connected" || this.mConnectionState === "completed") {
                console.log("Enable audio track");
                this.mAudioTrack.enabled = direction === "sendrecv";
            }
            let transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
            for (let transceiver of transceivers) {
                if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "audio") {
                    let sender: RTCRtpSender = transceiver.sender;
                    this.mRenegotiationNeeded = true;
                    if (direction !== "sendrecv") {
                        sender.replaceTrack(null);
                    } else {
                        sender.replaceTrack(this.mAudioTrack);
                    }
                    transceiver.direction = direction;
                    break;
                }
            }
        }
    }

    setVideoDirection(direction: RTCRtpTransceiverDirection): void {
        this.mVideoDirection = direction;
        if (this.mPeerConnection != null && this.mVideoTrack) {
            if (this.mConnectionState === "connected" || this.mConnectionState === "completed") {
                this.mVideoTrack.enabled = direction === "sendrecv";
                console.log("Enable video track");
            }
            console.log(
                "Video track enabled=" +
                this.mVideoTrack.enabled +
                " state=" +
                this.mConnectionState +
                " dir=" +
                direction
            );
            let transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
            for (let transceiver of transceivers) {
                console.log("TRANSIEVER", transceiver.receiver.track.kind, transceiver);
                if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "video") {
                    let sender: RTCRtpSender = transceiver.sender;
                    this.mRenegotiationNeeded = true;
                    if (direction !== "sendrecv") {
                        sender.replaceTrack(null);
                    } else {
                        sender.replaceTrack(this.mVideoTrack);
                    }
                    transceiver.direction = direction;
                    break;
                }
            }
        }
    }

    replaceAudioTrack(track: MediaStreamTrack): void {
        if (this.mPeerConnection != null && this.mAudioTrack) {
            console.log("Replace Audio Track");
            this.mAudioTrack = track;

            let transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
            for (let transceiver of transceivers) {
                if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "audio") {
                    let sender: RTCRtpSender = transceiver.sender;
                    this.mRenegotiationNeeded = true;
                    sender.replaceTrack(this.mAudioTrack);
                    break;
                }
            }
        }
    }

    replaceVideoTrack(track: MediaStreamTrack): void {
        if (this.mPeerConnection != null && this.mVideoTrack) {
            console.log("Replace Video Track");
            this.mVideoTrack = track;

            let transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
            for (let transceiver of transceivers) {
                console.log("TRANSIEVER", transceiver.receiver.track.kind, transceiver);
                if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "video") {
                    let sender: RTCRtpSender = transceiver.sender;
                    this.mRenegotiationNeeded = true;
                    sender.replaceTrack(this.mVideoTrack);
                    break;
                }
            }
        }
    }

    terminate(terminateReason: TerminateReason): void {
        if (this.mPeerConnectionId != null) {
            this.mPeerCallService.sessionTerminate(this.mPeerConnectionId.toString(), terminateReason);
            this.mPeerConnectionId = null;
        }

        if (this.mPeerConnection) {
            this.mPeerConnection.close();
            this.mPeerConnection = null;
        }
    }

    addRemoteTrack(track: MediaStreamTrack, stream: MediaStream): void {
        try {
            let participant: CallParticipant | null = this.getMainParticipant();
            if (participant) {
                participant.addTrack(track);
                if (track != null && track.kind === "video") {
                    this.mVideoTrackId = track.id;
                    participant.setCameraMute(false);
                    this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_VIDEO_ON);
                } else if (track != null && track.kind === "audio") {
                    this.mAudioTrackId = track.id;
                    participant.setMicrophoneMute(false);
                    this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_AUDIO_ON);
                }
            }
        } catch (ex) {
            console.log("Error: " + ex);
        }
    }

    /**
     * The track id was removed by the peer, update and if it was a known track return a message to send.
     *
     * @param {string} trackId the track id that was removed.
     */
    removeRemoteTrack(trackId: string): void {
        let participant: CallParticipant | null = this.getMainParticipant();
        if (trackId === this.mVideoTrackId) {
            this.mVideoTrackId = null;
            if (participant) {
                participant.setCameraMute(true);
                this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_VIDEO_OFF);
            }
        } else if (trackId === this.mAudioTrackId) {
            this.mAudioTrackId = null;
            if (participant) {
                participant.setMicrophoneMute(true);
                this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_AUDIO_OFF);
            }
        }
    }

    /**
     * Get the list of participants in this P2P connection.
     *
     * @param {CallParticipant[]} into the list into which participants are returned.
     */
    getParticipants(into: Array<CallParticipant>): void {
        into.push(...this.mParticipants.values());
    }

    /**
     * Release the remote renderer when the connection is destroyed.
     *
     * @return {CallParticipant[]} the list of participants that have been released.
     */
    release(): Array<CallParticipant> {
        if (this.mInDataChannel) {
            this.mInDataChannel.close();
            this.mInDataChannel = null;
        }
        if (this.mOutDataChannel) {
            this.mOutDataChannel.close();
            this.mOutDataChannel = null;
        }
        if (this.mPeerConnection) {
            this.mPeerConnection.close();
            this.mPeerConnection = null;
            this.mPeerConnectionId = null;
        }

        this.mStatus = CallStatus.TERMINATED;
        if (this.mTimer) {
            clearTimeout(this.mTimer);
            this.mTimer = null;
        }
        let participants: Array<CallParticipant> = Object.values(this.mParticipants);
        if (participants.length === 0 && this.mMainParticipant) {
            participants.push(this.mMainParticipant);
        }
        for (let participant of participants) {
            participant.release();
        }
        return participants;
    }

    private sendParticipantInfoIQ(): void {
        let name: string = this.mCall.getIdentityName();
        console.log("Sending participant with name=" + name);
        if (name == null || this.mOutDataChannel == null) {
            return;
        }
        let thumbnailData: ArrayBuffer = this.mCall.getIdentityAvatarData();
        let description: string = "";
        let memberId: string = this.mCall.getCallRoomMemberId() ?? "";
        try {
            let iq: ParticipantInfoIQ = new ParticipantInfoIQ(
                CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER_$LI$(),
                1,
                memberId,
                name,
                description,
                thumbnailData
            );
            let packet: ArrayBuffer = iq.serializeCompact();
            this.mOutDataChannel.send(packet);
        } catch (exception) {
        }
    }

    /**
     * Handle the ParticipantInfoIQ packet.
     *
     * @param {BinaryPacketIQ} iq the participant info iq.
     * @private
     */
    private onParticipantInfoIQ(iq: BinaryPacketIQ): void {
        if (!(iq != null && iq instanceof ParticipantInfoIQ)) {
            return;
        }

        let participantInfoIQ: ParticipantInfoIQ = iq as ParticipantInfoIQ;
        let imageUrl: string | null = null;
        const buffer: ArrayBuffer | null = participantInfoIQ.thumbnailData;
        if (buffer) {
            const data: Uint8Array = new Uint8Array(buffer, 0, buffer.byteLength);
            var blob = new Blob([data], {type: "image/jpeg"});
            var urlCreator = window.URL || window.webkitURL;
            imageUrl = urlCreator.createObjectURL(blob);
        }

        this.mMainParticipant.setInformation(participantInfoIQ.name, participantInfoIQ.description, imageUrl);
        this.mCall.onEventParticipant(this.mMainParticipant, CallParticipantEvent.EVENT_IDENTITY);
    }

    public sendTransferDoneIQ(): void {
        if (this.mOutDataChannel == null) {
            return;
        }
        try {
            let iq: TransferDoneIQ = new TransferDoneIQ(
                CallConnection.IQ_TRANSFER_DONE_SERIALIZER_$LI$(),
                1,
            );
            let packet: ArrayBuffer = iq.serializeCompact();
            this.mOutDataChannel.send(packet);
        } catch (exception) {
            console.error("Could not send TransferDoneIQ:");
            console.error(exception);
        }
    }
}
