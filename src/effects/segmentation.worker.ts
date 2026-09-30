/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { BackgroundRenderer } from "./BackgroundRenderer";
import { MASK_HEIGHT, MASK_WIDTH, SegmentationEngine } from "./SegmentationEngine";

/**
 * Worker that applies the virtual background effect on a video track by using
 * the insertable streams (MediaStreamTrackProcessor / MediaStreamTrackGenerator).
 * The camera frames are read from the readable stream, segmented and composited
 * with WebGL2 in an OffscreenCanvas and written to the writable stream.
 *
 * Until the segmenter is ready, the frames are passed through unchanged.
 */

export type WorkerStartMessage = {
	type: "start";
	readable: ReadableStream<VideoFrame>;
	writable: WritableStream<VideoFrame>;
	background: ImageBitmap | null;
};

export type WorkerBackgroundMessage = {
	type: "background";
	image: ImageBitmap | null;
};

export type WorkerStopMessage = {
	type: "stop";
};

export type WorkerRequest = WorkerStartMessage | WorkerBackgroundMessage | WorkerStopMessage;

export type WorkerResponse =
	{ type: "ready"; delegate: string } | { type: "error"; message: string } | { type: "stopped" };

let running: boolean = false;
let engine: SegmentationEngine | null = null;
let renderer: BackgroundRenderer | null = null;
let outputCanvas: OffscreenCanvas | null = null;
let background: ImageBitmap | null = null;
const inputCanvas: OffscreenCanvas = new OffscreenCanvas(MASK_WIDTH, MASK_HEIGHT);
const inputContext: OffscreenCanvasRenderingContext2D | null = inputCanvas.getContext("2d");

function post(response: WorkerResponse): void {
	self.postMessage(response);
}

function processFrame(frame: VideoFrame): VideoFrame {
	if (!running || !engine || !inputContext) {
		return frame;
	}
	const width = frame.displayWidth;
	const height = frame.displayHeight;
	try {
		if (!renderer || !outputCanvas || renderer.width !== width || renderer.height !== height) {
			renderer?.dispose();
			outputCanvas = new OffscreenCanvas(width, height);
			renderer = new BackgroundRenderer(outputCanvas, width, height, MASK_WIDTH, MASK_HEIGHT);
			renderer.setBackground(background);
			engine.reset();
		}
		inputContext.drawImage(frame, 0, 0, MASK_WIDTH, MASK_HEIGHT);
		const mask = engine.segment(inputCanvas, performance.now());
		renderer.render(frame, mask);
		const result = new VideoFrame(outputCanvas, { timestamp: frame.timestamp, alpha: "discard" });
		frame.close();
		return result;
	} catch (error) {
		console.error("Video background processing failed:", error);
		return frame;
	}
}

async function start(message: WorkerStartMessage): Promise<void> {
	running = true;
	background = message.background;

	// Start the pipeline now: frames are passed through until the segmenter is ready.
	const transformer = new TransformStream<VideoFrame, VideoFrame>({
		transform: (frame, controller) => {
			controller.enqueue(processFrame(frame));
		},
	});
	message.readable
		.pipeThrough(transformer)
		.pipeTo(message.writable)
		.then(() => {
			post({ type: "stopped" });
		})
		.catch((error) => {
			if (running) {
				post({ type: "error", message: String(error) });
			}
		});

	try {
		engine = await SegmentationEngine.create(true);
		if (!running) {
			engine.close();
			engine = null;
			return;
		}
		post({ type: "ready", delegate: engine.delegate });
	} catch (error) {
		post({ type: "error", message: String(error) });
	}
}

function stop(): void {
	running = false;
	engine?.close();
	engine = null;
	renderer?.dispose();
	renderer = null;
	outputCanvas = null;
	background?.close();
	background = null;
	post({ type: "stopped" });
	self.close();
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const message = event.data;
	switch (message.type) {
		case "start":
			start(message);
			break;

		case "background":
			background?.close();
			background = message.image;
			renderer?.setBackground(background);
			break;

		case "stop":
			stop();
			break;
	}
};
