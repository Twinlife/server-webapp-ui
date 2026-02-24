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

type State = {
	videoDeviceId: string | null;
	enable: boolean;
};

export const DEFAULT_STATE = {
	videoDeviceId: null,
	enable: true,
};

function getVideoSettings(): State {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.VIDEO);
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

export const videoStore = proxy<State>(getVideoSettings());

subscribe(videoStore, () => {
	localStorage.setItem(STORAGE_KEYS.VIDEO, JSON.stringify(videoStore));
});
