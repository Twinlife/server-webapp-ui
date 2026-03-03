/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { proxy } from "valtio";
import { subscribe } from "valtio/index";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { isMobile } from "../utils/BrowserCapabilities";

export type NotificationState = {
	participantJoined: boolean;
	participantLeft: boolean;
	messageReceived: boolean;
};

export function copyNotificationState(state: NotificationState): NotificationState {
	return {
		participantJoined: state.participantJoined,
		participantLeft: state.participantLeft,
		messageReceived: state.messageReceived,
	};
}

export type State = {
	sound: NotificationState;
	display: NotificationState;
};

export const DEFAULT_STATE = {
	sound: {
		participantJoined: true,
		participantLeft: true,
		messageReceived: true,
	},
	display: {
		participantJoined: !isMobile,
		participantLeft: !isMobile,
		messageReceived: true,
	},
};

function getNotifications(): State {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
		if (!stored) return DEFAULT_STATE;
		const parsed = JSON.parse(stored);
		return {
			...DEFAULT_STATE,
			...parsed,
		};
	} catch (error: unknown) {
		console.error("[UserPreferencesStore] Failed to parse stored settings:", error);
		return DEFAULT_STATE;
	}
}

export const notificationStore = proxy<State>(getNotifications());

subscribe(notificationStore, () => {
	localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notificationStore));
});
