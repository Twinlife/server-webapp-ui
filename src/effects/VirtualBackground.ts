/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { ImageSegmenter, FilesetResolver, ImageSegmenterResult } from "@mediapipe/tasks-vision";
import { CLEAR_TIMEOUT, SET_TIMEOUT, TIMEOUT_TICK, timerWorkerScript } from "../utils/TimerWorker";
import { VideoTrack } from "../utils/VideoTrack";
import { CallService } from "../calls/CallService";
import { subscribe } from "valtio/index";
import { backgroundStore } from "../stores/backgrounds";
import { mediaStreams } from "../utils/MediaStreams.ts";
import { isMobile, isSafari } from "../utils/BrowserCapabilities";

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
		this.effect.stopEffect(true);
	}
}

export class VirtualBackground {
	private readonly callService: CallService;
	private isInitialized: boolean;
	private imageSegmenter?: ImageSegmenter | null;
	private canvas: HTMLCanvasElement;
	private ctx?: CanvasRenderingContext2D;
	private video?: HTMLVideoElement;
	private imageData?: ImageData;
	private mask?: ImageData;
	private maskCanvas: HTMLCanvasElement;
	private maskCtx?: CanvasRenderingContext2D | null;
	private track: MediaStreamTrack | null;
	private maskWidth: number = 0;
	private maskHeight: number = 0;
	private videoWidth: number = 0;
	private videoHeight: number = 0;
	private backgroundImage: HTMLImageElement | null = null;
	private timerWorker: Worker | null;
	private maskPixelCount: number = 0;
	private count: number = 0;
	private effectTrack: EffectVideoTrack | null;

	constructor(callService: CallService) {
		this.callService = callService;
		this.isInitialized = false;
		this.canvas = document.createElement("canvas");
		this.maskCanvas = document.createElement("canvas");
		this.timerWorker = null;
		this.track = null;
		this.effectTrack = null;

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
					const backgroundPath = background > 0 ? "/backgrounds/" + background + ".webp" : "";
					console.info("Change video background to", backgroundPath);
					this.setBackground(backgroundPath);
				}
			} else if (background >= 0 && video) {
				// Last case, the current video has no effect and we want to turn it on.
				// Again, we have to update the media stream with a new track without
				// stopping the camera.
				const backgroundPath = background > 0 ? "/backgrounds/" + background + ".webp" : "";
				console.info("Create video background", backgroundPath);
				if (!this.isInitialized) {
					this.init().then(() => {
						const stream = this.startEffect(video.track, backgroundPath);
						mediaStreams.setVideoTrackNoStop(stream);
						this.callService.updateVideoTrack(stream, true);
					});
				} else {
					mediaStreams.setVideoTrackNoStop(this.startEffect(video.track, backgroundPath));
					if (mediaStreams.video) {
						this.callService.updateVideoTrack(mediaStreams.video, true);
					}
				}
			}
		});
	}

	setVideoTrack = (mediaStream: MediaStreamTrack, isScreenSharing: boolean) => {
		const background = backgroundStore.background;
		if (isMobile || isSafari || isScreenSharing || background == null || background < 0) {
			this.callService.setVideoTrack(new VideoTrack(mediaStream, null), isScreenSharing);
			this.stopEffect(false);
			return;
		}
		if (!this.isInitialized) {
			this.init().then(() => {
				this.setVideoTrack(mediaStream, isScreenSharing);
			});
		} else {
			const backgroundPath = background > 0 ? "/backgrounds/" + background + ".webp" : "";
			const stream = this.startEffect(mediaStream as MediaStreamTrack, backgroundPath);
			this.callService.setVideoTrack(stream, isScreenSharing);
		}
	};

	async init() {
		this.isInitialized = true;
		const vision = await FilesetResolver.forVisionTasks("/@mediapipe/wasm");
		this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "/@mediapipe/selfie_segmenter_landscape.tflite",
			},
			outputCategoryMask: true,
			outputConfidenceMasks: false,
			runningMode: "VIDEO",
		});
	}

	/**
	 * Change the virtual background while the effect is active.
	 * @param backgroundPath the new virtual background to use.
	 */
	setBackground(backgroundPath: string): void {
		if (backgroundPath != "") {
			this.backgroundImage = document.createElement("img");
			this.backgroundImage.crossOrigin = "anonymous";
			this.backgroundImage.src = backgroundPath;
		} else {
			this.backgroundImage = null;
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
		console.error("startEffect track=" + track);
		const { frameRate, height, width, deviceId } = track.getSettings();
		this.video = document.createElement("video");
		if (!frameRate || !width || !height || !this.video) {
			return new VideoTrack(track, null);
		}
		if (backgroundPath) {
			this.backgroundImage = document.createElement("img");
			this.backgroundImage.crossOrigin = "anonymous";
			this.backgroundImage.src = backgroundPath;
		}
		this.videoWidth = width;
		this.videoHeight = height;
		this.maskWidth = 256;
		this.maskHeight = 144;
		this.maskPixelCount = this.maskWidth * this.maskHeight;
		this.mask = new ImageData(this.maskWidth, this.maskHeight);
		this.maskCanvas.width = this.maskWidth;
		this.maskCanvas.height = this.maskHeight;
		this.maskCtx = this.maskCanvas.getContext("2d", { willReadFrequently: true });
		this.canvas.width = width;
		this.canvas.height = height;
		this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
		this.count = this.count + 1;
		if (this.timerWorker == null) {
			this.timerWorker = new Worker(timerWorkerScript, { name: "Video processing " + this.count });
			this.timerWorker.onmessage = (data) => this.onTimerMessage(data);
		}

		this.video.width = width;
		this.video.height = height;
		this.video.autoplay = true;
		this.video.srcObject = new MediaStream([track]);
		this.video.onloadeddata = () => {
			console.log("on loaded start post message");
		};
		this.timerWorker?.postMessage({ id: SET_TIMEOUT, timeMs: 100 });
		const result = this.canvas.captureStream(frameRate);
		console.log("Created new stream " + result);
		this.effectTrack = new EffectVideoTrack(this, result, deviceId ? deviceId : track.label);
		return this.effectTrack;
	}

	stopEffect(release: boolean) {
		console.log("stop effect release", release);
		if (this.timerWorker) {
			this.timerWorker.postMessage({ id: CLEAR_TIMEOUT });
			//this.timerWorker.terminate();
			//this.timerWorker = null;
		}
		if (this.video) {
			this.video.srcObject = null;
		}
		const effectTrack = this.effectTrack;
		if (effectTrack) {
			this.effectTrack = null;
			effectTrack.stop();
		}
		if (this.track && release) {
			this.track.stop();
			this.track = null;
		}
	}

	onTimerMessage(response: { data: { id: number } }): void {
		if (response.data.id == TIMEOUT_TICK) {
			this.process();
		}
	}

	async process() {
		// console.log("process image");
		this.resizeSource();
		const res: ImageSegmenterResult | null = await this.segmentVideo();
		if (res) {
			this.onImageSegmented(res);
		}
	}

	resizeSource(): void {
		// console.log("resizeSource " + this.maskWidth + "x" + this.maskHeight);
		if (!this.video || !this.maskCtx) {
			return;
		}
		this.maskCtx.drawImage(
			this.video,
			0,
			0,
			this.videoWidth,
			this.videoHeight,
			0,
			0,
			this.maskWidth,
			this.maskHeight,
		);
		this.imageData = this.maskCtx.getImageData(0, 0, this.maskWidth, this.maskHeight);
		//console.log("video size " + this.videoWidth + "x" + this.videoHeight + " image " + this.imageData.width + "x" + this.imageData.height);
	}

	async segmentVideo(): Promise<ImageSegmenterResult | null> {
		const startTimeMs = performance.now();
		return new Promise<ImageSegmenterResult | null>((resolve) => {
			if (!this.imageSegmenter || !this.imageData) {
				resolve(null);
				return;
			}
			this.imageSegmenter.segmentForVideo(this.imageData, startTimeMs, (result: ImageSegmenterResult) => {
				// const endTimeMs = performance.now();
				// console.log("segmentation time " + (endTimeMs - startTimeMs) + " ms");
				resolve(result);
			});
		});
	}

	onImageSegmented(result: ImageSegmenterResult): void {
		if (!result.categoryMask || !this.mask || !this.ctx || !this.video || !this.maskCtx) {
			return;
		}

		const categoryMask = result.categoryMask;
		const mask: Uint8Array = categoryMask.getAsUint8Array();
		const image: HTMLImageElement | null = this.backgroundImage;

		// Generate image mask (256x144)
		for (let i = 0; i < this.maskPixelCount; i++) {
			this.mask.data[i * 4 + 3] = 255 - mask[i];
		}
		this.maskCtx.putImageData(this.mask, 0, 0);

		// Draw the segmentation mask and smooth out the edges (as Jitsi does)
		this.ctx.globalCompositeOperation = "copy";
		this.ctx.filter = image ? "blur(4px)" : "blur(8px)";
		this.ctx.drawImage(
			this.maskCanvas,
			0,
			0,
			this.maskWidth,
			this.maskHeight,
			0,
			0,
			this.videoWidth,
			this.videoHeight,
		);

		// Draw the foreground video.
		this.ctx.globalCompositeOperation = "source-in";
		this.ctx.filter = "none";
		this.ctx.drawImage(this.video, 0, 0);

		// Draw virtual background.
		this.ctx.globalCompositeOperation = "destination-over";
		if (image) {
			this.ctx.drawImage(image, 0, 0, this.videoWidth, this.videoHeight);
		} else {
			this.ctx.filter = "blur(8px)";
			this.ctx.drawImage(this.video, 0, 0);
			//console.error("Draw segmented " + mask.length + " " + this.videoWidth + "x" + this.videoHeight);
		}
		this.timerWorker?.postMessage({ id: SET_TIMEOUT, timeMs: 1000 / 15 });
	}
}
