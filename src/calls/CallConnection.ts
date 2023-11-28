/*
 *  Copyright (c) 2022-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
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
import { ParticipantTransferIQ } from "./ParticipantTransferIQ.ts";

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

	static DATA_VERSION: string = "CallService:1.2.0";

	static CONNECT_TIMEOUT: number = 15000; // 15 second timeout between accept and connection.

	private static readonly PARTICIPANT_INFO_SCHEMA_ID = UUID.fromString("a8aa7e0d-c495-4565-89bb-0c5462b54dd0");
	private static readonly IQ_PARTICIPANT_INFO_SERIALIZER = ParticipantInfoIQ.createSerializer(
		CallConnection.PARTICIPANT_INFO_SCHEMA_ID,
		1
	);

	private static readonly TRANSFER_DONE_SCHEMA_ID = UUID.fromString("641bf1f6-ebbf-4501-9151-76abc1b9adad");
	private static readonly IQ_TRANSFER_DONE_SERIALIZER = BinaryPacketIQ.createDefaultSerializer(
		CallConnection.TRANSFER_DONE_SCHEMA_ID,
		1
	);

	private static readonly PREPARE_TRANSFER_SCHEMA_ID = UUID.fromString("9eaa4ad1-3404-4bcc-875d-dc75c748e188");
	private static readonly IQ_PREPARE_TRANSFER_SERIALIZER = BinaryPacketIQ.createDefaultSerializer(
		CallConnection.PREPARE_TRANSFER_SCHEMA_ID,
		1
	);

	private static readonly ON_PREPARE_TRANSFER_SCHEMA_ID = UUID.fromString("a17516a2-4bd2-4284-9535-726b6eb1a211");
	private static readonly IQ_ON_PREPARE_TRANSFER_SERIALIZER = BinaryPacketIQ.createDefaultSerializer(
		CallConnection.ON_PREPARE_TRANSFER_SCHEMA_ID,
		1
	);

	private static readonly PARTICIPANT_TRANSFER_SCHEMA_ID = UUID.fromString("800fd629-83c4-4d42-8910-1b4256d19eb8");
	private static readonly IQ_PARTICIPANT_TRANSFER_SERIALIZER = ParticipantTransferIQ.createSerializer(
		CallConnection.PARTICIPANT_TRANSFER_SCHEMA_ID,
		1
	);

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
	private readonly mParticipants: Map<string, CallParticipant>;
	private mBinaryListeners: Map<string, PacketHandler> = new Map();

	private readonly mMainParticipant: CallParticipant;

	private mVideoTrackId: string | null = null;
	private mAudioTrackId: string | null = null;
	private mConnectionStartTime: number = 0;

	private mTimer: Timer | null = null;

	private mVideo: boolean = false;
	private readonly mVideoSourceOn: boolean = false;
	private mPeerConnected: boolean = false;
	private mPeerVersion: Version | null = null;

	private mStatus: CallStatus = CallStatus.TERMINATED;

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
	 * @return {String} the peer connection id or null.
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
		const v: Version | null = this.mPeerVersion;
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
		audioDirection: RTCRtpTransceiverDirection,
		transfer: boolean = false
	) {
		this.mCallService = callService;
		this.mPeerCallService = peerCallService;
		this.mCall = call;
		this.mTo = memberId ?? "";
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
		this.mMainParticipant = new CallParticipant(this, call.allocateParticipantId(), transfer);

		this.mTimer = setTimeout(() => {
			this.mCallService.callTimeout(this);
		}, CallService.CALL_TIMEOUT);

		if (peerConnectionId != null) {
			this.mParticipants.set(peerConnectionId.toString(), this.mMainParticipant);
			this.mCall.onAddParticipant(this.mMainParticipant);
		}
		this.addListener({
			serializer: CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER,
			handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
				return callConnection.onParticipantInfoIQ(iq);
			},
		});
		this.addListener({
			serializer: CallConnection.IQ_ON_PREPARE_TRANSFER_SERIALIZER,
			handler: (callConnection: CallConnection, _: BinaryPacketIQ) => {
				callConnection.onOnPrepareTransferIQ();
			},
		});
		this.addListener({
			serializer: CallConnection.IQ_TRANSFER_DONE_SERIALIZER,
			handler: (callConnection: CallConnection, _: BinaryPacketIQ) => {
				callConnection.onTransferDoneIQ();
			},
		});

		const config: RTCConfiguration = peerCallService.getConfiguration();
		const pc: RTCPeerConnection = new RTCPeerConnection(config);
		this.mPeerConnection = pc;

		// Handle ICE connection state.
		pc.oniceconnectionstatechange = (event: Event) => {
			console.log("oniceconnection state event=", event);
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
				} else if (state === "failed") {
					this.terminateInternal("connectivity-error", true);
					return;
				} else if (state === "closed") {
					this.terminateInternal("disconnected", true);
					return;
				} else if (state === "disconnected") {
					// Trigger the ICE restart in 2 seconds in case it was a transient disconnect.
					// We must be careful that the P2P connection could have been terminated and released.
					if (this.mConnectionStartTime > 0 && !this.mTimer) {
						this.mTimer = setTimeout(() => {
							const state = pc.iceConnectionState;
							if (this.mPeerConnection && state === "disconnected") {
								this.mRenegotiationNeeded = true;
								pc.restartIce();
							}
							if (this.mTimer) {
								clearTimeout(this.mTimer);
								this.mTimer = null;
							}
						}, 2000);
						return;
					}
					this.terminateInternal("disconnected", true);
					return;
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
			console.log("ice candidate error: ", event);
		};

		// Handle signaling state errors.
		pc.onsignalingstatechange = (event: Event) => {
			if (this.mPeerConnection) {
				const signalingState = this.mPeerConnection.signalingState;
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
						const description: RTCSessionDescription | null = this.mPeerConnection.localDescription;
						if (description) {
							this.mPeerCallService.sessionUpdate(this.mPeerConnectionId, description.sdp, "offer");
						}
					}
				})
				.catch((reason: any) => {
					console.log("setLocalDescription failed after onnegotiationneeded: ", reason);
				});
		};

		// Handle the audio/video track.
		pc.ontrack = (event: RTCTrackEvent) => {
			console.log("Received on track event");

			for (const stream of event.streams) {
				stream.onremovetrack = (ev: MediaStreamTrackEvent) => {
					const trackId: string = ev.track.id;

					this.removeRemoteTrack(trackId);
				};
			}
			this.addRemoteTrack(event.track, event.streams[0]);
		};

		// Setup the input data channel to handle incoming data messages.
		this.mInDataChannel = null;
		pc.ondatachannel = (event: RTCDataChannelEvent): void => {
			const channel: RTCDataChannel = event.channel;
			// Firefox defaults to "blob", but it's not supported by Chromium
			channel.binaryType = "arraybuffer";
			channel.onopen = (event: Event): any => {
				const label: string = channel.label;

				console.log("Input data channel " + label + " is opened");
			};
			channel.onmessage = (event: MessageEvent<ArrayBuffer>): any => {
				console.log("Received a data channel message");

				if (!event.data) {
					console.error("Event contains no data:", event);
					return;
				}

				try {
					const inputStream: ByteArrayInputStream = new ByteArrayInputStream(event.data);
					const binaryDecoder: BinaryCompactDecoder = new BinaryCompactDecoder(inputStream);
					const schemaId = binaryDecoder.readUUID();
					const schemaVersion = binaryDecoder.readInt();
					const key: SchemaKey = new SchemaKey(schemaId, schemaVersion);
					const listener: PacketHandler | undefined = this.mBinaryListeners.get(key.toString());
					if (listener !== undefined) {
						const iq: BinaryPacketIQ = listener.serializer.deserialize(binaryDecoder) as BinaryPacketIQ;
						listener.handler(this, iq);
					} else {
						console.log("Schema " + key + " is not recognized");
					}
				} catch (exception) {
					console.error("Exception raised when handling data channel message", exception);
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
				this.mVideoSourceOn = true;
				break;
			case CallStatus.OUTGOING_CALL:
			case CallStatus.INCOMING_CALL:
			case CallStatus.ACCEPTED_INCOMING_CALL:
				this.mVideoSourceOn = false;
				break;
			case CallStatus.OUTGOING_VIDEO_CALL:
			case CallStatus.INCOMING_VIDEO_CALL:
			case CallStatus.ACCEPTED_INCOMING_VIDEO_CALL:
				this.mVideoSourceOn = true;
				break;
			case CallStatus.INCOMING_VIDEO_BELL:
			default:
				this.mVideoSourceOn = false;
				break;
		}
		this.mAudioDirection = audioDirection;
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
			transfer: false,
			version: "1.0.0",
		};
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
					console.error("Set remote failed: ", error);
				});
		} else {
			this.mMakingOffer = true;
			pc.createOffer(offerOptions)
				.then((description: RTCSessionDescriptionInit) => {
					console.log("SDP: ", description.sdp);
					pc.setLocalDescription(description)
						.then(() => {
							this.mMakingOffer = false;
							if (this.mTo && description.sdp) {
								if (description.type === "offer" || !this.mPeerConnectionId) {
									console.log("sending session-initiate with offer:", offer);
									this.mPeerCallService.sessionInitiate(this.mTo, description.sdp, offer);
								} else {
									console.log("sending session-accept with offer:", offer);
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
			for (const candidate of this.mIcePending) {
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
						console.error("setLocalDescription failed: ", reason);
					});
			})
			.catch((reason: any) => {
				console.error("createAnswer failed: ", reason);
			});
	}

	onTransportInfo(candidates: TransportCandidate[]): boolean {
		if (!this.mPeerConnection) {
			return false;
		}

		for (const candidate of candidates) {
			if (!candidate.removed) {
				const startPos: number = candidate.candidate.indexOf(" ufrag ") + 7;
				const endPos: number = candidate.candidate.indexOf(" ", startPos);
				const ufrag: string = candidate.candidate.substring(startPos, endPos);
				const c: RTCIceCandidateInit = {
					candidate: candidate.candidate,
					sdpMid: candidate.sdpMid,
					sdpMLineIndex: candidate.sdpMLineIndex,
					usernameFragment: ufrag,
				};

				const ice: RTCIceCandidate = new RTCIceCandidate(c);
				//console.log("Adding candidate ", ice);
				this.mPeerConnection.addIceCandidate(ice).then(
					() => {
						console.log("Add ice candidate ok ", ice);
					},
					(err) => {
						console.log("Add ice candidate error for %o : ", ice, err);
					}
				);
			}
		}
		return true;
	}

	private addListener(handler: PacketHandler): void {
		const key: SchemaKey = new SchemaKey(handler.serializer.schemaId, handler.serializer.schemaVersion);
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
			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "audio") {
					const sender: RTCRtpSender = transceiver.sender;
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
			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				console.log("TRANSCEIVER", transceiver.receiver.track.kind, transceiver);
				if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "video") {
					const sender: RTCRtpSender = transceiver.sender;
					this.mRenegotiationNeeded = true;
					if (direction !== "sendrecv" && direction !== "sendonly") {
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

			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "audio") {
					const sender: RTCRtpSender = transceiver.sender;
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

			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				console.log("TRANSCEIVER", transceiver.receiver.track.kind, transceiver);
				if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "video") {
					const sender: RTCRtpSender = transceiver.sender;
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
			const participant: CallParticipant | null = this.getMainParticipant();
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
			console.error("addRemoteTrack failed: ", ex);
		}
	}

	/**
	 * The track id was removed by the peer, update and if it was a known track return a message to send.
	 *
	 * @param {string} trackId the track id that was removed.
	 */
	removeRemoteTrack(trackId: string): void {
		const participant: CallParticipant | null = this.getMainParticipant();
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
		const participants: Array<CallParticipant> = Object.values(this.mParticipants);
		if (participants.length === 0 && this.mMainParticipant) {
			participants.push(this.mMainParticipant);
		}
		for (const participant of participants) {
			participant.release();
		}
		return participants;
	}

	/**
	 * Terminate the P2P connection after some error is detected.  Notify the peer if necessary.
	 *
	 * @param terminateReason the terminate reason.
	 * @param notifyPeer true if we must notify the peer.
	 */
	private terminateInternal(terminateReason: TerminateReason, notifyPeer: boolean): void {

		if (notifyPeer && this.mPeerConnectionId) {
			this.mPeerCallService.sessionTerminate(this.mPeerConnectionId, terminateReason);
		}
		this.mCallService.onTerminatePeerConnection(this, terminateReason);
		if (this.mPeerConnection) {
			this.mPeerConnection.close();
			this.mPeerConnection = null;
			this.mPeerConnectionId = null;
		}
	}

	private sendParticipantInfoIQ(): void {
		const name: string = this.mCall.getIdentityName();
		console.log("Sending participant with name=" + name);
		if (name == null || this.mOutDataChannel == null) {
			return;
		}
		const thumbnailData: ArrayBuffer = this.mCall.getIdentityAvatarData();
		const description: string = "";
		const memberId: string = this.mCall.getCallRoomMemberId() ?? "";
		try {
			const iq: ParticipantInfoIQ = new ParticipantInfoIQ(
				CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER,
				1,
				memberId,
				name,
				description,
				thumbnailData
			);
			const packet: ArrayBuffer = iq.serializeCompact();
			this.mOutDataChannel.send(packet);
		} catch (exception) {
			// empty
			console.error("Could not send ParticipantInfoIQ: ", exception);
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

		let imageUrl: string | null = null;
		const buffer: ArrayBuffer | null = iq.thumbnailData;
		if (buffer && buffer.byteLength > 0) {
			const data: Uint8Array = new Uint8Array(buffer, 0, buffer.byteLength);
			const blob = new Blob([data], { type: "image/jpeg" });
			const urlCreator = window.URL || window.webkitURL;
			imageUrl = urlCreator.createObjectURL(blob);
		}

		this.mMainParticipant.setInformation(iq.name, iq.description, imageUrl);
		this.mCall.onEventParticipant(this.mMainParticipant, CallParticipantEvent.EVENT_IDENTITY);
	}

	public sendTransferDoneIQ(): void {
		if (this.mOutDataChannel == null) {
			return;
		}
		try {
			const iq = new BinaryPacketIQ(CallConnection.IQ_TRANSFER_DONE_SERIALIZER, 1);
			const packet: ArrayBuffer = iq.serializeCompact();
			this.mOutDataChannel.send(packet);
		} catch (exception) {
			console.error("Could not send TransferDoneIQ:", exception);
		}
	}

	public sendPrepareTransferIQ(): void {
		console.log("sending PrepareTransferIQ to: ", this.mMainParticipant);
		if (this.mOutDataChannel == null) {
			return;
		}
		try {
			const iq = new BinaryPacketIQ(CallConnection.IQ_PREPARE_TRANSFER_SERIALIZER, 1);
			const packet: ArrayBuffer = iq.serializeCompact();
			this.mOutDataChannel.send(packet);
		} catch (exception) {
			console.error("Could not send PrepareTransferIQ:", exception);
		}
	}

	public onOnPrepareTransferIQ(): void {
		console.log("received OnPrepareTransferIQ from: ", this.mMainParticipant);
		this.mCallService.onOnPrepareTransfer(this);
	}

	public onTransferDoneIQ(): void {
		console.log("received TransferDoneIQ from: ", this.mMainParticipant);

		this.mCallService.onTransferDone(this);
	}

	public inviteCallRoom(): void {
		console.log("sending InviteCallRoomMessage");
		const callRoomId = this.getCall().getCallRoomId();
		if (this.mPeerConnectionId && callRoomId) {
			this.mPeerCallService.inviteCallRoom(this.mPeerConnectionId, callRoomId.toString(), this.mTo);
		}
	}

	public sendParticipantTransferIQ(memberId: string) {
		console.log("sending ParticipantTransferIQ to: ", this.mMainParticipant);
		if (this.mOutDataChannel == null) {
			return;
		}
		try {
			const iq = new ParticipantTransferIQ(CallConnection.IQ_PARTICIPANT_TRANSFER_SERIALIZER, 1, memberId);
			const packet: ArrayBuffer = iq.serializeCompact();
			this.mOutDataChannel.send(packet);
		} catch (exception) {
			console.error("Could not send ParticipantTransferIQ:", exception);
		}
	}
}
