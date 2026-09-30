/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { CLEAR_TIMEOUT, SET_TIMEOUT, TIMEOUT_TICK, timerWorkerScript } from "../utils/TimerWorker";
import { VideoTrack } from "../utils/VideoTrack";
import { CallService } from "../calls/CallService";
import { subscribe } from "valtio/index";
import { backgroundStore } from "../stores/backgrounds";
import { mediaStreams } from "../utils/MediaStreams.ts";
import { isMobile, isSafari } from "../utils/BrowserCapabilities";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { MASK_HEIGHT, MASK_WIDTH, SegmentationEngine } from "./SegmentationEngine";
import type { WorkerRequest, WorkerResponse } from "./segmentation.worker";

const DEFAULT_FRAME_RATE = 30;

class EffectVideoTrack extends VideoTrack {
	effect: VirtualBackground;

	constructor(effect: VirtualBackground, trackOrStream: MediaStream | MediaStreamTrack, deviceId: string | null) {
		super(trackOrStream, deviceId);
		this.effect = effect;
	}

	hasEffect(): boolean {
		return true;
	}

	stop(): void {
		console.log("EffectVideoTrack.stop");
		super.stop();
		this.effect.onEffectTrackStopped(this);
	}
}

/**
 * A processing pipeline that reads the camera track and produces the output track with the effect.
 */
interface Pipeline {
	readonly output: MediaStreamTrack;

	setBackground(image: ImageBitmap | null): void;

	stop(): void;
}

/**
 * Pipeline running in a worker with the insertable streams API (Chromium):
 * the camera frames never touch the main thread.
 */
class WorkerPipeline implements Pipeline {
	readonly output: MediaStreamTrack;
	private readonly worker: Worker;

	constructor(source: MediaStreamTrack, onError: (message: string) => void) {
		const processor = new MediaStreamTrackProcessor({ track: source });
		const generator = new MediaStreamTrackGenerator({ kind: "video" });
		this.output = generator;
		this.worker = new Worker(new URL("./segmentation.worker.ts", import.meta.url), {
			type: "module",
			name: "Video background",
		});
		this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const message = event.data;
			if (message.type === "ready") {
				console.info("Video background worker ready with the", message.delegate, "delegate");
			} else if (message.type === "error") {
				onError(message.message);
			}
		};
		this.worker.onerror = (event: ErrorEvent) => {
			onError(event.message);
		};
		const request: WorkerRequest = {
			type: "start",
			readable: processor.readable,
			writable: generator.writable,
			background: null,
		};
		this.worker.postMessage(request, [processor.readable, generator.writable]);
	}

	setBackground(image: ImageBitmap | null): void {
		const request: WorkerRequest = { type: "background", image: image };
		this.worker.postMessage(request, image ? [image] : []);
	}

	stop(): void {
		const request: WorkerRequest = { type: "stop" };
		this.worker.postMessage(request);
		this.worker.terminate();
		this.output.stop();
	}
}

/**
 * Pipeline running on the main thread (used when the insertable streams are not available):
 * the camera track is played in a video element, segmented and composited in a canvas
 * at the camera frame rate and the canvas is captured as the output track.
 */
class MainThreadPipeline implements Pipeline {
	readonly output: MediaStreamTrack;
	private readonly video: HTMLVideoElement;
	private readonly inputCanvas: HTMLCanvasElement;
	private readonly inputContext: CanvasRenderingContext2D | null;
	private readonly timer: Worker;
	private readonly interval: number;
	private renderer: BackgroundRenderer | null;
	private engine: SegmentationEngine | null = null;
	private stopped: boolean = false;

	constructor(
		source: MediaStreamTrack,
		width: number,
		height: number,
		frameRate: number,
		enginePromise: Promise<SegmentationEngine>,
	) {
		const canvas = document.createElement("canvas");
		this.renderer = new BackgroundRenderer(canvas, width, height, MASK_WIDTH, MASK_HEIGHT);
		this.inputCanvas = document.createElement("canvas");
		this.inputCanvas.width = MASK_WIDTH;
		this.inputCanvas.height = MASK_HEIGHT;
		this.inputContext = this.inputCanvas.getContext("2d");

		this.video = document.createElement("video");
		this.video.width = width;
		this.video.height = height;
		this.video.muted = true;
		this.video.playsInline = true;
		this.video.autoplay = true;
		this.video.srcObject = new MediaStream([source]);
		this.video.play().catch(() => {});

		this.output = canvas.captureStream(frameRate).getVideoTracks()[0];
		this.interval = 1000 / frameRate;
		this.timer = new Worker(timerWorkerScript, { name: "Video background timer" });
		this.timer.onmessage = (event: MessageEvent<{ id: number }>) => {
			if (event.data.id === TIMEOUT_TICK) {
				this.tick();
			}
		};
		this.schedule(this.interval);

		// Frames are passed through until the segmenter is ready.
		enginePromise
			.then((engine) => {
				if (!this.stopped) {
					engine.reset();
					this.engine = engine;
				}
			})
			.catch((error) => {
				console.error("Cannot load the image segmenter:", error);
			});
	}

	setBackground(image: ImageBitmap | null): void {
		this.renderer?.setBackground(image);
	}

	stop(): void {
		this.stopped = true;
		this.timer.postMessage({ id: CLEAR_TIMEOUT });
		this.timer.terminate();
		this.video.srcObject = null;
		this.renderer?.dispose();
		this.renderer = null;
		this.engine = null;
		this.output.stop();
	}

	private schedule(timeMs: number): void {
		if (!this.stopped) {
			this.timer.postMessage({ id: SET_TIMEOUT, timeMs: timeMs });
		}
	}

	private tick(): void {
		if (this.stopped) {
			return;
		}
		const start = performance.now();
		try {
			if (this.renderer && this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
				let mask: Uint8Array | null = null;
				if (this.engine && this.inputContext) {
					this.inputContext.drawImage(this.video, 0, 0, MASK_WIDTH, MASK_HEIGHT);
					mask = this.engine.segment(this.inputCanvas, start);
				}
				this.renderer.render(this.video, mask);
			}
		} catch (error) {
			console.error("Video background processing failed:", error);
		} finally {
			// Always re-arm the timer so that an error never stops the video.
			this.schedule(Math.max(1, this.interval - (performance.now() - start)));
		}
	}
}

function hasInsertableStreams(): boolean {
	return typeof MediaStreamTrackProcessor === "function" && typeof MediaStreamTrackGenerator === "function";
}

export class VirtualBackground {
	private readonly callService: CallService;
	private pipeline: Pipeline | null = null;
	private effectTrack: EffectVideoTrack | null = null;
	private track: MediaStreamTrack | null = null;
	private backgroundPath: string = "";
	private backgroundGeneration: number = 0;
	private enginePromise: Promise<SegmentationEngine> | null = null;
	private workerDisabled: boolean = false;

	constructor(callService: CallService) {
		this.callService = callService;

		// If the virtual background setting was changed, update the effect.
		subscribe(backgroundStore, () => {
			const background = backgroundStore.background;
			const video: VideoTrack | null = mediaStreams.video;
			if (video == null || video.hasEffect()) {
				if (background < 0) {
					// The current media video has the virtual background effect,
					// we must stop the effect without stopping the camera.
					// In the media stream, we only switch the track from the effect-track
					// to the camera track.
					console.info("Remove video background track changed in the media stream");
					mediaStreams.setVideoTrackNoStop(this.removeEffect());
					if (mediaStreams.video) {
						this.callService.updateVideoTrack(mediaStreams.video, true);
					}
				} else {
					// Simple case: we only change the background effect on the same track.
					// No need to switch track, we only change the background image.
					const backgroundPath = VirtualBackground.getBackgroundPath(background);
					console.info("Change video background to", backgroundPath);
					this.setBackground(backgroundPath);
				}
			} else if (background >= 0 && video) {
				// Last case, the current video has no effect and we want to turn it on.
				// Again, we have to update the media stream with a new track without
				// stopping the camera.
				const backgroundPath = VirtualBackground.getBackgroundPath(background);
				console.info("Create video background", backgroundPath);
				const stream = this.startEffect(video.track, backgroundPath);
				mediaStreams.setVideoTrackNoStop(stream);
				this.callService.updateVideoTrack(stream, true);
			}
		});
	}

	private static getBackgroundPath(background: number): string {
		return background > 0 ? "/backgrounds/" + background + ".webp" : "";
	}

	setVideoTrack = (mediaStream: MediaStreamTrack, isScreenSharing: boolean) => {
		const background = backgroundStore.background;
		if (isMobile || isSafari || isScreenSharing || background == null || background < 0) {
			this.callService.setVideoTrack(new VideoTrack(mediaStream, null), isScreenSharing);
			this.stopEffect(false);
			return;
		}
		const stream = this.startEffect(mediaStream, VirtualBackground.getBackgroundPath(background));
		this.callService.setVideoTrack(stream, isScreenSharing);
	};

	/**
	 * Pre-load the image segmenter used by the main thread pipeline.
	 */
	init(): Promise<void> {
		return this.getEngine().then(() => {});
	}

	/**
	 * Change the virtual background while the effect is active.
	 * @param backgroundPath the new virtual background to use.
	 */
	setBackground(backgroundPath: string): void {
		this.backgroundPath = backgroundPath;
		if (this.pipeline) {
			this.loadBackground(this.pipeline, backgroundPath);
		}
	}

	/**
	 * Remove the video effect on the current track and return the new track
	 * without the video effect.  Used only when turning off the effect background
	 * while keeping the camera stream.
	 * @returns  the original video track without effect.
	 */
	removeEffect(): VideoTrack | null {
		let deviceId: string = "";
		if (this.effectTrack) {
			deviceId = this.effectTrack.deviceId;
		}
		const track = this.track;
		if (track == null) {
			return null;
		}
		this.track = null;
		this.stopEffect(false);
		return new VideoTrack(track, deviceId);
	}

	startEffect(track: MediaStreamTrack, backgroundPath: string | null): VideoTrack {
		this.stopEffect(true);
		this.track = track;
		this.backgroundPath = backgroundPath ?? "";

		const { frameRate, height, width, deviceId } = track.getSettings();
		if (!width || !height) {
			console.warn("Video track has no size, no video background effect");
			return new VideoTrack(track, null);
		}
		const pipeline = this.createPipeline(track, width, height, frameRate ?? DEFAULT_FRAME_RATE);
		if (!pipeline) {
			return new VideoTrack(track, null);
		}
		this.pipeline = pipeline;
		this.loadBackground(pipeline, this.backgroundPath);
		this.effectTrack = new EffectVideoTrack(this, pipeline.output, deviceId ? deviceId : track.label);
		return this.effectTrack;
	}

	stopEffect(release: boolean): void {
		console.log("stop effect release", release);
		const pipeline = this.pipeline;
		this.pipeline = null;
		pipeline?.stop();

		const effectTrack = this.effectTrack;
		this.effectTrack = null;
		effectTrack?.track.stop();

		if (this.track && release) {
			this.track.stop();
			this.track = null;
		}
	}

	/**
	 * The effect track was stopped by the media stream: release the effect only
	 * if this is still the current effect track (a new effect could have been started).
	 */
	onEffectTrackStopped(track: EffectVideoTrack): void {
		if (this.effectTrack === track) {
			this.stopEffect(true);
		}
	}

	private getEngine(): Promise<SegmentationEngine> {
		if (!this.enginePromise) {
			this.enginePromise = SegmentationEngine.create(false).catch((error) => {
				// Allow a retry on the next attempt.
				this.enginePromise = null;
				throw error;
			});
		}
		return this.enginePromise;
	}

	private createPipeline(track: MediaStreamTrack, width: number, height: number, frameRate: number): Pipeline | null {
		if (!this.workerDisabled && hasInsertableStreams()) {
			try {
				let pipeline: WorkerPipeline | null = null;
				pipeline = new WorkerPipeline(track, (message: string) => {
					if (pipeline) {
						this.onWorkerFailure(pipeline, message);
					}
				});
				return pipeline;
			} catch (error) {
				console.warn("Cannot start the video background worker:", error);
				this.workerDisabled = true;
			}
		}
		return this.createMainThreadPipeline(track, width, height, frameRate);
	}

	private createMainThreadPipeline(
		track: MediaStreamTrack,
		width: number,
		height: number,
		frameRate: number,
	): Pipeline | null {
		try {
			return new MainThreadPipeline(track, width, height, frameRate, this.getEngine());
		} catch (error) {
			console.error("Cannot start the video background effect:", error);
			return null;
		}
	}

	/**
	 * The worker pipeline failed: switch to the main thread pipeline on the same camera track
	 * and replace the track in the media stream and in the current call.
	 */
	private onWorkerFailure(failed: WorkerPipeline, message: string): void {
		console.warn("Video background worker failed, falling back to the main thread:", message);
		this.workerDisabled = true;
		const track = this.track;
		if (this.pipeline !== failed || !track) {
			return;
		}
		failed.stop();
		const previousTrack = this.effectTrack;
		const { frameRate, height, width, deviceId } = track.getSettings();
		const pipeline =
			width && height
				? this.createMainThreadPipeline(track, width, height, frameRate ?? DEFAULT_FRAME_RATE)
				: null;
		let replacement: VideoTrack;
		if (pipeline) {
			this.pipeline = pipeline;
			this.loadBackground(pipeline, this.backgroundPath);
			this.effectTrack = new EffectVideoTrack(this, pipeline.output, deviceId ? deviceId : track.label);
			replacement = this.effectTrack;
		} else {
			// No effect possible: give back the camera track.
			this.pipeline = null;
			this.effectTrack = null;
			this.track = null;
			replacement = new VideoTrack(track, deviceId ? deviceId : track.label);
		}
		if (previousTrack && mediaStreams.video === previousTrack) {
			mediaStreams.setVideoTrackNoStop(replacement);
			this.callService.updateVideoTrack(replacement, true);
		}
	}

	private loadBackground(pipeline: Pipeline, backgroundPath: string): void {
		const generation = ++this.backgroundGeneration;
		if (!backgroundPath) {
			pipeline.setBackground(null);
			return;
		}
		fetch(backgroundPath)
			.then((response) => {
				if (!response.ok) {
					throw new Error("HTTP " + response.status);
				}
				return response.blob();
			})
			.then((blob) => createImageBitmap(blob))
			.then((image) => {
				if (generation !== this.backgroundGeneration || this.pipeline !== pipeline) {
					image.close();
					return;
				}
				pipeline.setBackground(image);
			})
			.catch((error) => {
				console.error("Cannot load the background image", backgroundPath, error);
			});
	}
}
