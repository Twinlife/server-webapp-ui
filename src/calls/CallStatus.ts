/*
 *  Copyright (c) 2022-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 */
/**
 * Outgoing flows:
 *
 * WAIT_MEETING -> OUTGOING_CALL -> ACCEPTED_OUTGOING_CALL -> IN_CALL -> TERMINATED
 * WAIT_MEETING -> OUTGOING_VIDEO_CALL -> ACCEPTED_OUTGOING_VIDEO_CALL -> IN_VIDEO_CALL -> TERMINATED
 *
 * @enum
 * @property {CallStatus} WAIT_MEETING
 * @property {CallStatus} ACCEPTED_INCOMING_CALL
 * @property {CallStatus} ACCEPTED_INCOMING_VIDEO_CALL
 * @property {CallStatus} OUTGOING_CALL
 * @property {CallStatus} OUTGOING_VIDEO_CALL
 * @property {CallStatus} OUTGOING_VIDEO_BELL
 * @property {CallStatus} ACCEPTED_OUTGOING_CALL
 * @property {CallStatus} ACCEPTED_OUTGOING_VIDEO_CALL
 * @property {CallStatus} IN_CALL
 * @property {CallStatus} IN_VIDEO_CALL
 * @property {CallStatus} FALLBACK
 * @property {CallStatus} TERMINATED
 * @class
 */
export enum CallStatus {
	WAIT_MEETING,
	ACCEPTED_INCOMING_CALL,
	ACCEPTED_INCOMING_VIDEO_CALL,
	OUTGOING_CALL,
	OUTGOING_VIDEO_CALL,
	OUTGOING_RINGING,
	IN_CALL,
	IN_VIDEO_CALL,
	FALLBACK,
	TERMINATED,
	IDLE,
}

/** @ignore */
export class CallStatusOps {
	public static toActive(mode: CallStatus): CallStatus {
		switch (mode) {
			case CallStatus.ACCEPTED_INCOMING_CALL:
			case CallStatus.ACCEPTED_INCOMING_VIDEO_CALL:
			case CallStatus.OUTGOING_CALL:
				return CallStatus.IN_CALL;
			case CallStatus.OUTGOING_VIDEO_CALL:
				return CallStatus.IN_VIDEO_CALL;
			default:
				return mode;
		}
	}

	public static isOutgoing(mode: CallStatus): boolean {
		return (
			mode === CallStatus.OUTGOING_CALL ||
			mode === CallStatus.OUTGOING_VIDEO_CALL ||
			mode === CallStatus.OUTGOING_RINGING
		);
	}

	public static isActive(mode: CallStatus): boolean {
		return mode === CallStatus.IN_CALL || mode === CallStatus.IN_VIDEO_CALL;
	}

	public static isIdle(mode: CallStatus): boolean {
		return mode === CallStatus.IDLE;
	}

	public static isAccepted(mode: CallStatus): boolean {
		return mode === CallStatus.ACCEPTED_INCOMING_CALL || mode === CallStatus.ACCEPTED_INCOMING_VIDEO_CALL;
	}

	public static isRinging(mode: CallStatus): boolean {
		return mode === CallStatus.OUTGOING_RINGING;
	}

	public static isTerminated(mode: CallStatus): boolean {
		return mode === CallStatus.TERMINATED;
	}

	public static getName(mode: CallStatus): string {
		return CallStatus[mode];
	}
}
