/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

/**
 * Encapsulate an audio stream track.
 */
export class AudioMonitor {
	static readonly SPEAKING_LEVEL: number = 5;
	private readonly mName: string;
	private readonly mContext: AudioContext;
	private readonly mAnalyser: AnalyserNode;
	private mSource: MediaStreamAudioSourceNode | null;
	private mCount: number;
	private mAverage: number;

	level: number;

	/**
	 * Returns true if the peer is speaking (the AudioMonitor detects some activity).
	 *
	 * @returns {boolean} true if the peer is speaking.
	 */
	public isSpeaking(): boolean {
		return this.level > AudioMonitor.SPEAKING_LEVEL;
	}

	constructor(name: string) {
		const context: AudioContext = new window.AudioContext();
		const analyser: AnalyserNode = context.createAnalyser();
		const processor: ScriptProcessorNode = context.createScriptProcessor(1024, 1, 1);

		analyser.smoothingTimeConstant = 0.8;
		analyser.fftSize = 1024;
		analyser.connect(processor);
		processor.connect(context.destination);

		this.mName = name;
		this.mSource = null;
		this.level = 0;
		this.mCount = 0;
		this.mAverage = 0;
		this.mContext = context;
		this.mAnalyser = analyser;

		processor.onaudioprocess = () => {
			const array = new Uint8Array(analyser.frequencyBinCount);
			analyser.getByteFrequencyData(array);
			const average = array.reduce((a, b) => a + b, 0) / array.length;
			this.mAverage = this.mAverage + average;
			this.mCount++;
			if (this.mCount == 10) {
				this.level = this.mAverage / this.mCount;
				this.mCount = 0;
				/*if (this.isSpeaking()) {
                    console.log(this.mName, " is speaking:", this.level);
                } else {
                    console.log(this.mName, " is inactive or very quiet:", this.level);
                }*/
			}
			this.mAverage = 0;
		};
	}

	connect(stream: MediaStream) {
		if (DEBUG) {
			console.log("Connecting", stream.id, "on audio monitor", this.mName);
		}
		if (this.mSource) {
			this.mSource.disconnect();
		}

		const source: MediaStreamAudioSourceNode = this.mContext.createMediaStreamSource(stream);
		source.connect(this.mAnalyser);
		this.mSource = source;
	}

	disconnect(): void {
		if (this.mSource) {
			this.mSource.disconnect();
			this.mSource = null;
		}
	}

	close(): void {
		if (DEBUG) {
			console.log("Closing audio monitor", this.mName);
		}

		this.disconnect();
		if (this.mAnalyser) {
			this.mAnalyser.disconnect();
		}
		if (this.mContext) {
			this.mContext.close();
		}
	}
}
