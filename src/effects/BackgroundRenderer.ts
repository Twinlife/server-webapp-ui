/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

/**
 * Number of separable blur iterations applied to the reduced background.
 */
const BLUR_PASSES = 2;

/**
 * Reduction factor of the background before it is blurred (the blur is then upsampled).
 */
const BLUR_SCALE = 4;

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
uniform float u_flipY;
out vec2 v_uv;
void main() {
	v_uv = a_position * 0.5 + 0.5;
	if (u_flipY > 0.5) {
		v_uv.y = 1.0 - v_uv.y;
	}
	gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const BLUR_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_direction;
in vec2 v_uv;
out vec4 o_color;
void main() {
	vec3 color = texture(u_texture, v_uv).rgb * 0.227027;
	color += texture(u_texture, v_uv + u_direction).rgb * 0.1945946;
	color += texture(u_texture, v_uv - u_direction).rgb * 0.1945946;
	color += texture(u_texture, v_uv + u_direction * 2.0).rgb * 0.1216216;
	color += texture(u_texture, v_uv - u_direction * 2.0).rgb * 0.1216216;
	color += texture(u_texture, v_uv + u_direction * 3.0).rgb * 0.054054;
	color += texture(u_texture, v_uv - u_direction * 3.0).rgb * 0.054054;
	color += texture(u_texture, v_uv + u_direction * 4.0).rgb * 0.016216;
	color += texture(u_texture, v_uv - u_direction * 4.0).rgb * 0.016216;
	o_color = vec4(color, 1.0);
}`;

const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_frame;
uniform sampler2D u_mask;
uniform sampler2D u_background;
// 0: pass-through, 1: blurred background, 2: background image
uniform int u_mode;
uniform vec2 u_backgroundScale;
uniform vec2 u_backgroundOffset;
in vec2 v_uv;
out vec4 o_color;
void main() {
	vec3 foreground = texture(u_frame, v_uv).rgb;
	if (u_mode == 0) {
		o_color = vec4(foreground, 1.0);
		return;
	}
	// The mask is a person probability: sharpen it around 0.5 to remove the halo
	// while keeping a soft edge from the bilinear upsampling.
	float person = smoothstep(0.35, 0.65, texture(u_mask, v_uv).r);
	vec3 background;
	if (u_mode == 2) {
		background = texture(u_background, v_uv * u_backgroundScale + u_backgroundOffset).rgb;
	} else {
		background = texture(u_background, v_uv).rgb;
	}
	o_color = vec4(mix(background, foreground, person), 1.0);
}`;

export type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;

interface BlurUniforms {
	texture: WebGLUniformLocation | null;
	direction: WebGLUniformLocation | null;
	flipY: WebGLUniformLocation | null;
}

interface CompositeUniforms {
	frame: WebGLUniformLocation | null;
	mask: WebGLUniformLocation | null;
	background: WebGLUniformLocation | null;
	mode: WebGLUniformLocation | null;
	backgroundScale: WebGLUniformLocation | null;
	backgroundOffset: WebGLUniformLocation | null;
	flipY: WebGLUniformLocation | null;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error("Cannot create shader");
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error("Shader compilation failed: " + message);
	}
	return shader;
}

function createProgram(gl: WebGL2RenderingContext, fragmentSource: string): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error("Cannot create program");
	}
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.bindAttribLocation(program, 0, "a_position");
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error("Program link failed: " + message);
	}
	return program;
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) {
		throw new Error("Cannot create texture");
	}
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return texture;
}

/**
 * WebGL2 compositor for the virtual background effect.
 *
 * It composes the camera frame with either a blurred copy of itself or a background image,
 * using the person mask produced by the segmentation model.  The same code runs on the main
 * thread (HTMLCanvasElement) and in a worker (OffscreenCanvas).
 */
export class BackgroundRenderer {
	readonly width: number;
	readonly height: number;
	private readonly gl: WebGL2RenderingContext;
	private readonly maskWidth: number;
	private readonly maskHeight: number;
	private readonly blurWidth: number;
	private readonly blurHeight: number;
	private readonly blurProgram: WebGLProgram;
	private readonly compositeProgram: WebGLProgram;
	private readonly blurUniforms: BlurUniforms;
	private readonly compositeUniforms: CompositeUniforms;
	private readonly frameTexture: WebGLTexture;
	private readonly maskTexture: WebGLTexture;
	private readonly backgroundTexture: WebGLTexture;
	private readonly blurTextures: WebGLTexture[] = [];
	private readonly blurFramebuffers: WebGLFramebuffer[] = [];
	private readonly vertexBuffer: WebGLBuffer;
	private readonly vertexArray: WebGLVertexArrayObject;
	private hasBackgroundImage: boolean = false;
	private backgroundScale: [number, number] = [1, 1];
	private backgroundOffset: [number, number] = [0, 0];
	private disposed: boolean = false;

	constructor(canvas: RenderCanvas, width: number, height: number, maskWidth: number, maskHeight: number) {
		this.width = width;
		this.height = height;
		this.maskWidth = maskWidth;
		this.maskHeight = maskHeight;
		this.blurWidth = Math.max(1, Math.round(width / BLUR_SCALE));
		this.blurHeight = Math.max(1, Math.round(height / BLUR_SCALE));
		canvas.width = width;
		canvas.height = height;

		const attributes: WebGLContextAttributes = {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			premultipliedAlpha: false,
			preserveDrawingBuffer: false,
		};
		const gl =
			typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement
				? canvas.getContext("webgl2", attributes)
				: (canvas as OffscreenCanvas).getContext("webgl2", attributes);
		if (!gl) {
			throw new Error("WebGL2 is not available");
		}
		this.gl = gl;

		this.blurProgram = createProgram(gl, BLUR_FRAGMENT_SHADER);
		this.blurUniforms = {
			texture: gl.getUniformLocation(this.blurProgram, "u_texture"),
			direction: gl.getUniformLocation(this.blurProgram, "u_direction"),
			flipY: gl.getUniformLocation(this.blurProgram, "u_flipY"),
		};
		this.compositeProgram = createProgram(gl, COMPOSITE_FRAGMENT_SHADER);
		this.compositeUniforms = {
			frame: gl.getUniformLocation(this.compositeProgram, "u_frame"),
			mask: gl.getUniformLocation(this.compositeProgram, "u_mask"),
			background: gl.getUniformLocation(this.compositeProgram, "u_background"),
			mode: gl.getUniformLocation(this.compositeProgram, "u_mode"),
			backgroundScale: gl.getUniformLocation(this.compositeProgram, "u_backgroundScale"),
			backgroundOffset: gl.getUniformLocation(this.compositeProgram, "u_backgroundOffset"),
			flipY: gl.getUniformLocation(this.compositeProgram, "u_flipY"),
		};

		// Full screen triangle.
		const vertexArray = gl.createVertexArray();
		const vertexBuffer = gl.createBuffer();
		if (!vertexArray || !vertexBuffer) {
			throw new Error("Cannot create vertex buffer");
		}
		this.vertexArray = vertexArray;
		this.vertexBuffer = vertexBuffer;
		gl.bindVertexArray(vertexArray);
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		this.frameTexture = createTexture(gl);
		this.maskTexture = createTexture(gl);
		this.backgroundTexture = createTexture(gl);
		for (let i = 0; i < 2; i++) {
			const texture = createTexture(gl);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				this.blurWidth,
				this.blurHeight,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				null,
			);
			const framebuffer = gl.createFramebuffer();
			if (!framebuffer) {
				throw new Error("Cannot create framebuffer");
			}
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			this.blurTextures.push(texture);
			this.blurFramebuffers.push(framebuffer);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
	}

	/**
	 * Set the background image or use the blurred camera frame when null.
	 *
	 * @param image the background image.
	 */
	setBackground(image: ImageBitmap | null): void {
		if (this.disposed) {
			return;
		}
		const gl = this.gl;
		if (!image) {
			this.hasBackgroundImage = false;
			return;
		}
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

		// Scale the image to cover the frame while preserving its aspect ratio.
		const imageAspect = image.width / image.height;
		const frameAspect = this.width / this.height;
		if (imageAspect > frameAspect) {
			const scale = frameAspect / imageAspect;
			this.backgroundScale = [scale, 1];
			this.backgroundOffset = [(1 - scale) / 2, 0];
		} else {
			const scale = imageAspect / frameAspect;
			this.backgroundScale = [1, scale];
			this.backgroundOffset = [0, (1 - scale) / 2];
		}
		this.hasBackgroundImage = true;
	}

	/**
	 * Render the frame in the canvas.  When the mask is null, the frame is copied as is.
	 *
	 * @param frame the camera frame.
	 * @param mask the person mask (maskWidth x maskHeight, 0..255) or null.
	 */
	render(frame: TexImageSource, mask: Uint8Array | null): void {
		if (this.disposed) {
			return;
		}
		const gl = this.gl;
		gl.bindVertexArray(this.vertexArray);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.frameTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

		let mode = 0;
		if (mask) {
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.maskWidth, this.maskHeight, 0, gl.RED, gl.UNSIGNED_BYTE, mask);
			if (this.hasBackgroundImage) {
				mode = 2;
			} else {
				mode = 1;
				this.blurFrame();
			}
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.width, this.height);
		gl.useProgram(this.compositeProgram);
		const uniforms = this.compositeUniforms;
		gl.uniform1i(uniforms.frame, 0);
		gl.uniform1i(uniforms.mask, 1);
		gl.uniform1i(uniforms.background, 2);
		gl.uniform1i(uniforms.mode, mode);
		gl.uniform1f(uniforms.flipY, 1);
		gl.uniform2f(uniforms.backgroundScale, this.backgroundScale[0], this.backgroundScale[1]);
		gl.uniform2f(uniforms.backgroundOffset, this.backgroundOffset[0], this.backgroundOffset[1]);
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, mode === 2 ? this.backgroundTexture : this.blurTextures[1]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		const gl = this.gl;
		gl.deleteTexture(this.frameTexture);
		gl.deleteTexture(this.maskTexture);
		gl.deleteTexture(this.backgroundTexture);
		for (const texture of this.blurTextures) {
			gl.deleteTexture(texture);
		}
		for (const framebuffer of this.blurFramebuffers) {
			gl.deleteFramebuffer(framebuffer);
		}
		gl.deleteBuffer(this.vertexBuffer);
		gl.deleteVertexArray(this.vertexArray);
		gl.deleteProgram(this.blurProgram);
		gl.deleteProgram(this.compositeProgram);
		gl.getExtension("WEBGL_lose_context")?.loseContext();
	}

	/**
	 * Blur the current frame texture into blurTextures[1] with a separable gaussian
	 * applied on a reduced copy of the frame.
	 */
	private blurFrame(): void {
		const gl = this.gl;
		gl.useProgram(this.blurProgram);
		gl.uniform1i(this.blurUniforms.texture, 0);
		gl.uniform1f(this.blurUniforms.flipY, 0);
		gl.viewport(0, 0, this.blurWidth, this.blurHeight);
		gl.activeTexture(gl.TEXTURE0);

		let source: WebGLTexture = this.frameTexture;
		for (let pass = 0; pass < BLUR_PASSES; pass++) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFramebuffers[0]);
			gl.bindTexture(gl.TEXTURE_2D, source);
			gl.uniform2f(this.blurUniforms.direction, 1 / this.blurWidth, 0);
			gl.drawArrays(gl.TRIANGLES, 0, 3);

			gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFramebuffers[1]);
			gl.bindTexture(gl.TEXTURE_2D, this.blurTextures[0]);
			gl.uniform2f(this.blurUniforms.direction, 0, 1 / this.blurHeight);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			source = this.blurTextures[1];
		}

		// The blur passes used texture unit 0 for the intermediate textures: restore the
		// camera frame on unit 0 since the composite shader samples the foreground from it.
		gl.bindTexture(gl.TEXTURE_2D, this.frameTexture);
	}
}
