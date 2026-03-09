/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { proxy } from "valtio";

type State = {
	inputDeviceId: string | null;
	outputDeviceId: string | null;
};

export const audioStore = proxy<State>({
	inputDeviceId: null,
	outputDeviceId: null,
});
