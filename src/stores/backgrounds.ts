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
	background: number;
};

export const DEFAULT_STATE = {
	background: 0,
};

function getBackground(): State {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.BACKGROUND);
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

export const backgroundStore = proxy<State>(getBackground());

subscribe(backgroundStore, () => {
	localStorage.setItem(STORAGE_KEYS.BACKGROUND, JSON.stringify(backgroundStore));
});
