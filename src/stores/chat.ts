/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { proxy } from "valtio";

type State = {
	chatPanelOpened: boolean;
	unreadMessages: number;
};

export const chatStore = proxy<State>({
	chatPanelOpened: false,
	unreadMessages: 0,
});
