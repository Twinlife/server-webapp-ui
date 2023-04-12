/*
 *  Copyright (c) 2023 twinlife SA.
 *
 *  All Rights Reserved.
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
}
