/*
 *  Copyright (c) 2021-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

import config from "../config.json";

const url = config.proxy_url;

export type TerminateReason =
	| "busy"
	| "cancel"
	| "connectivity-error"
	| "decline"
	| "general-error"
	| "gone"
	| "revoked"
	| "success"
	| "expired"
	| "not-authorized"
	| "unknown";

export type TurnServer = {
	url: string;
	username: string;
	password: string;
};

export type Message = {
	msg: string;
};

export type RequestMessage = {
	msg: string;
};

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
	status: string;
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

export interface PeerCallServiceObserver {
	onIncomingSessionInitiate(sessionId: string, peerId: string, sdp: string, offer: Offer): void;

	onSessionInitiate(to: string, sessionId: string, status: string): void;

	onSessionAccept(sessionId: string, sdp: string, offer: Offer, offerToReceive: Offer): void;

	onSessionUpdate(sessionId: string, updateType: string, sdp: string): void;

	onTransportInfo(sessionId: string, candidates: TransportCandidate[]): void;

	onSessionTerminate(sessionId: string, reason: TerminateReason): void;

	onJoinCallRoom(callRoomId: string, memberId: string, members: MemberInfo[]): void;

	onMemberJoin(sessionId: string | null, memberId: string, status: MemberStatus): void;
}

/**
 * WebRTC session management to send/receive SDPs.
 */
export class PeerCallService {
	private socket: WebSocket;
	private callConfig: CallConfigMessage | null;
	private callObserver: PeerCallServiceObserver | null;

	constructor() {
		this.callConfig = null;
		this.callObserver = null;
		this.socket = new WebSocket(url);
		this.socket.addEventListener("open", (event: Event) => {
			console.log("Websocket is opened");
			this.socket.send('{"msg":"session-request"}');
		});

		this.socket.addEventListener("message", (msg: MessageEvent) => {
			let req: RequestMessage;
			try {
				req = JSON.parse(msg.data.toString());
			} catch (e) {
				return;
			}
			console.log("Received " + req.msg);
			if (req.msg === "session-config") {
				this.callConfig = req as CallConfigMessage;
			} else if (req.msg === "session-accept") {
				if (this.callObserver) {
					let sessionAccept: SessionAcceptMessage = req as SessionAcceptMessage;
					this.callObserver.onSessionAccept(
						sessionAccept.sessionId,
						sessionAccept.sdp,
						sessionAccept.offer,
						sessionAccept.offerToReceive
					);
				}
			} else if (req.msg === "session-update") {
				if (this.callObserver) {
					let sessionUpdate: SessionUpdateMessage = req as SessionUpdateMessage;
					this.callObserver.onSessionUpdate(
						sessionUpdate.sessionId,
						sessionUpdate.updateType,
						sessionUpdate.sdp
					);
				}
			} else if (req.msg === "transport-info") {
				if (this.callObserver) {
					let transportInfo: TransportInfoMessage = req as TransportInfoMessage;
					this.callObserver.onTransportInfo(transportInfo.sessionId, transportInfo.candidates);
				}
			} else if (req.msg === "session-terminate") {
				if (this.callObserver) {
					let sessionTerminate: SessionTerminateMessage = req as SessionTerminateMessage;
					this.callObserver.onSessionTerminate(sessionTerminate.sessionId, sessionTerminate.reason);
				}
			} else if (req.msg === "session-initiate-response") {
				if (this.callObserver) {
					let initResponse: SessionInitiateResponseMessage = req as SessionInitiateResponseMessage;
					this.callObserver.onSessionInitiate(initResponse.to, initResponse.sessionId, initResponse.status);
				}
			} else if (req.msg === "session-initiate") {
				if (this.callObserver) {
					let sessionInitiate: SessionInitiateMessage = req as SessionInitiateMessage;
					if (sessionInitiate.sessionId) {
						this.callObserver.onIncomingSessionInitiate(
							sessionInitiate.sessionId,
							sessionInitiate.to,
							sessionInitiate.sdp,
							sessionInitiate.offer
						);
					}
				}
			} else if (req.msg === "join-callroom") {
				if (this.callObserver) {
					let joinRoom: JoinCallRoomMessage = req as JoinCallRoomMessage;
					this.callObserver.onJoinCallRoom(joinRoom.callRoomId, joinRoom.memberId, joinRoom.members);
				}
			} else if (req.msg === "member-join") {
				if (this.callObserver) {
					let memberJoin: MemberJoinMessage = req as MemberJoinMessage;
					this.callObserver.onMemberJoin(memberJoin.sessionId, memberJoin.memberId, memberJoin.status);
				}
			} else {
				console.log("Unsupported message " + req);
			}
		});

		this.socket.addEventListener("close", (event: CloseEvent) => {
			console.log("Websocket is closed");
		});

		this.socket.addEventListener("error", (event: Event) => {
			console.log("Websocket error" + event);
		});
	}

	setObserver(observer: PeerCallServiceObserver): void {
		this.callObserver = observer;
	}

	/**
	 * Get the WebRTC configuration to create the peer connection.
	 *
	 * @returns  the WebRTC configuration with turn servers.
	 */
	getConfiguration(): any {
		let iceServers: Array<RTCIceServer> = [];
		if (this.callConfig) {
			for (let i = 0; i < this.callConfig.turnServers.length; i++) {
				let turnServer = this.callConfig.turnServers[i];
				iceServers.push({
					urls: turnServer.url,
					username: turnServer.username,
					credential: turnServer.password,
				});
				break;
			}
		}

		let result = {
			iceServers: iceServers,
			// bundlePolicy: "balanced",
			// sdpSemantics: 'unified-plan'
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

		this.socket.send(JSON.stringify(msg));
	}

	sessionAccept(sessionId: string, to: string, sdp: string, offer: Offer) {
		const msg: SessionAcceptMessage = {
			msg: "session-accept",
			sessionId: sessionId,
			to: to,
			sdp: sdp,
			offer: offer,
			offerToReceive: offer,
		};

		this.socket.send(JSON.stringify(msg));
	}

	sessionUpdate(sessionId: string, sdp: string, updateType: string) {
		const msg: SessionUpdateMessage = {
			msg: "session-update",
			sessionId: sessionId,
			sdp: sdp,
			updateType: updateType,
		};

		this.socket.send(JSON.stringify(msg));
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
		this.socket.send(JSON.stringify(msg));
	}

	sessionTerminate(sessionId: string, reason: TerminateReason) {
		const msg: SessionTerminateMessage = {
			msg: "session-terminate",
			sessionId: sessionId,
			reason: reason,
		};

		this.socket.send(JSON.stringify(msg));
	}
}
