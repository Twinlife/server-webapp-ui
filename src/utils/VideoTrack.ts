/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

/**
 * Encapsulate a video track to allow easily override some functionalities.
 */
export class VideoTrack {
	public readonly deviceId: string;
	public readonly track: MediaStreamTrack;

	constructor(trackOrStream: MediaStream | MediaStreamTrack, deviceId: string | null) {
		if (trackOrStream instanceof MediaStream) {
			const stream = trackOrStream as MediaStream;
			this.track = stream.getVideoTracks()[0];
		} else {
			this.track = trackOrStream as MediaStreamTrack;
		}
		if (deviceId) {
			this.deviceId = deviceId;
		} else {
			const settings: MediaTrackSettings = this.track.getSettings();
			if (settings.deviceId) {
				this.deviceId = settings.deviceId;
			} else {
				this.deviceId = this.track.label;
			}
		}
	}

	stop(): void {
		this.track.stop();
	}
}
