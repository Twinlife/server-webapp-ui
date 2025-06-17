/*
 *  Copyright (c) 2023 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { CallStatus } from "./CallStatus";

/**
 * Observer interface to be informed when the call state changes
 */
export interface CallObserver {
	/**
	 * The call status was changed.
	 *
	 * @param {CallStatus} status the new call status.
	 */
	onUpdateCallStatus(status: CallStatus): void;

	/**
	 * Called when the call is terminated.
	 *
	 * @param reason the call termination reason.
	 */
	onTerminateCall(reason: string): void;

	/**
	 * Overrides the current audio and video setting.
	 * Used during a transfer to copy the source device's state.
	 *
	 * @param audio whether the audio must be enabled.
	 * @param video whether the video must be enabled.
	 */
	onOverrideAudioVideo(audio: boolean, video: boolean): void;
}
