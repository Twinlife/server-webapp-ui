/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

/**
 * Encapsulate an audio stream track.
 */
export class AudioTrack {
	public readonly deviceId: string;
	public readonly track: MediaStreamTrack;

	constructor(track: MediaStreamTrack) {
		this.track = track;
		const settings: MediaTrackSettings = track.getSettings();
		if (settings.deviceId) {
			this.deviceId = settings.deviceId;
		} else {
			this.deviceId = track.label;
		}
	}
}
