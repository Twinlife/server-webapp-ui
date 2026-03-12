/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { FC, useState } from "react";
import { Dialog, DialogTitle } from "@headlessui/react";
import { Tab, TabGroup, TabPanels, TabList } from "@headlessui/react";
import { AudioSettings, AudioConfig } from "./AudioSettings";
import { NotificationSettings, NotificationConfig } from "./NotificationSettings";
import { BackgroundSettings, BackgroundConfig } from "./BackgroundSettings";
import { ProfileSettings, ProfileConfig } from "./ProfileSettings";
import { VideoSettings, VideoConfig } from "./VideoSettings";
import { profile } from "../stores/profile";
import { backgroundStore } from "../stores/backgrounds";
import { notificationStore, NotificationState, copyNotificationState } from "../stores/notifications";
import { audioStore } from "../stores/audio";
import { videoStore } from "../stores/video";

interface DialogConfig {
	audio: AudioConfig;
	video: VideoConfig;
	profile: ProfileConfig;
	background: BackgroundConfig;
	sound: NotificationState;
	display: NotificationState;
}

interface SettingsProps {
	title: string;
	isOpen: boolean;
	hasVideo: boolean;
	onClose: () => void;
}

function getSettings(): DialogConfig {
	return {
		audio: {
			inputDeviceId: audioStore.inputDeviceId,
			outputDeviceId: audioStore.outputDeviceId,
		},
		video: {
			videoDeviceId: videoStore.videoDeviceId,
		},
		profile: {
			name: profile.name,
		},
		background: backgroundStore,
		sound: copyNotificationState(notificationStore.sound),
		display: copyNotificationState(notificationStore.display),
	};
}

export const SettingsDialog: FC<SettingsProps> = ({ isOpen, hasVideo, onClose }) => {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [config, setConfig] = useState<DialogConfig>(getSettings());

	const updateAudio = (newConfig: AudioConfig) => setConfig({ ...config, audio: newConfig });

	const updateVideo = (newConfig: VideoConfig) => setConfig({ ...config, video: newConfig });

	const updateBackground = (newConfig: BackgroundConfig) => setConfig({ ...config, background: newConfig });

	const updateProfile = (newConfig: ProfileConfig) => setConfig({ ...config, profile: newConfig });

	const updateNotifications = (newConfig: NotificationConfig) =>
		setConfig({ ...config, sound: newConfig.sound, display: newConfig.display });

	// Handle validation and submission
	const handleSubmit = () => {
		console.log("Validated config:", config);
		profile.name = config.profile.name;
		backgroundStore.background = config.background.background;
		notificationStore.display = config.display;
		notificationStore.sound = config.sound;
		console.log("Audio input", config.audio.inputDeviceId);
		console.log("Video input", config.video.videoDeviceId);
		audioStore.inputDeviceId = config.audio.inputDeviceId;
		audioStore.outputDeviceId = config.audio.outputDeviceId;
		videoStore.videoDeviceId = config.video.videoDeviceId;
		onClose();
	};

	return (
		<Dialog open={isOpen} onClose={() => {}} className="fixed inset-0 z-50 overflow-y-auto">
			<div className="min-h-screen flex items-center justify-center p-4">
				<div className="bg-gray-800 rounded-lg p-4 w-full max-w-2xl shadow-xl border-2 border-white">
					<DialogTitle className="text-xl font-bold mb-2">Configuration Settings</DialogTitle>

					{/* Tabs */}
					<TabGroup
						vertical={true}
						className="flex flex-row w-full h-full"
						selectedIndex={selectedIndex}
						onChange={setSelectedIndex}
					>
						<TabList className="bg-gray-800 flex flex-col text-left border-r border-white">
							<Tab
								className={({ selected }) =>
									`px-4 py-2 font-medium border-r-2 ${
										selected
											? "text-white bg-gray-700 border-white"
											: "text-gray-300 hover:text-white border-gray-800"
									}`
								}
							>
								Audio
							</Tab>
							{hasVideo && (
								<Tab
									className={({ selected }) =>
										`px-4 py-2 font-medium border-r-2 ${
											selected
												? "text-white bg-gray-700 border-white"
												: "text-gray-300 hover:text-white border-gray-800"
										}`
									}
								>
									Video
								</Tab>
							)}
							{hasVideo && (
								<Tab
									className={({ selected }) =>
										`px-4 py-2 font-medium border-r-2 ${
											selected
												? "text-white bg-gray-700 border-white"
												: "text-gray-300 hover:text-white border-gray-800"
										}`
									}
								>
									Backgrounds
								</Tab>
							)}
							<Tab
								className={({ selected }) =>
									`px-4 py-2 font-medium border-r-2 ${
										selected
											? "text-white bg-gray-700 border-white"
											: "text-gray-300 hover:text-white border-gray-800"
									}`
								}
							>
								Notifications
							</Tab>
							<Tab
								className={({ selected }) =>
									`px-4 py-2 font-medium border-r-2 ${
										selected
											? "text-white bg-gray-700 border-white"
											: "text-gray-300 hover:text-white border-gray-800"
									}`
								}
							>
								Profile
							</Tab>
						</TabList>

						<TabPanels className="flex w-full bg-gray-800 h-[50vh] overflow-y-auto">
							<AudioSettings isOpen={selectedIndex == 0} config={config.audio} onChange={updateAudio} />
							{hasVideo && (
								<VideoSettings
									isOpen={selectedIndex == 1}
									config={config.video}
									onChange={updateVideo}
								/>
							)}
							{hasVideo && (
								<BackgroundSettings
									isOpen={selectedIndex == 2}
									config={config.background}
									onChange={updateBackground}
								/>
							)}
							<NotificationSettings
								isOpen={selectedIndex == 3}
								config={{ sound: config.sound, display: config.display }}
								onChange={updateNotifications}
							/>
							<ProfileSettings config={config.profile} onChange={updateProfile} />
						</TabPanels>
					</TabGroup>

					{/* Dialog Footer with Validation Button */}
					<div className="flex justify-end mt-3">
						<button
							onClick={() => {
								setConfig(getSettings());
								onClose();
							}}
							className="px-4 py-2 mr-2 text-white"
						>
							Cancel
						</button>
						<button
							onClick={handleSubmit}
							className="px-4 py-2 bg-blue text-white rounded hover:bg-blue-700"
						>
							Validate
						</button>
					</div>
				</div>
			</div>
		</Dialog>
	);
};
