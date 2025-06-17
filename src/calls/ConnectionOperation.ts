/*
 *  Copyright (c) 2022 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 */
import { CallConnection } from "./CallConnection";
import { CallState } from "./CallState";

/**
 * Describes an internal operation made for making a P2P call connection.
 * @class
 */
export class ConnectionOperation {

	static START_CALL: number = 1 << 2;

	static START_CALL_DONE: number = 1 << 3;

	static CREATE_OUTGOING_PEER_CONNECTION: number = 1 << 4;

	static CREATE_OUTGOING_PEER_CONNECTION_DONE: number = 1 << 5;

	static CREATE_INCOMING_PEER_CONNECTION: number = 1 << 6;

	static CREATE_INCOMING_PEER_CONNECTION_DONE: number = 1 << 7;

	static ACCEPTED_CALL: number = 1 << 8;

	static ACCEPTED_CALL_DONE: number = 1 << 9;

	static TERMINATE_CALL: number = 1 << 10;

	static TERMINATE_CALL_DONE: number = 1 << 11;

	static JOIN_CALL_ROOM: number = 1 << 14;

	static JOIN_CALL_ROOM_DONE: number = 1 << 15;

	static INVITE_CALL_ROOM: number = 1 << 16;

	static INVITE_CALL_ROOM_DONE: number = 1 << 17;

	call: CallState | null = null;

	callConnection: CallConnection | null = null;

	operation: number = 0;

	constructor(callConnection: CallConnection, operation: number) {
		this.callConnection = callConnection;
		this.call = callConnection.getCall();
		this.operation = operation;
	}
}
