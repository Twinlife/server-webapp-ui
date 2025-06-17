/*
 *  Copyright (c) 2022 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 */
/**
 * Normal incoming flows:
 *
 * INCOMING_CALL -> ACCEPTED_INCOMING_CALL -> IN_CALL -> TERMINATED
 * INCOMING_VIDEO_CALL -> ACCEPTED_INCOMING_VIDEO_CALL -> IN_VIDEO_CALL -> TERMINATED
 * INCOMING_VIDEO_BELL -> IN_VIDEO_BELL -> ACCEPTED_INCOMING_VIDEO_CALL -> IN_VIDEO_CALL -> TERMINATED
 *
 * Outgoing flows:
 *
 * OUTGOING_CALL -> ACCEPTED_OUTGOING_CALL -> IN_CALL -> TERMINATED
 * OUTGOING_VIDEO_CALL -> ACCEPTED_OUTGOING_VIDEO_CALL -> IN_VIDEO_CALL -> TERMINATED
 * OUTGOING_VIDEO_BELL -> IN_VIDEO_BELL -> IN_VIDEO_CALL -> TERMINATED
 * @enum
 * @property {CallStatus} INCOMING_CALL
 * @property {CallStatus} INCOMING_VIDEO_CALL
 * @property {CallStatus} INCOMING_VIDEO_BELL
 * @property {CallStatus} ACCEPTED_INCOMING_CALL
 * @property {CallStatus} ACCEPTED_INCOMING_VIDEO_CALL
 * @property {CallStatus} OUTGOING_CALL
 * @property {CallStatus} OUTGOING_VIDEO_CALL
 * @property {CallStatus} OUTGOING_VIDEO_BELL
 * @property {CallStatus} ACCEPTED_OUTGOING_CALL
 * @property {CallStatus} ACCEPTED_OUTGOING_VIDEO_CALL
 * @property {CallStatus} IN_VIDEO_BELL
 * @property {CallStatus} IN_CALL
 * @property {CallStatus} IN_VIDEO_CALL
 * @property {CallStatus} FALLBACK
 * @property {CallStatus} TERMINATED
 * @class
 */
export enum CallStatus {
	INCOMING_CALL,
	INCOMING_VIDEO_CALL,
	INCOMING_VIDEO_BELL,
	ACCEPTED_INCOMING_CALL,
	ACCEPTED_INCOMING_VIDEO_CALL,
	OUTGOING_CALL,
	OUTGOING_VIDEO_CALL,
	OUTGOING_VIDEO_BELL,
	ACCEPTED_OUTGOING_CALL,
	ACCEPTED_OUTGOING_VIDEO_CALL,
	IN_VIDEO_BELL,
	IN_CALL,
	IN_VIDEO_CALL,
	FALLBACK,
	TERMINATED,
	IDDLE,
}

/** @ignore */
export class CallStatusOps {
	public static toActive(mode: CallStatus): CallStatus {
		switch (mode) {
			case CallStatus.INCOMING_CALL:
			case CallStatus.ACCEPTED_INCOMING_CALL:
			case CallStatus.OUTGOING_CALL:
			case CallStatus.ACCEPTED_OUTGOING_CALL:
				return CallStatus.IN_CALL;
			case CallStatus.INCOMING_VIDEO_BELL:
			case CallStatus.INCOMING_VIDEO_CALL:
			case CallStatus.OUTGOING_VIDEO_BELL:
			case CallStatus.OUTGOING_VIDEO_CALL:
			case CallStatus.IN_VIDEO_BELL:
			case CallStatus.ACCEPTED_INCOMING_VIDEO_CALL:
			case CallStatus.ACCEPTED_OUTGOING_VIDEO_CALL:
				return CallStatus.IN_VIDEO_CALL;
			default:
				return mode;
		}
	}

	public static toAccepted(mode: CallStatus): CallStatus {
		switch (mode) {
			case CallStatus.INCOMING_CALL:
			case CallStatus.ACCEPTED_INCOMING_CALL:
				return CallStatus.ACCEPTED_INCOMING_CALL;
			case CallStatus.OUTGOING_CALL:
			case CallStatus.ACCEPTED_OUTGOING_CALL:
				return CallStatus.ACCEPTED_OUTGOING_CALL;
			case CallStatus.INCOMING_VIDEO_BELL:
			case CallStatus.INCOMING_VIDEO_CALL:
			case CallStatus.ACCEPTED_INCOMING_VIDEO_CALL:
				return CallStatus.ACCEPTED_INCOMING_VIDEO_CALL;
			case CallStatus.OUTGOING_VIDEO_BELL:
			case CallStatus.OUTGOING_VIDEO_CALL:
			case CallStatus.ACCEPTED_OUTGOING_VIDEO_CALL:
				return CallStatus.ACCEPTED_OUTGOING_VIDEO_CALL;
			default:
				return mode;
		}
	}

	public static toVideo(mode: CallStatus): CallStatus {
		switch (mode) {
			case CallStatus.INCOMING_CALL:
			case CallStatus.INCOMING_VIDEO_CALL:
				return CallStatus.INCOMING_VIDEO_CALL;
			case CallStatus.ACCEPTED_INCOMING_CALL:
			case CallStatus.ACCEPTED_INCOMING_VIDEO_CALL:
				return CallStatus.ACCEPTED_INCOMING_VIDEO_CALL;
			case CallStatus.OUTGOING_CALL:
			case CallStatus.OUTGOING_VIDEO_CALL:
				return CallStatus.OUTGOING_VIDEO_CALL;
			case CallStatus.INCOMING_VIDEO_BELL:
				return CallStatus.INCOMING_VIDEO_BELL;
			case CallStatus.OUTGOING_VIDEO_BELL:
				return CallStatus.OUTGOING_VIDEO_BELL;
			case CallStatus.IN_VIDEO_BELL:
				return CallStatus.IN_VIDEO_BELL;
			case CallStatus.IN_CALL:
			case CallStatus.IN_VIDEO_CALL:
				return CallStatus.IN_VIDEO_CALL;
			default:
				return mode;
		}
	}

	public static isIncoming(mode: CallStatus): boolean {
		return (
			mode === CallStatus.INCOMING_CALL ||
			mode === CallStatus.INCOMING_VIDEO_CALL ||
			mode === CallStatus.INCOMING_VIDEO_BELL
		);
	}

	public static isOutgoing(mode: CallStatus): boolean {
		return (
			mode === CallStatus.OUTGOING_CALL ||
			mode === CallStatus.OUTGOING_VIDEO_CALL ||
			mode === CallStatus.OUTGOING_VIDEO_BELL
		);
	}

	public static isActive(mode: CallStatus): boolean {
		return mode === CallStatus.IN_CALL || mode === CallStatus.IN_VIDEO_CALL;
	}

	public static isIdle(mode: CallStatus): boolean {
		return mode === CallStatus.IDDLE;
	}

	public static isAccepted(mode: CallStatus): boolean {
		return (
			mode === CallStatus.ACCEPTED_INCOMING_CALL ||
			mode === CallStatus.ACCEPTED_INCOMING_VIDEO_CALL ||
			mode === CallStatus.ACCEPTED_OUTGOING_CALL ||
			mode === CallStatus.ACCEPTED_OUTGOING_VIDEO_CALL
		);
	}

	public static isTerminated(mode: CallStatus): boolean {
		return mode === CallStatus.TERMINATED;
	}

	public static isVideo(mode: CallStatus): boolean {
		switch (mode) {
			case CallStatus.INCOMING_VIDEO_CALL:
			case CallStatus.INCOMING_VIDEO_BELL:
			case CallStatus.OUTGOING_VIDEO_BELL:
			case CallStatus.OUTGOING_VIDEO_CALL:
			case CallStatus.ACCEPTED_OUTGOING_VIDEO_CALL:
			case CallStatus.ACCEPTED_INCOMING_VIDEO_CALL:
			case CallStatus.IN_VIDEO_BELL:
			case CallStatus.IN_VIDEO_CALL:
				return true;
			default:
				return false;
		}
	}

	public static getName(mode: CallStatus): string {
		return CallStatus[mode];
	}
}
