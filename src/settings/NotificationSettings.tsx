/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { FC } from "react";
import { Field, TabPanel, Label, Switch } from "@headlessui/react";
import { NotificationState } from "../stores/notifications";

export interface NotificationConfig {
	sound: NotificationState;
	display: NotificationState;
}

interface SettingsProps {
	isOpen: boolean;
	config: NotificationConfig;
	onChange: (value: NotificationConfig) => void;
}

export const NotificationSettings: FC<SettingsProps> = ({ config, onChange }) => {
	const handleSwitchChange = (type: "sound" | "display", key: keyof NotificationState, checked: boolean) => {
		const newConfig = { ...config };
		newConfig[type][key] = checked;
		onChange(newConfig);
	};
	return (
		<TabPanel className="w-full">
			<Field className="p-4 w-full h-full">
				<div className="grid grid-cols-1 gap-4">
					<div className="grid grid-cols-3 gap-4 items-center">
						<div></div> {/* Placeholder for labels */}
						<h3 className="text-center font-semibold">Sound on</h3>
						<h3 className="text-center font-semibold">Display on</h3>
					</div>

					<div className="grid grid-cols-3 gap-4 items-center">
						<Label className="text-left">Message received</Label>
						<Switch
							checked={config.sound.messageReceived}
							onChange={(checked) => handleSwitchChange("sound", "messageReceived", checked)}
							className="mx-auto group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition"
						>
							<span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6 group-data-[checked]:bg-blue" />
						</Switch>
						<Switch
							checked={config.display.messageReceived}
							onChange={(checked) => handleSwitchChange("display", "messageReceived", checked)}
							className="mx-auto group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition"
						>
							<span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6 group-data-[checked]:bg-blue" />
						</Switch>
					</div>

					<div className="grid grid-cols-3 gap-4 items-center">
						<Label className="text-left">Member join</Label>
						<Switch
							checked={config.sound.participantJoined}
							onChange={(checked) => handleSwitchChange("sound", "participantJoined", checked)}
							className="mx-auto group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition"
						>
							<span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6 group-data-[checked]:bg-blue" />
						</Switch>
						<Switch
							checked={config.display.participantJoined}
							onChange={(checked) => handleSwitchChange("display", "participantJoined", checked)}
							className="mx-auto group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition"
						>
							<span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6 group-data-[checked]:bg-blue" />
						</Switch>
					</div>

					<div className="grid grid-cols-3 gap-4 items-center">
						<Label className="text-left">Member leave</Label>
						<Switch
							checked={config.sound.participantLeft}
							onChange={(checked) => handleSwitchChange("sound", "participantLeft", checked)}
							className="mx-auto group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition"
						>
							<span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6 group-data-[checked]:bg-blue" />
						</Switch>
						<Switch
							checked={config.display.participantLeft}
							onChange={(checked) => handleSwitchChange("display", "participantLeft", checked)}
							className="mx-auto group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition"
						>
							<span className="size-4 translate-x-1 rounded-full bg-white transition group-data-[checked]:translate-x-6 group-data-[checked]:bg-blue" />
						</Switch>
					</div>
				</div>
			</Field>
		</TabPanel>
	);
};
