/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

/**
 * Get the audio/video devices asking for permissions if necessary.
 */
class MediaDevices {
	private devices: MediaDeviceInfo[];

	constructor() {
		this.devices = [];
	}

	public getAudioInputDevices(): MediaDeviceInfo[] {
		return this.devices.filter((device) => device.kind === "audioinput");
	}

	public getAudioOutputDevices(): MediaDeviceInfo[] {
		return this.devices.filter((device) => device.kind === "audiooutput");
	}

	public getVideoDevices(): MediaDeviceInfo[] {
		return this.devices.filter((device) => device.kind === "videoinput");
	}

	public fetchAudioDevices(deviceId: string | null): Promise<MediaStream> {
		return new Promise((resolve, reject) => {
			const constraints: MediaStreamConstraints = deviceId
				? { audio: { deviceId: deviceId }, video: false }
				: { audio: true };

			console.info("get devices", constraints);
			navigator.mediaDevices
				.getUserMedia(constraints)
				.then((stream: MediaStream) => {
					navigator.mediaDevices
						.enumerateDevices()
						.then((devices) => {
							this.devices = devices;
							resolve(stream);
						})
						.catch((error) => {
							console.error("Error fetching audio devices:", error);
							reject(error);
						});
				})
				.catch((error) => {
					console.error("Error fetching audio devices:", error);
					reject(error);
				});
		});
	}

	public fetchVideoDevices(deviceId: string | null): Promise<MediaStream> {
		return new Promise((resolve, reject) => {
			const constraints: MediaStreamConstraints = deviceId
				? { video: { deviceId: deviceId }, audio: false }
				: { video: true };
			console.info("get devices", constraints);
			navigator.mediaDevices
				.getUserMedia(constraints)
				.then((stream: MediaStream) => {
					navigator.mediaDevices
						.enumerateDevices()
						.then((devices) => {
							this.devices = devices;
							resolve(stream);
						})
						.catch((error) => {
							console.error("Error fetching audio devices:", error);
							reject(error);
						});
				})
				.catch((error) => {
					console.error("Error fetching audio devices:", error);
					reject(error);
				});
		});
	}

	public getMediaDevice(deviceId: string): MediaDeviceInfo | undefined {
		return this.devices.find((device) => device.deviceId == deviceId);
	}
}

export const mediaDevices = new MediaDevices();
