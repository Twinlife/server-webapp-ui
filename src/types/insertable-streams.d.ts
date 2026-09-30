/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

// Insertable streams for MediaStreamTrack (Chromium only, not yet part of lib.dom.d.ts).

interface MediaStreamTrackProcessorInit {
	track: MediaStreamTrack;
	maxBufferSize?: number;
}

declare class MediaStreamTrackProcessor {
	constructor(init: MediaStreamTrackProcessorInit);
	readonly readable: ReadableStream<VideoFrame>;
}

interface MediaStreamTrackGeneratorInit {
	kind: "video" | "audio";
}

declare class MediaStreamTrackGenerator extends MediaStreamTrack {
	constructor(init: MediaStreamTrackGeneratorInit);
	readonly writable: WritableStream<VideoFrame>;
}
