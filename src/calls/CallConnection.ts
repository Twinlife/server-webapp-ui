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
import {
	DEFAULT_OFFER_TO_RECEIVE,
	Offer,
	PeerCallService,
	TerminateReason,
	TransportCandidate,
} from "../services/PeerCallService";
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
import { OnPushIQ } from "./OnPushIQ.ts";
import { ParticipantInfoIQ } from "./ParticipantInfoIQ";
import { ParticipantTransferIQ } from "./ParticipantTransferIQ.ts";
import { PushObjectIQ } from "./PushObjectIQ.ts";
import { PushTwincodeIQ } from "./PushTwincodeIQ.ts";

type PacketHandler = {
	serializer: Serializer;
	handler: (this: PacketHandler, callConnection: CallConnection, packet: BinaryPacketIQ) => unknown;
};

type Timer = ReturnType<typeof setTimeout>;

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

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
	// Label with data version and capabilities supported by the web app ('stream' is not supported yet).
	static readonly DATA_VERSION: string = "twinlife:data:conversation.CallService:1.3.0:group,transfer,message";
	static readonly CAP_MESSAGE: string = "message";

	static readonly CONNECT_TIMEOUT: number = 15000; // 15 second timeout between accept and connection.

	static readonly DEVICE_STATE: number = 2;

	private static readonly PARTICIPANT_INFO_SCHEMA_ID = UUID.fromString("a8aa7e0d-c495-4565-89bb-0c5462b54dd0");
	private static readonly IQ_PARTICIPANT_INFO_SERIALIZER = ParticipantInfoIQ.createSerializer(
		CallConnection.PARTICIPANT_INFO_SCHEMA_ID,
		1,
	);

	private static readonly TRANSFER_DONE_SCHEMA_ID = UUID.fromString("641bf1f6-ebbf-4501-9151-76abc1b9adad");
	private static readonly IQ_TRANSFER_DONE_SERIALIZER = BinaryPacketIQ.createDefaultSerializer(
		CallConnection.TRANSFER_DONE_SCHEMA_ID,
		1,
	);

	private static readonly PREPARE_TRANSFER_SCHEMA_ID = UUID.fromString("9eaa4ad1-3404-4bcc-875d-dc75c748e188");
	private static readonly IQ_PREPARE_TRANSFER_SERIALIZER = BinaryPacketIQ.createDefaultSerializer(
		CallConnection.PREPARE_TRANSFER_SCHEMA_ID,
		1,
	);

	private static readonly ON_PREPARE_TRANSFER_SCHEMA_ID = UUID.fromString("a17516a2-4bd2-4284-9535-726b6eb1a211");
	private static readonly IQ_ON_PREPARE_TRANSFER_SERIALIZER = BinaryPacketIQ.createDefaultSerializer(
		CallConnection.ON_PREPARE_TRANSFER_SCHEMA_ID,
		1,
	);

	private static readonly PARTICIPANT_TRANSFER_SCHEMA_ID = UUID.fromString("800fd629-83c4-4d42-8910-1b4256d19eb8");
	private static readonly IQ_PARTICIPANT_TRANSFER_SERIALIZER = ParticipantTransferIQ.createSerializer(
		CallConnection.PARTICIPANT_TRANSFER_SCHEMA_ID,
		1,
	);

	private static readonly PUSH_OBJECT_SCHEMA_ID = UUID.fromString("26e3a3bd-7db0-4fc5-9857-bbdb2032960e");
	static readonly IQ_PUSH_OBJECT_SERIALIZER = PushObjectIQ.createSerializer(CallConnection.PUSH_OBJECT_SCHEMA_ID, 5);

	private static readonly ON_PUSH_OBJECT_SCHEMA_ID = UUID.fromString("f95ac4b5-d20f-4e1f-8204-6d146dd5291e");
	private static readonly IQ_ON_PUSH_OBJECT_SERIALIZER = OnPushIQ.createSerializer(
		CallConnection.ON_PUSH_OBJECT_SCHEMA_ID,
		3,
	);

	private static readonly PUSH_TWINCODE_SCHEMA_ID = UUID.fromString("72863c61-c0a9-437b-8b88-3b78354e54b8");
	private static readonly IQ_PUSH_TWINCODE_SERIALIZER = PushTwincodeIQ.createSerializer(
		CallConnection.PUSH_TWINCODE_SCHEMA_ID,
		2,
	);

	private static readonly ON_PUSH_TWINCODE_SCHEMA_ID = UUID.fromString("e6726692-8fe6-4d29-ae64-ba321d44a247");
	private static readonly IQ_ON_PUSH_TWINCODE_SERIALIZER = OnPushIQ.createSerializer(
		CallConnection.ON_PUSH_TWINCODE_SCHEMA_ID,
		2,
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
	private mIceRemoteCandidates: Array<TransportCandidate> | null = null;
	private mRenegotiationNeeded: boolean = false;
	private mInitialized: boolean = false;
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
	private readonly mBinaryListeners: Map<string, PacketHandler> = new Map();

	private readonly mMainParticipant: CallParticipant;

	private mVideoTrackId: string | null = null;
	private mAudioTrackId: string | null = null;
	private mConnectionStartTime: number = 0;

	private mTimer: Timer | null = null;

	private mPeerConnected: boolean = false;
	private mPeerVersion: Version | null = null;

	private mStatus: CallStatus = CallStatus.TERMINATED;

	private mCallMemberId: string | null = null;
	private mMessageSupported: boolean | null = null;
	/**
	 * If not null, this connection's main participant is currently in transfer towards this memberId.
	 */
	transferToMemberId: string | null = null;

	/**
	 * Get the main call participant.
	 *
	 * @return {CallParticipant} the main participant of this call.
	 */
	public getMainParticipant(): CallParticipant {
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

	/**
	 * Check if this connection supports sending and receiving messages.
	 *
	 * @return {boolean} NULL if we don't know, TRUE if P2P messages are supported.
	 */
	public isMessageSupported(): boolean | null {
		return this.mMessageSupported;
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
		transfer: boolean = false,
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
		this.mCallMemberId = memberId;
		this.mParticipants = new Map();
		this.mMainParticipant = new CallParticipant(this, call.allocateParticipantId(), transfer);

		this.mTimer = setTimeout(() => {
			this.mCallService.callTimeout(this);
		}, CallService.CALL_TIMEOUT);

		if (peerConnectionId != null) {
			if (DEBUG) {
				console.log(peerConnectionId, ": create incoming P2P");
			}
			this.mParticipants.set(peerConnectionId, this.mMainParticipant);
			// Note: we don't call onAddParticipant() here because this new CallConnection()
			// is not yet part of the CallState() and the observer will obtain an incorrect
			// value if it calls getParticipants() to have the complete list.  It will be
			// called from CallState.addPeerConnection().
		} else {
			if (DEBUG) {
				console.log("create outgoing P2P (no sessionId yet)");
			}
		}
		this.addListener({
			serializer: CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER,
			handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
				return callConnection.onParticipantInfoIQ(iq);
			},
		});
		this.addListener({
			serializer: CallConnection.IQ_PARTICIPANT_TRANSFER_SERIALIZER,
			handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
				callConnection.onParticipantTransferIQ(iq);
			},
		});

		this.addListener({
			serializer: CallConnection.IQ_PREPARE_TRANSFER_SERIALIZER,
			handler: (callConnection: CallConnection, _: BinaryPacketIQ) => {
				callConnection.onPrepareTransferIQ();
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
		this.addListener({
			serializer: CallConnection.IQ_PUSH_OBJECT_SERIALIZER,
			handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
				callConnection.onPushObjectIQ(iq);
			},
		});
		this.addListener({
			serializer: CallConnection.IQ_ON_PUSH_OBJECT_SERIALIZER,
			handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
				callConnection.onPushObjectResponseIQ(iq);
			},
		});
		this.addListener({
			serializer: CallConnection.IQ_PUSH_TWINCODE_SERIALIZER,
			handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
				callConnection.onPushTwincodeIQ(iq);
			},
		});
		this.addListener({
			serializer: CallConnection.IQ_ON_PUSH_TWINCODE_SERIALIZER,
			handler: (callConnection: CallConnection, iq: BinaryPacketIQ) => {
				callConnection.onPushObjectResponseIQ(iq);
			},
		});

		const config: RTCConfiguration = peerCallService.getConfiguration();
		const pc: RTCPeerConnection = new RTCPeerConnection(config);
		this.mPeerConnection = pc;

		// Handle ICE connection state.
		pc.oniceconnectionstatechange = (_event: Event) => {
			if (this.mPeerConnection) {
				const state = this.mPeerConnection.iceConnectionState;
				console.info(this.mPeerConnectionId, ": IceConnectionState ", state);
				if (state === "connected" || state === "completed") {
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
								this.mPeerConnection.restartIce();
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
					candidate.sdpMLineIndex,
				);
			}
		};

		pc.onicecandidateerror = (event: Event) => {
			console.warn(this.mPeerConnectionId, ": ice candidate error:", event);
		};

		// Handle signaling state errors.
		pc.onsignalingstatechange = (_event: Event) => {
			if (this.mPeerConnection) {
				const signalingState = this.mPeerConnection.signalingState;
				console.info(this.mPeerConnectionId, "signalingstate", signalingState);
				if (signalingState === "closed" && this.mPeerConnectionId) {
					this.mPeerCallService.sessionTerminate(this.mPeerConnectionId, "connectivity-error");
				}
			}
		};

		// Handle WebRTC renegotiation to send a new offer.
		pc.onnegotiationneeded = (_event: Event) => {
			if (!this.mRenegotiationNeeded || !this.mPeerConnection) {
				return;
			}
			if (DEBUG) {
				console.log(this.mPeerConnectionId, ": onnegotiationneeded");
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
				.catch((reason: unknown) => {
					console.error(
						this.mPeerConnectionId,
						"setLocalDescription failed after onnegotiationneeded:",
						reason,
					);
				});
		};

		// Handle the audio/video track.
		pc.ontrack = (event: RTCTrackEvent) => {
			if (DEBUG) {
				console.log(this.mPeerConnectionId, ": received on track event");
			}

			// Legacy streams (does nothing on modern WebRTC)
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
			channel.onopen = (_event: Event): void => {
				const label: string = channel.label;

				// CallService:<version>:<capability>,...,<capability>.
				const items = label.split(/[:,]/);
				this.mMessageSupported = false;
				if (items.length >= 3) {
					for (let i = items.length; --i >= 1; ) {
						if (items[i] == CallConnection.CAP_MESSAGE) {
							this.mMessageSupported = true;
						}
					}
				}
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": onopen data channel ", label);
				}
				const participant: CallParticipant | null = this.getMainParticipant();
				if (participant) {
					this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_SUPPORTS_MESSAGES);
				}
			};
			channel.onmessage = (event: MessageEvent<ArrayBuffer>): void => {
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": received a data channel message");
				}

				if (!event.data) {
					console.warn(this.mPeerConnectionId, ": event contains no data:", event);
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
						if (DEBUG) {
							console.log(this.mPeerConnectionId, ": unknown schema ", key);
						}
					}
				} catch (exception) {
					console.warn(
						this.mPeerConnectionId,
						": exception raised when handling data channel message",
						exception,
					);
				}
			};
		};

		// Setup the output data channel.
		this.mOutDataChannel = pc.createDataChannel(CallConnection.DATA_VERSION);
		this.mOutDataChannel.onopen = (_event: Event): void => {
			if (DEBUG) {
				console.log(this.mPeerConnectionId, ": output data channel is now opened");
			}
			if (this.mOutDataChannel && this.mCall) {
				this.sendParticipantInfoIQ();
			}
		};

		if (mediaStream) {
			mediaStream.getTracks().forEach((track) => {
				if (DEBUG) {
					if (this.mPeerConnectionId) {
						console.log(this.mPeerConnectionId, ": found", track.kind, "track", track.id);
					} else {
						console.log("Found", track.kind, "track", track.id);
					}
				}
				if (track.kind === "audio") {
					this.mAudioTrack = track;
					pc.addTrack(track, mediaStream);
				} else if (track.kind === "video") {
					this.mVideoTrack = track;
					pc.addTrack(track, mediaStream);
				}
			});
		}

		this.mAudioDirection = audioDirection;
		const videoSourceOn = callService.isVideoSourceOn();
		if (videoSourceOn) {
			this.mVideoDirection = "sendrecv";
		}

		const offerOptions: RTCOfferOptions = {
			offerToReceiveAudio: true,
			offerToReceiveVideo: true,
		};
		const offer: Offer = {
			audio: true,
			video: videoSourceOn,
			data: true,
			group: false,
			transfer: false,
			version: "1.0.0",
		};
		if (sdp) {
			this.mMakingOffer = false;
			this.mRemoteAnswerPending = true;
			pc.setRemoteDescription({
				sdp: sdp,
				type: "offer",
			})
				.then(() => {
					if (DEBUG) {
						console.log(this.mPeerConnectionId, ": set remote is done");
					}
					this.mRemoteAnswerPending = false;
					this.createAnswer(offer);
				})
				.catch((error: unknown) => {
					console.error(this.mPeerConnectionId, ": set remote failed:", error);
					this.mRemoteAnswerPending = false;
				});
		} else {
			this.mMakingOffer = true;
			pc.createOffer(offerOptions)
				.then((description: RTCSessionDescriptionInit) => {
					if (DEBUG) {
						if (this.mPeerConnectionId) {
							console.log(this.mPeerConnectionId, ": SDP: ", description.sdp);
						} else {
							console.log("First SDP: ", description.sdp);
						}
					}
					pc.setLocalDescription(description)
						.then(() => {
							this.mMakingOffer = false;
							if (this.mTo && description.sdp && description.type === "offer") {
								if (DEBUG) {
									if (this.mPeerConnectionId) {
										console.log(
											this.mPeerConnectionId,
											": sending session-initiate with offer:",
											offer,
										);
									} else {
										console.log("Sending first session-initiate with offer:", offer);
									}
								}
								this.mInitialized = true;
								this.mPeerCallService.sessionInitiate(this.mTo, description.sdp, offer);
							}
						})
						.catch((reason: unknown) => {
							console.error(this.mPeerConnectionId, ": setLocalDescription failed:", reason);
						});
				})
				.catch((reason: unknown) => {
					console.error(this.mPeerConnectionId, ": createOffer failed:", reason);
				});
		}
	}

	onSessionInitiate(sessionId: string): void {
		if (DEBUG) {
			console.log(sessionId, ": session-initiate created");
		}
		this.mPeerConnectionId = sessionId;
		this.mParticipants.set(sessionId, this.mMainParticipant);
		this.mCall.onAddParticipant(this.mMainParticipant);
		if (this.mIcePending && this.mIcePending.length > 0) {
			if (DEBUG) {
				console.log(sessionId, ": flush ", this.mIcePending.length, " candidates");
			}
			for (const candidate of this.mIcePending) {
				if (candidate.candidate && candidate.sdpMid != null && candidate.sdpMLineIndex != null) {
					this.mPeerCallService.transportInfo(
						sessionId,
						candidate.candidate,
						candidate.sdpMid,
						candidate.sdpMLineIndex,
					);
				}
			}
		}
		this.mIcePending = null;
	}

	onSessionAccept(sdp: string, offer: Offer, _offerToReceive: Offer): boolean {
		if (!this.mPeerConnection) {
			return false;
		}
		this.setPeerVersion(new Version(offer.version));

		this.mRemoteAnswerPending = true;
		this.mPeerConnection
			.setRemoteDescription({
				sdp: sdp,
				type: "answer",
			})
			.then(() => {
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": set remote is done");
				}
				this.mRemoteAnswerPending = false;
				// WebRTC accepts ICE candidates only when it has both the local description
				// and the remote description.  If we call addIceCandidates too early, they are dropped.
				if (this.mInitialized) {
					this.checkRemoteCandidates();
				}
			})
			.catch((error: unknown) => {
				this.mRemoteAnswerPending = false;
				console.error(this.mPeerConnectionId, ": set remote failed:", error);
			});
		if (this.mTimer) {
			clearTimeout(this.mTimer);
		}
		this.mTimer = setTimeout(() => {
			this.mCallService.callTimeout(this);
		}, CallConnection.CONNECT_TIMEOUT);
		return true;
	}

	async onSessionUpdate(updateType: string, sdp: string): Promise<boolean> {
		return await new Promise<boolean>((resolve) => {
			if (!this.mPeerConnection) {
				resolve(false);
				return; // Return because we have no P2P connection.
			}
			const isOffer: boolean = updateType === "offer";
			const state: RTCSignalingState = this.mPeerConnection.signalingState;
			const readyForOffer: boolean = !this.mMakingOffer && (state === "stable" || this.mRemoteAnswerPending);
			const offerCollision: boolean = isOffer && !readyForOffer;
			this.mIgnoreOffer = !this.mInitiator && offerCollision;
			if (this.mIgnoreOffer || (state === "stable" && !isOffer)) {
				console.info(this.mPeerConnectionId, "onSessionUpdate ignore offer due to answer/offer collision");
				resolve(true);
				return; // Return now because we must not proceed and we must ignore the remote description.
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
					resolve(true);
				})
				.catch((reason: unknown) => {
					this.mRemoteAnswerPending = false;
					console.error(this.mPeerConnectionId, "setRemoteDescription failed:", reason);
					resolve(false);
				});
		});
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
									offer,
									DEFAULT_OFFER_TO_RECEIVE,
								);
								this.checkRemoteCandidates();
							} else {
								this.mPeerCallService.sessionUpdate(this.mPeerConnectionId, description.sdp, "answer");
							}
						}
					})
					.catch((reason: unknown) => {
						console.error(this.mPeerConnectionId, "setLocalDescription failed:", reason);
					});
			})
			.catch((reason: unknown) => {
				console.error(this.mPeerConnectionId, "createAnswer failed:", reason);
			});
	}

	onTransportInfo(candidates: TransportCandidate[]): boolean {
		if (!this.mPeerConnection) {
			return false;
		}

		// WebRTC accepts ICE candidates only when it has both the local description
		// and the remote description.  If we call addIceCandidates too early, they are dropped.
		if (!this.mInitialized) {
			if (!this.mIceRemoteCandidates) {
				this.mIceRemoteCandidates = candidates;
			} else {
				this.mIceRemoteCandidates.push(...candidates);
			}
			return true;
		}

		for (const candidate of candidates) {
			if (!candidate.removed) {
				const startPos: number = candidate.candidate.indexOf(" ufrag ") + 7;
				let c: RTCIceCandidateInit;
				if (startPos > 7) {
					const endPos: number = candidate.candidate.indexOf(" ", startPos);
					const ufrag: string = candidate.candidate.substring(startPos, endPos);
					c = {
						candidate: candidate.candidate,
						sdpMid: candidate.sdpMid,
						sdpMLineIndex: candidate.sdpMLineIndex,
						usernameFragment: ufrag,
					};
				} else {
					c = {
						candidate: candidate.candidate,
						sdpMid: candidate.sdpMid,
						sdpMLineIndex: candidate.sdpMLineIndex,
					};
				}
				const ice: RTCIceCandidate = new RTCIceCandidate(c);
				//console.log("Adding candidate ", ice);
				this.mPeerConnection.addIceCandidate(ice).then(
					() => {
						if (DEBUG) {
							console.log(this.mPeerConnectionId, ": add ice candidate ok ", ice);
						}
					},
					(err) => {
						console.error(this.mPeerConnectionId, ": add ice candidate error for %o : ", ice, err);
					},
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
		if (state !== "connected" && state !== "completed") {
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

	setDeviceRinging(): void {
		const participant: CallParticipant | null = this.getMainParticipant();
		if (participant) {
			this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_RINGING);
		}
	}

	setAudioDirection(direction: RTCRtpTransceiverDirection): void {
		this.mAudioDirection = direction;
		if (this.mPeerConnection != null && this.mAudioTrack) {
			if (this.mConnectionState === "connected" || this.mConnectionState === "completed") {
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": enable audio track");
				}
				this.mAudioTrack.enabled = direction === "sendrecv";
			}
			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				const currentDirection = transceiver.currentDirection;
				if (currentDirection !== "stopped" && transceiver.receiver.track.kind === "audio") {
					const sender: RTCRtpSender = transceiver.sender;
					if (currentDirection != direction) {
						if (DEBUG) {
							console.log(
								this.mPeerConnectionId,
								": changing direction from",
								currentDirection,
								"to",
								direction,
							);
						}
						this.mRenegotiationNeeded = true;
						transceiver.direction = direction;
					}
					if (direction !== "sendrecv") {
						sender.replaceTrack(null);
					} else {
						sender.replaceTrack(this.mAudioTrack);
					}
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
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": enable video track");
				}
			}
			if (DEBUG) {
				console.log(
					this.mPeerConnectionId,
					": video track enabled=" +
						this.mVideoTrack.enabled +
						" state=" +
						this.mConnectionState +
						" dir=" +
						direction,
				);
			}
			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": TRANSCEIVER", transceiver.receiver.track.kind, transceiver);
				}
				const currentDirection = transceiver.currentDirection;
				if (currentDirection !== "stopped" && transceiver.receiver.track.kind === "video") {
					const sender: RTCRtpSender = transceiver.sender;
					if (currentDirection != direction) {
						if (DEBUG) {
							console.log(
								this.mPeerConnectionId,
								": changing direction from",
								currentDirection,
								"to",
								direction,
							);
						}
						this.mRenegotiationNeeded = true;
						transceiver.direction = direction;
					}
					if (direction !== "sendrecv" && direction !== "sendonly") {
						sender.replaceTrack(null);
					} else {
						sender.replaceTrack(this.mVideoTrack);
					}
					break;
				}
			}
		}
	}

	stopVideoTrack(): void {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": stop video track");
		}

		if (this.mPeerConnection != null && this.mVideoTrack) {
			this.mVideoTrack = null;
			this.mVideoTrackId = null;

			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				if (
					transceiver.currentDirection !== "stopped" &&
					transceiver.receiver.track.kind === "video" &&
					transceiver.currentDirection !== "inactive"
				) {
					const sender: RTCRtpSender = transceiver.sender;
					this.mRenegotiationNeeded = true;
					sender.replaceTrack(null);
					transceiver.direction = "recvonly";
					break;
				}
			}
		}
	}

	replaceAudioTrack(track: MediaStreamTrack): void {
		if (this.mPeerConnection != null && this.mAudioTrack) {
			if (DEBUG) {
				console.log(this.mPeerConnectionId, ": replace Audio Track", track.label);
			}
			this.mAudioTrack = track;

			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			for (const transceiver of transceivers) {
				if (transceiver.currentDirection !== "stopped" && transceiver.receiver.track.kind === "audio") {
					const sender: RTCRtpSender = transceiver.sender;
					// Replace the audio track (no renegociation needed).
					sender.replaceTrack(this.mAudioTrack);
					break;
				}
			}
		}
	}

	addVideoTrack(track: MediaStreamTrack) {
		// Don't add this track on the peer connection if it's already associated with an RTCRtpSender
		if (this.mVideoTrack === track) {
			return;
		}

		this.replaceVideoTrack(track);
	}

	replaceVideoTrack(track: MediaStreamTrack): void {
		this.mVideoTrack = track;
		if (this.mPeerConnection != null) {
			if (DEBUG) {
				console.log(this.mPeerConnectionId, ": replace Video Track to", track.label);
			}

			const transceivers: RTCRtpTransceiver[] = this.mPeerConnection.getTransceivers();
			let sender: RTCRtpSender | null = null;
			for (const transceiver of transceivers) {
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": TRANSCEIVER", transceiver.receiver.track.kind, transceiver);
				}
				const currentDirection = transceiver.currentDirection;
				if (currentDirection !== "stopped" && transceiver.receiver.track.kind === "video") {
					sender = transceiver.sender;
					if (currentDirection != "sendrecv") {
						if (DEBUG) {
							console.log(
								this.mPeerConnectionId,
								": changing direction from",
								currentDirection,
								"to",
								"sendrecv",
							);
						}
						this.mRenegotiationNeeded = true;
						transceiver.direction = "sendrecv";
					}
					sender.replaceTrack(this.mVideoTrack);
				}
			}

			// When no sender was found for the track, use addTrack().
			if (sender == null) {
				if (DEBUG) {
					console.log(this.mPeerConnectionId, ": no transceiver adding track");
				}
				this.mRenegotiationNeeded = true;
				this.mPeerConnection.addTrack(track);
			}
		}
	}

	/**
	 * Terminate the peer connection with the terminate reason and release the
	 * WebRTC peer connection.
	 *
	 * @param terminateReason the terminate reason
	 * @returns the peer connection id or null (if terminated before the creation, or, it is already terminated).
	 */
	terminate(terminateReason: TerminateReason): string | null {
		const sessionId: string | null = this.mPeerConnectionId;
		if (sessionId != null) {
			if (DEBUG) {
				console.log(sessionId, ": session-terminate with ", terminateReason);
			}
			this.mPeerCallService.sessionTerminate(sessionId, terminateReason);
			this.mPeerConnectionId = null;
		}

		if (this.mPeerConnection) {
			this.mPeerConnection.close();
			this.mPeerConnection = null;
		}
		return sessionId;
	}

	private addRemoteTrack(track: MediaStreamTrack, _stream: MediaStream): void {
		try {
			const participant: CallParticipant | null = this.getMainParticipant();
			if (participant && track != null) {
				const trackId: string = track.id;
				participant.addTrack(track);
				if (track.kind === "video") {
					this.mVideoTrackId = trackId;
					participant.setCameraMute(false);
					this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_VIDEO_ON);
					track.onmute = () => {
						this.removeRemoteTrack(trackId);
					};
				} else if (track.kind === "audio") {
					this.mAudioTrackId = trackId;
					participant.setMicrophoneMute(false);
					this.mCall.onEventParticipant(participant, CallParticipantEvent.EVENT_AUDIO_ON);
					track.onmute = () => {
						this.removeRemoteTrack(trackId);
					};
				}
			}
		} catch (ex) {
			console.error(this.mPeerConnectionId, "addRemoteTrack failed:", ex);
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

	private checkRemoteCandidates(): void {
		this.mInitialized = true;
		const candidates: TransportCandidate[] | null = this.mIceRemoteCandidates;
		if (candidates) {
			if (DEBUG) {
				console.log(this.mPeerConnectionId, ": using ", candidates.length, " ICE candidates which are queued");
			}
			this.mIceRemoteCandidates = null;
			this.onTransportInfo(candidates);
		}
	}

	/**
	 * Terminate the P2P connection after some error is detected.  Notify the peer if necessary.
	 *
	 * @param terminateReason the terminate reason.
	 * @param notifyPeer true if we must notify the peer.
	 */
	private terminateInternal(terminateReason: TerminateReason, notifyPeer: boolean): void {
		const sessionId: string | null = this.mPeerConnectionId;
		if (notifyPeer && sessionId) {
			this.mPeerCallService.sessionTerminate(sessionId, terminateReason);
			this.mPeerConnectionId = null;
		}
		this.mCallService.onTerminatePeerConnection(sessionId, this, terminateReason);
		if (this.mPeerConnection) {
			this.mPeerConnection.close();
			this.mPeerConnection = null;
			this.mPeerConnectionId = null;
		}
	}

	public sendParticipantInfoIQ(): void {
		const name: string = this.mCall.getIdentityName();
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": sending participant with name=" + name);
		}
		if (name == null || this.mOutDataChannel == null) {
			return;
		}
		const thumbnailData: ArrayBuffer = this.mCall.getIdentityAvatarData();
		const description: string = "";
		const memberId: string = this.mCall.getCallRoomMemberId() ?? "";
		const iq: ParticipantInfoIQ = new ParticipantInfoIQ(
			CallConnection.IQ_PARTICIPANT_INFO_SERIALIZER,
			1,
			memberId,
			name,
			description,
			thumbnailData,
		);
		this.sendMessage(iq);
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

		if (this.mMainParticipant.transferredFromParticipantId != null) {
			// The participant is a transfer target, ignore the info
			// because we already copied it from the transferred participant.
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
		const iq = new BinaryPacketIQ(CallConnection.IQ_TRANSFER_DONE_SERIALIZER, 1);
		this.sendMessage(iq);
	}

	public sendPrepareTransferIQ(): void {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": sending PrepareTransferIQ to: ", this.mMainParticipant);
		}
		const iq = new BinaryPacketIQ(CallConnection.IQ_PREPARE_TRANSFER_SERIALIZER, 1);
		this.sendMessage(iq);
	}

	sendMessage(iq: BinaryPacketIQ): boolean {
		if (this.mOutDataChannel == null) {
			return false;
		}
		try {
			const packet: ArrayBuffer = iq.serializeCompact();
			this.mOutDataChannel.send(packet);
			return true;
		} catch (exception) {
			console.warn(this.mPeerConnectionId, ": could not send iq:", exception);
			return false;
		}
	}

	public onParticipantTransferIQ(iq: BinaryPacketIQ): void {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": received ParticipantTransferIQ from: ", this.mMainParticipant);
		}

		if (!(iq != null && iq instanceof ParticipantTransferIQ)) {
			return;
		}

		this.transferToMemberId = iq.memberId;

		this.mCall.onEventParticipantTransfer(iq.memberId);
	}

	public onPrepareTransferIQ(): void {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": received PrepareTransferIQ from: ", this.mMainParticipant);
		}

		if (!this.mPeerConnectionId) {
			return;
		}

		this.mCall.onPrepareTransfer(this);

		this.sendMessage(new BinaryPacketIQ(CallConnection.IQ_ON_PREPARE_TRANSFER_SERIALIZER, 1));
	}

	public onOnPrepareTransferIQ(): void {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": received OnPrepareTransferIQ from: ", this.mMainParticipant);
		}
		this.mCallService.onOnPrepareTransfer(this);
	}

	public onTransferDoneIQ(): void {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": received TransferDoneIQ from: ", this.mMainParticipant);
		}

		this.mCallService.onTransferDone(this);
	}

	/**
	 * Handle the PushObjectIQ message from the peer.
	 *
	 * @param iq {BinaryPacketIQ} iq the push message iq.
	 */
	private onPushObjectIQ(iq: BinaryPacketIQ): void {
		if (!(iq != null && iq instanceof PushObjectIQ)) {
			return;
		}

		const pushObjectIQ: PushObjectIQ = iq as PushObjectIQ;
		pushObjectIQ.descriptor.receivedTimestamp = Date.now();
		this.mMainParticipant.updateSenderId(pushObjectIQ.descriptor.twincodeOutboundId);
		this.mCall.onPopDescriptor(this.mMainParticipant, pushObjectIQ.descriptor);

		const onPushObjectIQ: OnPushIQ = new OnPushIQ(
			CallConnection.IQ_ON_PUSH_OBJECT_SERIALIZER,
			iq.getRequestId(),
			CallConnection.DEVICE_STATE,
			pushObjectIQ.descriptor.receivedTimestamp,
		);
		this.sendMessage(onPushObjectIQ);
	}

	/**
	 * Handle the PushTwincodeIQ message from the peer.
	 *
	 * @param iq {BinaryPacketIQ} iq the push message iq.
	 */
	private onPushTwincodeIQ(iq: BinaryPacketIQ): void {
		if (!(iq != null && iq instanceof PushTwincodeIQ)) {
			return;
		}

		const pushTwincodeIQ: PushTwincodeIQ = iq as PushTwincodeIQ;
		pushTwincodeIQ.twincodeDescriptor.receivedTimestamp = Date.now();
		this.mCall.onPopDescriptor(this.mMainParticipant, pushTwincodeIQ.twincodeDescriptor);

		const onPushObjectIQ: OnPushIQ = new OnPushIQ(
			CallConnection.IQ_ON_PUSH_TWINCODE_SERIALIZER,
			iq.getRequestId(),
			CallConnection.DEVICE_STATE,
			pushTwincodeIQ.twincodeDescriptor.receivedTimestamp,
		);
		this.sendMessage(onPushObjectIQ);
	}

	/**
	 * Handle the OnPushIQ message from the peer.
	 *
	 * @param iq {BinaryPacketIQ} iq the push message iq.
	 */
	private onPushObjectResponseIQ(iq: BinaryPacketIQ): void {
		if (!(iq != null && iq instanceof OnPushIQ)) {
			return;
		}
	}

	public inviteCallRoom(): void {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": sending InviteCallRoomMessage");
		}
		const callRoomId = this.getCall().getCallRoomId();
		if (this.mPeerConnectionId && callRoomId) {
			this.mPeerCallService.inviteCallRoom(this.mPeerConnectionId, callRoomId.toString(), this.mTo);
		}
	}

	public sendParticipantTransferIQ(memberId: string) {
		if (DEBUG) {
			console.log(this.mPeerConnectionId, ": sending ParticipantTransferIQ to: ", this.mMainParticipant);
		}
		const iq = new ParticipantTransferIQ(CallConnection.IQ_PARTICIPANT_TRANSFER_SERIALIZER, 1, memberId);
		this.sendMessage(iq);
	}
}
