/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect } from "react";
import { NotificationCenter } from "./NotificationCenter";
import { useNotificationCenter } from "./useNotificationCenter";
import { ToastContainer } from "react-toastify";

export const Notifications: React.FC = () => {
	const notificationCenter: NotificationCenter = useNotificationCenter();
	const notificationType = notificationCenter.activeNotification;

	useEffect(() => {
		// notificationCenter.updateSettings();
	}, [notificationType]);

	return (
		<>
			<ToastContainer />
		</>
	);
};
