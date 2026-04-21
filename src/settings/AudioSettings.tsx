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

interface AudioState {
	inputDevices: MediaDeviceInfo[] | null;
	outputDevices: MediaDeviceInfo[] | null;
}

export interface AudioConfig {
	inputDeviceId: string | null;
	outputDeviceId: string | null;
}

interface SettingsProps {
	isOpen: boolean;
	config: AudioConfig;
	onChange: (value: AudioConfig) => void;
}

export const AudioSettings: FC<SettingsProps> = ({ isOpen, config, onChange }) => {
	const [audioState, setAudioState] = useState<AudioState | null>(null);
	const inputDeviceId = config.inputDeviceId;
	const outputDeviceId = config.outputDeviceId;

	// Fetch audio devices only when the "Audio" tab is active
	/* eslint-disable react-hooks/exhaustive-deps */
	useEffect(() => {
		console.info("AudioSettings useEffect", isOpen);
		if (isOpen) {
			mediaDevices
				.fetchAudioDevices(inputDeviceId)
				.then((stream: MediaStream) => {
					const inputDevices: MediaDeviceInfo[] = mediaDevices.getAudioInputDevices();
					const outputDevices: MediaDeviceInfo[] = mediaDevices.getAudioOutputDevices();
					setAudioState({ inputDevices: inputDevices, outputDevices: outputDevices });
					const audioTracks: MediaStreamTrack[] = stream.getAudioTracks();
					const audioDeviceId: string | null =
						audioTracks.length > 0 ? (audioTracks[0].getSettings().deviceId ?? null) : null;
					const audioDevice = inputDevices.find((device) => device.deviceId === audioDeviceId);
					if (audioDevice && config.inputDeviceId != audioDevice.deviceId) {
						onChange({ ...config, inputDeviceId: audioDevice.deviceId });
					}
					const outputDevice = outputDevices.find((device) => device.deviceId === outputDeviceId);
					if (outputDevice && config.outputDeviceId != outputDevice.deviceId) {
						onChange({ ...config, outputDeviceId: outputDevice.deviceId });
					}
				})
				.catch((error) => {
					console.error("Failed to get audio devices", error);
				});
		}
	}, [isOpen]); // Re-run when selectedIndex changes

	const selectInput = (item: Item) => {
		mediaDevices
			.fetchAudioDevices(item.id)
			.then((stream: MediaStream) => {
				const selectedDevice = mediaDevices.getMediaDevice(item.id);
				if (selectedDevice && stream) {
					console.error("Audio ", selectedDevice, "selected");
					onChange({ ...config, inputDeviceId: selectedDevice.deviceId });
				}
			})
			.catch((error) => {
				console.error("Error", error);
			});
	};
	const selectOutput = (item: Item) => {
		const selectedDevice = mediaDevices.getMediaDevice(item.id);
		if (selectedDevice) {
			onChange({ ...config, outputDeviceId: selectedDevice.deviceId });
		}
	};

	const inputs: Item[] =
		audioState?.inputDevices?.map((item: MediaDeviceInfo) => {
			return { id: item.deviceId, label: item.label };
		}) ?? [];
	const outputs: Item[] =
		audioState?.outputDevices?.map((item: MediaDeviceInfo) => {
			return { id: item.deviceId, label: item.label };
		}) ?? [];
	const inputItem = inputs.find((item) => item.id === inputDeviceId);
	const outputItem = outputs.find((item) => item.id === outputDeviceId);
	const inputSelected: string = inputItem ? inputItem.label : "Choose a microphone";
	const outputSelected: string = outputItem ? outputItem.label : "Choose an output";
	return (
		<TabPanel className="w-full">
			<div className="p-4">
				<h3 className="font-semibold mb-2">Microphone</h3>
				<SelectList items={inputs} onSelect={selectInput} selected={inputSelected} />
				<h3 className="font-semibold mb-2 mt-10">Audio output</h3>
				<SelectList items={outputs} onSelect={selectOutput} selected={outputSelected} />
			</div>
		</TabPanel>
	);
};
