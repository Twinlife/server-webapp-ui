/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { FC, useState, useEffect } from "react";
import { TabPanel } from "@headlessui/react";
import { Item, SelectList } from "../components/SelectList";
import { mediaDevices } from "../utils/MediaDevices";

interface VideoState {
	videoDevices: MediaDeviceInfo[] | null;
}

export interface VideoConfig {
	// videoDevice: MediaDeviceInfo | null;
	videoDeviceId: string | null;
}

interface SettingsProps {
	isOpen: boolean;
	config: VideoConfig;
	onChange: (value: VideoConfig) => void;
}

export const VideoSettings: FC<SettingsProps> = ({ isOpen, config, onChange }) => {
	const [videoState, setVideoState] = useState<VideoState | null>(null);
	console.info("VideoSettings render", isOpen, config);

	// Fetch audio devices only when the "Audio" tab is active
	useEffect(() => {
		console.info("VideoSettings useEffect", isOpen);
		if (isOpen) {
			const videoDeviceId = config.videoDeviceId;
			mediaDevices
				.fetchVideoDevices(videoDeviceId)
				.then((stream: MediaStream) => {
					const videoDevices: MediaDeviceInfo[] = mediaDevices.getVideoDevices();
					setVideoState({ videoDevices: videoDevices });
					const videoTracks: MediaStreamTrack[] = stream.getVideoTracks();
					const videoDeviceId: string | null =
						videoTracks.length > 0 ? (videoTracks[0].getSettings().deviceId ?? null) : null;
					const videoDevice = videoDevices.find((device) => device.deviceId === videoDeviceId);
					if (videoDevice && config.videoDeviceId != videoDevice.deviceId) {
						onChange({ ...config, videoDeviceId: videoDevice.deviceId });
					}
				})
				.catch((error) => {
					console.error("Failed to get audio devices", error);
				});
		}
	}, [isOpen]); // Re-run when selectedIndex changes

	const selectInput = (item: Item) => {
		console.error("Item ", item, "selected");
		const selectedDevice = mediaDevices.getMediaDevice(item.id);
		if (selectedDevice) {
			onChange({ videoDeviceId: selectedDevice.deviceId });
		}
	};

	const videos: Item[] =
		videoState?.videoDevices?.map((item: MediaDeviceInfo) => {
			return { id: item.deviceId, label: item.label };
		}) ?? [];
	const videoDeviceId = config.videoDeviceId;
	const videoItem = videos.find((item) => item.id === videoDeviceId);
	const videoSelected: string = videoItem ? videoItem.label : "Choose a camera";
	return (
		<TabPanel className="w-full">
			<div className="p-4">
				<h3 className="font-semibold mb-2">Video</h3>
				<SelectList items={videos} onSelect={selectInput} selected={videoSelected} />
			</div>
		</TabPanel>
	);
};
