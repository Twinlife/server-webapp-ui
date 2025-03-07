/*
 *  Copyright (c) 2021-2025 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */

const url = import.meta.env.VITE_PROXY_URL;
const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

export type TerminateReason =
	| "busy"
	| "cancel"
	| "connectivity-error"
	| "decline"
	| "disconnected"
	| "general-error"
	| "gone"
	| "revoked"
	| "success"
	| "expired"
	| "not-authorized"
	| "transfer-done"
	| "schedule"
	| "unknown";

export type TurnServer = {
	url: string;
	username: string;
	password: string;
};

export type CallMessage =
	| SessionInitiateMessage
	| SessionInitiateResponseMessage
	| SessionAcceptMessage
	| SessionUpdateMessage
	| TransportInfoMessage
	| SessionTerminateMessage
	| InviteCallRoomMessage
	| JoinCallRoomMessage
	| MemberJoinMessage
	| PingMessage;

export type Message = CallConfigMessage | CallMessage;

export type CallConfigMessage = {
	msg: string;
	turnServers: TurnServer[];
	maxSendFrameSize: number;
	maxSendFrameRate: number;
	maxReceivedFrameSize: number;
	maxReceivedFrameRate: number;
};

export type Offer = {
	audio: boolean;
	video: boolean;
	data: boolean;
	group: boolean | undefined;
	transfer: boolean | undefined;
	version: string;
};

export type SessionInitiateMessage = {
	msg: string;
	to: string;
	sdp: string;
	sessionId: string | null | undefined;
	offer: Offer;
	offerToReceive: Offer;
	maxFrameSize: number;
	maxFrameRate: number;
};

export type SessionInitiateResponseMessage = {
	msg: string;
	to: string;
	sessionId: string;
	status: "success" | "not-authorized" | "gone" | "schedule";
};

export type SessionAcceptMessage = {
	msg: string;
	sessionId: string;
	to: string;
	sdp: string;
	offer: Offer;
	offerToReceive: Offer;
};

export type SessionUpdateMessage = {
	msg: string;
	sessionId: string;
	updateType: string;
	sdp: string;
};

export type TransportCandidate = {
	candidate: string;
	sdpMid: string;
	sdpMLineIndex: number;
	removed: boolean;
};

export type TransportInfoMessage = {
	msg: string;
	sessionId: string;
	candidates: TransportCandidate[];
};

export type SessionTerminateMessage = {
	msg: string;
	sessionId: string;
	reason: TerminateReason;
};

export type InviteCallRoomMessage = {
	msg: "invite-call-room";
	sessionId: string;
	twincodeOutboundId: string;
	callRoomId: string;
	mode: 0;
	maxMemberCount: 0;
};

export type MemberStatus = "member-new" | "member-need-session" | "member-delete";

export type MemberInfo = {
	status: MemberStatus;
	memberId: string;
	sessionId: string | null;
};

export type JoinCallRoomMessage = {
	msg: string;
	callRoomId: string;
	sessionId: string;
	memberId: string;
	members: MemberInfo[];
};

export type MemberJoinMessage = {
	msg: string;
	sessionId: string | null;
	memberId: string;
	status: MemberStatus;
};

export type DeviceRingingMessage = {
	msg: string;
	sessionId: string | null;
};

export type PingMessage = {
	msg: string;
};

export interface PeerCallServiceObserver {
	onIncomingSessionInitiate(sessionId: string, peerId: string, sdp: string, offer: Offer): void;

	onSessionInitiate(to: string, sessionId: string, status: string): void;

	onSessionAccept(sessionId: string, sdp: string, offer: Offer, offerToReceive: Offer): void;

	onSessionUpdate(sessionId: string, updateType: string, sdp: string): void;

	onTransportInfo(sessionId: string, candidates: TransportCandidate[]): void;

	onSessionTerminate(sessionId: string | null, reason: TerminateReason): void;

	onJoinCallRoom(callRoomId: string, memberId: string, members: MemberInfo[]): void;

	onMemberJoin(sessionId: string | null, memberId: string, status: MemberStatus): void;

	onDeviceRinging(sessionId: string | null): void;

	onServerClose(): void;

	// Asks the CallService whether we have an active call.
	needConnection(): boolean;
}

type Timer = ReturnType<typeof setTimeout>;
type ReadyCallback = () => void;
const PING_TIMER: number = 15000; // 15s, must be at least 2 times faster than server websocket idle timeout
const CONNECT_TIMER: number = 15000; // 15s to connect for the websocket.
const RETRY_DELAY: number = 3000; // 3s pause between reconnection.
const MAX_RETRIES: number = 5;

// Websocket close code.  Use CLOSE_OK for normal close or a custom code in 3000..4999 range.
const CLOSE_OK: number = 1000;
const CLOSE_ERROR: number = 3000;
const CLOSE_PING_ERROR: number = 3001;
const CLOSE_TIMEOUT_ERROR: number = 3002;

export const DEFAULT_OFFER_TO_RECEIVE: Offer = {
	audio: true,
	video: true,
	data: true,
	group: false,
	transfer: false,
	version: "1.0.0",
};

/**
 * WebRTC session management to send/receive SDPs.
 */
export class PeerCallService {
	private socket: WebSocket | null = null;
	private callConfig: CallConfigMessage | null = null;
	private callObserver: PeerCallServiceObserver | null = null;
	private pingTimer: Timer | null = null;
	private connectTimer: Timer | null = null;
	private lastRecvTime: number = 0;
	private readyCallback: ReadyCallback | null = null;
	private readonly sessionId: string;
	private retryCount: number = 0;

	constructor() {
		// Generates a random secure string that identifies this web-socket client
		// in case we have to disconnect and re-connect to the server
		// (random bit string of 510 bits encoded in base64, we pick 6 bits per byte).
		const bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(85));
		let sid = "id-";
		for (let i = 0; i < bytes.length; i++) {
			const val: number = bytes[i] % 64;
			sid += "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-"[val];
		}
		this.sessionId = sid.toString();
		console.info("Using sessionId", this.sessionId);
	}

	/**
	 * Open the websocket connection to the server proxy if necessary and get the WebRTC configuration.
	 * Once we are ready, execute the readyCallback lambda which can now create the WebRTC peer connection
	 * and start a session-initiate.
	 *
	 * @param readyCallback callback execute when we are ready to create WebRTC peer connection.
	 */
	onReady(readyCallback: () => void): void {
		if (this.socket && this.callConfig) {
			readyCallback();
		} else {
			this.readyCallback = readyCallback;
			this.setupWebsocket();
		}
	}

	private setupWebsocket(): void {
		// Give the session id in the protocols part.
		this.socket = new WebSocket(url);
		this.socket.onopen = (_event: Event) => {
			if (DEBUG) {
				console.log("Websocket is opened");
			}
			this.retryCount = 0;
			this.socket?.send('{"msg":"session-request","session-id":"' + this.sessionId + '"}');
			if (this.connectTimer) {
				clearTimeout(this.connectTimer);
				this.connectTimer = null;
			}
		};

		this.socket.onmessage = (msg: MessageEvent) => {
			let req: Message;
			try {
				req = JSON.parse(msg.data.toString());
			} catch (ignored) {
				return;
			}
			if (DEBUG) {
				console.log("Received message ", req);
			}
			this.lastRecvTime = performance.now();
			if (req.msg === "session-config") {
				this.callConfig = req as CallConfigMessage;
				if (this.readyCallback) {
					if (DEBUG) {
						console.log("Now ready to start WebRTC connections");
					}
					this.readyCallback();
					this.readyCallback = null;
				}
			} else if (req.msg === "session-accept") {
				if (this.callObserver) {
					const sessionAccept: SessionAcceptMessage = req as SessionAcceptMessage;
					this.callObserver.onSessionAccept(
						sessionAccept.sessionId,
						sessionAccept.sdp,
						sessionAccept.offer,
						sessionAccept.offerToReceive,
					);
				}
			} else if (req.msg === "session-update") {
				if (this.callObserver) {
					const sessionUpdate: SessionUpdateMessage = req as SessionUpdateMessage;
					this.callObserver.onSessionUpdate(
						sessionUpdate.sessionId,
						sessionUpdate.updateType,
						sessionUpdate.sdp,
					);
				}
			} else if (req.msg === "transport-info") {
				if (this.callObserver) {
					const transportInfo: TransportInfoMessage = req as TransportInfoMessage;
					this.callObserver.onTransportInfo(transportInfo.sessionId, transportInfo.candidates);
				}
			} else if (req.msg === "session-terminate") {
				if (this.callObserver) {
					const sessionTerminate: SessionTerminateMessage = req as SessionTerminateMessage;
					this.callObserver.onSessionTerminate(sessionTerminate.sessionId, sessionTerminate.reason);
				}
			} else if (req.msg === "session-initiate-response") {
				if (this.callObserver) {
					const initResponse: SessionInitiateResponseMessage = req as SessionInitiateResponseMessage;

					if (initResponse.status === "success") {
						this.callObserver.onSessionInitiate(
							initResponse.to,
							initResponse.sessionId,
							initResponse.status,
						);
					} else {
						this.callObserver.onSessionTerminate(null, initResponse.status);
					}
				}
			} else if (req.msg === "session-initiate") {
				if (this.callObserver) {
					const sessionInitiate: SessionInitiateMessage = req as SessionInitiateMessage;
					if (sessionInitiate.sessionId) {
						this.callObserver.onIncomingSessionInitiate(
							sessionInitiate.sessionId,
							sessionInitiate.to,
							sessionInitiate.sdp,
							sessionInitiate.offer,
						);
					}
				}
			} else if (req.msg === "join-callroom") {
				if (this.callObserver) {
					const joinRoom: JoinCallRoomMessage = req as JoinCallRoomMessage;
					this.callObserver.onJoinCallRoom(joinRoom.callRoomId, joinRoom.memberId, joinRoom.members);
				}
			} else if (req.msg === "member-join") {
				if (this.callObserver) {
					const memberJoin: MemberJoinMessage = req as MemberJoinMessage;
					this.callObserver.onMemberJoin(memberJoin.sessionId, memberJoin.memberId, memberJoin.status);
				}
			} else if (req.msg === "device-ringing") {
				if (this.callObserver) {
					const deviceRinging: DeviceRingingMessage = req as DeviceRingingMessage;
					this.callObserver.onDeviceRinging(deviceRinging.sessionId);
				}
			} else if (req.msg === "pong") {
				if (DEBUG) {
					console.log("Received pong");
				}
			} else {
				if (DEBUG) {
					// Only for development: this is an error.
					console.error("Unsupported message ", req);
				}
			}
		};

		this.socket.onclose = (event: CloseEvent) => {
			if (DEBUG) {
				console.log("Websocket is closed", event.code);
			}
			this.close(event.code, event.reason);
			// If the call is connected (or trying to connect), retry connection to the server.
			if (this.callObserver?.needConnection()) {
				console.info("Unexpected websocket close", event.code, "retry count", this.retryCount);
				if (this.retryCount < MAX_RETRIES) {
					setTimeout(() => {
						this.retryCount++;
						this.setupWebsocket();
					}, RETRY_DELAY);
				} else {
					this.callObserver?.onServerClose();
				}
			}
		};

		this.socket.onerror = (event: Event) => {
			if (DEBUG) {
				console.error("Websocket error", event);
			}
			this.close(CLOSE_ERROR, "websocket error on client");
			this.callObserver?.onSessionTerminate(null, "connectivity-error");
		};

		this.pingTimer = setInterval(() => {
			const now = performance.now();
			if (now - this.lastRecvTime > 2 * PING_TIMER) {
				this.close(CLOSE_PING_ERROR, "ping timeout");
			} else if (now - this.lastRecvTime > PING_TIMER) {
				// If we have an active call, proceed with ping/pong
				// otherwise close websocket.
				if (this.callObserver?.needConnection()) {
					this.ping();
				} else {
					this.close(CLOSE_OK, "normal close");
				}
			}
		}, PING_TIMER);

		this.connectTimer = setTimeout(() => {
			if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
				console.info("WebSocket connection timed out. Retrying...");
				this.close(CLOSE_TIMEOUT_ERROR, "connection timeout");
			}
		}, CONNECT_TIMER);
	}

	setObserver(observer: PeerCallServiceObserver): void {
		this.callObserver = observer;
	}

	private close(code: number, reason: string): void {
		if (this.pingTimer) {
			clearTimeout(this.pingTimer);
			this.pingTimer = null;
		}
		if (this.connectTimer) {
			clearTimeout(this.connectTimer);
			this.connectTimer = null;
		}
		if (this.socket) {
			try {
				this.socket.close(code, reason);
			} catch (exception) {
				if (DEBUG) {
					console.debug("Close error with code", code, "reason", reason, "exception", exception);
				}
			}
			this.socket = null;
		}
	}

	/**
	 * Get the WebRTC configuration to create the peer connection.
	 *
	 * @returns  the WebRTC configuration with turn servers.
	 */
	getConfiguration(): RTCConfiguration {
		const iceServers: Array<RTCIceServer> = [];
		if (this.callConfig) {
			for (let i = 0; i < this.callConfig.turnServers.length; i++) {
				const turnServer = this.callConfig.turnServers[i];
				iceServers.push({
					urls: turnServer.url,
					username: turnServer.username,
					credential: turnServer.password,
				});
			}
		}

		const result: RTCConfiguration = {
			iceServers: iceServers,
			bundlePolicy: "max-bundle",
			// sdpSemantics: "unified-plan",
			// rtcpMuxPolicy: 'require',
			// iceTransportPolicy: 'all'
		};
		return result;
	}

	sessionInitiate(to: string, sdp: string, offer: Offer) {
		const msg: SessionInitiateMessage = {
			msg: "session-initiate",
			to: to,
			sdp: sdp,
			offer: offer,
			offerToReceive: offer,
			maxFrameRate: 60,
			maxFrameSize: 921600,
			sessionId: null,
		};

		this.sendMessage(msg);
	}

	sessionAccept(sessionId: string, to: string, sdp: string, offer: Offer, offerToReceive: Offer) {
		const msg: SessionAcceptMessage = {
			msg: "session-accept",
			sessionId: sessionId,
			to: to,
			sdp: sdp,
			offer: offer,
			offerToReceive: offerToReceive,
		};

		this.sendMessage(msg);
	}

	sessionUpdate(sessionId: string, sdp: string, updateType: string) {
		const msg: SessionUpdateMessage = {
			msg: "session-update",
			sessionId: sessionId,
			sdp: sdp,
			updateType: updateType,
		};

		this.sendMessage(msg);
	}

	transportInfo(sessionId: string, candidate: string, label: string, index: number) {
		const msg: TransportInfoMessage = {
			msg: "transport-info",
			sessionId: sessionId,
			candidates: [
				{
					sdpMid: label,
					sdpMLineIndex: index,
					candidate: candidate,
					removed: false,
				},
			],
		};

		// console.log("send transport info to " + sessionId + " candidate " + candidate);
		this.sendMessage(msg);
	}

	sessionTerminate(sessionId: string, reason: TerminateReason) {
		const msg: SessionTerminateMessage = {
			msg: "session-terminate",
			sessionId: sessionId,
			reason: reason,
		};

		this.sendMessage(msg);
	}

	inviteCallRoom(sessionId: string, callRoomId: string, twincodeOutboundId: string) {
		const msg: InviteCallRoomMessage = {
			msg: "invite-call-room",
			sessionId: sessionId,
			callRoomId: callRoomId,
			twincodeOutboundId: twincodeOutboundId,
			mode: 0,
			maxMemberCount: 0,
		};

		this.sendMessage(msg);
	}

	private ping(): void {
		const msg: PingMessage = {
			msg: "ping",
		};
		this.sendMessage(msg);
	}

	private sendMessage(msg: CallMessage) {
		if (DEBUG) {
			console.log("Sending message ", msg);
		}
		this.socket?.send(JSON.stringify(msg));
	}
}
