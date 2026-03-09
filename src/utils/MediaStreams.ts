/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { AudioTrack } from "./AudioTrack";
import { VideoTrack } from "./VideoTrack";
import { AudioMonitor } from "./AudioMonitor";

/**
 * Manages a stream with an optional audio track and video track.
 */
export class MediaStreams {
	readonly stream: MediaStream;
	video: VideoTrack | null;
	audio: AudioTrack | null;
	audioMonitor: AudioMonitor | null;
	isScreenSharing: boolean;

	constructor() {
		this.video = null;
		this.audio = null;
		this.audioMonitor = null;
		this.isScreenSharing = false;
		this.stream = new MediaStream();
	}

	/**
	 * Set a new video track or remove it from the stream.
	 * @param videoTrack the new video track to set.
	 * @param isScreenSharing
	 * @returns
	 */
	setVideoTrack(videoTrack: VideoTrack | null, isScreenSharing: boolean): boolean {
		const result: boolean = this.video != null;
		if (this.video) {
			// Replace track
			const currentTrack = this.video.track;
			this.video.stop();
			this.stream.removeTrack(currentTrack);
		}
		this.video = videoTrack;
		if (videoTrack) {
			this.stream.addTrack(videoTrack.track);
		}
		this.isScreenSharing = isScreenSharing;
		return result;
	}
	setVideoTrackNoStop(videoTrack: VideoTrack | null): boolean {
		const result: boolean = this.video != null;
		if (this.video) {
			// Replace track
			const currentTrack = this.video.track;
			this.stream.removeTrack(currentTrack);
		}
		this.video = videoTrack;
		if (videoTrack) {
			this.stream.addTrack(videoTrack.track);
		}
		return result;
	}

	setAudioTrack(audioTrack: AudioTrack): boolean {
		console.info("Replace audio track with ", audioTrack.deviceId);

		let result: boolean = false;
		if (this.audio) {
			// Replace track
			const currentTrack = this.audio.track;
			currentTrack.stop();
			this.stream.removeTrack(currentTrack);
			result = true;
		}
		if (this.audioMonitor) {
			this.audioMonitor.close();
		}
		this.stream.addTrack(audioTrack.track);
		this.audioMonitor = new AudioMonitor("Microphone");
		this.audioMonitor.connect(new MediaStream([audioTrack.track]));
		this.audio = audioTrack;
		return result;
	}

	stop(): void {
		if (this.video) {
			this.video.stop();
			this.video = null;
		}
		for (const track of this.stream.getTracks()) {
			track.stop();
			this.stream.removeTrack(track);
		}
		if (this.audioMonitor) {
			this.audioMonitor.close();
			this.audioMonitor = null;
		}
	}
}

export const mediaStreams = new MediaStreams();
