/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { notificationCenter } from "./NotificationCenter";
import { notificationStore } from "../stores/notifications";
import { chatStore } from "../stores/chat";

export const useNotificationCenter = () => {
	const notifications = useSnapshot(notificationStore);
	const chat = useSnapshot(chatStore);

	useEffect(() => {
		notificationCenter.updateSettings();
	}, [notifications.sound, notifications.display, chat.chatPanelOpened, chat.unreadMessages]);

	return notificationCenter;
};
