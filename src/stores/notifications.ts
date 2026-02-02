/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { proxy } from "valtio";

export type NotificationState = {
	participantJoined: boolean;
	participantLeft: boolean;
	messageReceived: boolean;
};

export type State = {
	sound: NotificationState;
	display: NotificationState;
};

export const notificationStore = proxy<State>({
	sound: {
		participantJoined: true,
		participantLeft: true,
		messageReceived: true,
	},
	display: {
		participantJoined: true,
		participantLeft: true,
		messageReceived: true,
	},
});
