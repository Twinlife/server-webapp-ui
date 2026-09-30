/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { FilesetResolver, ImageSegmenter, ImageSegmenterResult } from "@mediapipe/tasks-vision";

/**
 * Input size of the selfie segmenter landscape model: the segmentation source must
 * be given at this size so that the mask is produced at this size.
 */
export const MASK_WIDTH = 256;
export const MASK_HEIGHT = 144;

export const MEDIAPIPE_WASM_PATH = "/@mediapipe/wasm";
export const SEGMENTER_MODEL_PATH = "/@mediapipe/selfie_segmenter_landscape.tflite";

/**
 * Weight of the new frame in the temporal smoothing of the mask (1 = no smoothing).
 */
const TEMPORAL_SMOOTHING = 0.5;

export type SegmentationDelegate = "GPU" | "CPU";

type SegmentationSource = Parameters<ImageSegmenter["segmentForVideo"]>[0];

/**
 * Wrapper around the MediaPipe image segmenter that produces a temporally smoothed
 * person mask (0..255) from the model confidence mask.
 */
export class SegmentationEngine {
	readonly delegate: SegmentationDelegate;
	private readonly segmenter: ImageSegmenter;
	private readonly smoothed: Float32Array = new Float32Array(MASK_WIDTH * MASK_HEIGHT);
	private readonly mask: Uint8Array = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);
	private hasPrevious: boolean = false;
	private lastTimestamp: number = 0;
	private closed: boolean = false;

	private constructor(segmenter: ImageSegmenter, delegate: SegmentationDelegate) {
		this.segmenter = segmenter;
		this.delegate = delegate;
	}

	/**
	 * Create the segmentation engine with the CPU (wasm) delegate.
	 *
	 * The GPU delegate is not used on purpose: the confidence mask is then a WebGL texture
	 * that MediaPipe reads back with readPixels(RED, FLOAT), a combination that is not
	 * guaranteed by WebGL2 and silently produces an all-zero mask on some platforms
	 * (observed on Windows with ANGLE/Direct3D 11, i.e. Edge and Chrome).  With the
	 * CPU delegate the mask is produced directly as a Float32Array and the model is
	 * small enough (256x144 input) to run in a few milliseconds with wasm SIMD.
	 *
	 * @param useModule true to load the ES module version of the wasm files (required in a module worker).
	 */
	static async create(useModule: boolean): Promise<SegmentationEngine> {
		const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH, useModule);
		const delegate: SegmentationDelegate = "CPU";
		const segmenter = await ImageSegmenter.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: SEGMENTER_MODEL_PATH,
				delegate: delegate,
			},
			outputCategoryMask: false,
			outputConfidenceMasks: true,
			runningMode: "VIDEO",
		});
		console.info("Image segmenter created with the", delegate, "delegate");
		return new SegmentationEngine(segmenter, delegate);
	}

	/**
	 * Forget the previous masks (when a new video source is used).
	 */
	reset(): void {
		this.hasPrevious = false;
	}

	/**
	 * Segment the source image which must be MASK_WIDTH x MASK_HEIGHT.
	 *
	 * @param source the image to segment.
	 * @param timestampMs the frame timestamp in milliseconds.
	 * @returns the person mask (MASK_WIDTH x MASK_HEIGHT, 255 = person) or null.
	 */
	segment(source: SegmentationSource, timestampMs: number): Uint8Array | null {
		if (this.closed) {
			return null;
		}
		// MediaPipe requires strictly increasing timestamps.
		if (timestampMs <= this.lastTimestamp) {
			timestampMs = this.lastTimestamp + 1;
		}
		this.lastTimestamp = timestampMs;

		let mask: Uint8Array | null = null;
		this.segmenter.segmentForVideo(source, timestampMs, (result: ImageSegmenterResult) => {
			mask = this.updateMask(result);
		});
		return mask;
	}

	close(): void {
		if (!this.closed) {
			this.closed = true;
			this.segmenter.close();
		}
	}

	private updateMask(result: ImageSegmenterResult): Uint8Array | null {
		const masks = result.confidenceMasks;
		if (!masks || masks.length === 0) {
			return null;
		}
		// The selfie segmenter produces a single confidence mask with the person probability
		// (a multi-class model would give the foreground last).
		const confidence = masks[masks.length - 1];
		if (confidence.width !== MASK_WIDTH || confidence.height !== MASK_HEIGHT) {
			console.warn("Unexpected mask size", confidence.width, "x", confidence.height);
			return null;
		}
		const data = confidence.getAsFloat32Array();
		const smoothed = this.smoothed;
		const mask = this.mask;
		const count = smoothed.length;
		if (!this.hasPrevious) {
			smoothed.set(data);
			this.hasPrevious = true;
		} else {
			for (let i = 0; i < count; i++) {
				smoothed[i] += (data[i] - smoothed[i]) * TEMPORAL_SMOOTHING;
			}
		}
		for (let i = 0; i < count; i++) {
			mask[i] = smoothed[i] * 255 + 0.5;
		}
		return mask;
	}
}
