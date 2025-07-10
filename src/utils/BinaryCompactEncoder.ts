/*
 *  Copyright (c) 2015-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { ByteArrayOutputStream } from "./ByteArrayOutputStream";
import { Encoder } from "./Encoder";
import { SerializerException } from "./SerializerException";
import { UUID } from "./UUID";
import { Utf8 } from "./Utf8";

export class BinaryCompactEncoder implements Encoder {
	static DEBUG: boolean = false;

	mOutputStream: ByteArrayOutputStream;

	mBuffer: ArrayBuffer = new ArrayBuffer(16);

	public constructor(outputStream: ByteArrayOutputStream) {
		this.mOutputStream = outputStream;
	}

	public writeBoolean(value: boolean): void {
		try {
			this.mOutputStream.write$int(value ? 1 : 0);
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	public writeZero(): void {
		try {
			this.mOutputStream.write$int(0);
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	writeNonNull(): void {
		try {
			this.mOutputStream.write$int(2);
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	public writeInt(value: number): void {
		try {
			const lValue: number = (value << 1) ^ (value >> 31);
			if ((lValue & ~127) === 0) {
				this.mOutputStream.write$int(lValue);
				return;
			}
			if ((lValue & ~16383) === 0) {
				this.mOutputStream.write$int(128 | lValue);
				this.mOutputStream.write$int(lValue >>> 7);
				return;
			}
			const length: number = BinaryCompactEncoder.encodeInt(value, this.mBuffer);
			this.mOutputStream.writeBuffer(this.mBuffer, 0, length);
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	public writeLong(value: number): void {
		const buffer: ArrayBuffer = new ArrayBuffer(8);
		const srcBuffer: Uint8Array = new Uint8Array(buffer, 0, 8);
		for (let i: number = 7; i >= 0; i--) {
			const byte: number = value & 0xff;
			srcBuffer[i] = byte;
			value = (value - byte) / 256; // do not use shift operator (done on int32)
		}
		const length: number = BinaryCompactEncoder.encodeLongArrayBuffer(buffer, this.mBuffer);
		this.mOutputStream.writeBuffer(this.mBuffer, 0, length);
	}

	public writeOptionalUUID(value: UUID): void {
		if (value == null) {
			this.writeZero();
		} else {
			this.writeNonNull();
			this.writeUUID(value);
		}
	}

	public writeEnum(value: number): void {
		this.writeInt(value);
	}

	public writeString(value: string): void {
		try {
			if (value.length === 0) {
				this.writeZero();
				return;
			}
			const bytes: Uint8Array | null = Utf8.getBytes(value);
			if (bytes) {
				this.writeInt(bytes.byteLength);
				this.mOutputStream.writeUint8Array(bytes);
			} else {
				this.writeZero();
			}
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	public writeOptionalString(value: string): void {
		if (value == null) {
			this.writeZero();
		} else {
			this.writeNonNull();
			this.writeString(value);
		}
	}

	public writeData(bytes: ArrayBuffer): void {
		this.writeBytes(bytes, 0, bytes.byteLength);
	}

	public writeOptionalBytes(bytes: ArrayBuffer): void {
		if (bytes == null) {
			this.writeZero();
		} else {
			this.writeNonNull();
			this.writeBytes(bytes, 0, bytes.byteLength);
		}
	}

	public writeBytes(bytes: ArrayBuffer, start: number, length: number): void {
		if (length === 0) {
			this.writeZero();
			return;
		}
		this.writeInt(length);
		this.writeFixed(bytes, start, length);
	}

	public writeFixed(bytes: ArrayBuffer, start: number, length: number): void {
		try {
			this.mOutputStream.writeBuffer(bytes, start, length);
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	/**
	 * Write the UUID in binary form (this form is compact as it always uses 16 bytes).
	 *
	 * @param {UUID} value the UUID value to write.
	 * @throws SerializerException when there is a serialization issue.
	 */
	public writeUUID(value: UUID): void {
		try {
			const srcBuffer: Uint8Array = value.getValue();
			const dstBuffer: Uint8Array = new Uint8Array(this.mBuffer, 0, 16);
			for (let index = 0; index < 16; index++) {
				dstBuffer[index] = srcBuffer[15 - index];
			}

			this.mOutputStream.writeBuffer(this.mBuffer, 0, 16);
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	private static encodeInt(value: number, buffer: ArrayBuffer): number {
		value = (value << 1) ^ (value >> 31);
		const dstBuffer: Uint8Array = new Uint8Array(buffer, 0, buffer.byteLength);
		let position: number = 0;
		if ((value & ~127) !== 0) {
			dstBuffer[position++] = (value | 128) & 255;
			value >>>= 7;
			if (value > 127) {
				dstBuffer[position++] = (value | 128) & 255;
				value >>>= 7;
				if (value > 127) {
					dstBuffer[position++] = (value | 128) & 255;
					value >>>= 7;
					if (value > 127) {
						dstBuffer[position++] = (value | 128) & 255;
						value >>>= 7;
					}
				}
			}
		}
		dstBuffer[position++] = value;
		return position;
	}

	private static encodeLongArrayBuffer(value: ArrayBuffer, buffer: ArrayBuffer): number {
		let srcBuffer: Uint8Array = new Uint8Array(value, 0, value.byteLength);
		const rightShitf1 = new ArrayBuffer(8);
		let dstBuffer: Uint8Array = new Uint8Array(rightShitf1, 0, 8);
		for (let i: number = 0; i < 7; i++) {
			dstBuffer[i] = (srcBuffer[i] << 1) | ((srcBuffer[i + 1] >>> 7) & 0x1);
		}
		dstBuffer[7] = srcBuffer[7] << 1;
		const leftShitf63 = new ArrayBuffer(8);
		dstBuffer = new Uint8Array(leftShitf63, 0, 8);
		if (srcBuffer[0] >>> 7 !== 0) {
			for (let i: number = 0; i < 8; i++) {
				dstBuffer[i] = 0xff;
			}
		} else {
			for (let i: number = 0; i < 8; i++) {
				dstBuffer[i] = 0;
			}
		}
		const zigzag = new ArrayBuffer(8);
		const srcBuffer1: Uint8Array = new Uint8Array(rightShitf1, 0, rightShitf1.byteLength);
		const srcBuffer2: Uint8Array = new Uint8Array(leftShitf63, 0, leftShitf63.byteLength);
		dstBuffer = new Uint8Array(zigzag, 0, zigzag.byteLength);
		for (let i: number = 0; i < 8; i++) {
			dstBuffer[i] = srcBuffer1[i] ^ srcBuffer2[i];
		}

		srcBuffer = new Uint8Array(zigzag, 0, zigzag.byteLength);
		dstBuffer = new Uint8Array(buffer, 0, buffer.byteLength);
		let byte: number = srcBuffer[7];
		let position: number = 0;
		if (
			(byte & ~0x7f) !== 0 ||
			srcBuffer[6] !== 0 ||
			srcBuffer[5] !== 0 ||
			srcBuffer[4] !== 0 ||
			srcBuffer[3] !== 0 ||
			srcBuffer[2] !== 0 ||
			srcBuffer[1] !== 0 ||
			srcBuffer[0] !== 0
		) {
			dstBuffer[position++] = (byte | 0x80) & 0xff;
			byte >>= 7;
			byte |= srcBuffer[6] << 1;
			if (
				(byte & ~0x7f) !== 0 ||
				srcBuffer[5] !== 0 ||
				srcBuffer[4] !== 0 ||
				srcBuffer[3] !== 0 ||
				srcBuffer[2] !== 0 ||
				srcBuffer[1] !== 0 ||
				srcBuffer[0] !== 0
			) {
				dstBuffer[position++] = (byte | 0x80) & 0xff;
				byte >>= 7;
				byte |= srcBuffer[5] << 2;
				if (
					(byte & ~0x7f) !== 0 ||
					srcBuffer[4] !== 0 ||
					srcBuffer[3] !== 0 ||
					srcBuffer[2] !== 0 ||
					srcBuffer[1] !== 0 ||
					srcBuffer[0] !== 0
				) {
					dstBuffer[position++] = (byte | 0x80) & 0xff;
					byte >>= 7;
					byte |= srcBuffer[4] << 3;
					if (
						(byte & ~0x7f) !== 0 ||
						srcBuffer[3] !== 0 ||
						srcBuffer[2] !== 0 ||
						srcBuffer[1] !== 0 ||
						srcBuffer[0] !== 0
					) {
						dstBuffer[position++] = (byte | 0x80) & 0xff;
						byte >>= 7;
						byte |= srcBuffer[3] << 4;
						if ((byte & ~0x7f) !== 0 || srcBuffer[2] !== 0 || srcBuffer[1] !== 0 || srcBuffer[0] !== 0) {
							dstBuffer[position++] = (byte | 0x80) & 0xff;
							byte >>= 7;
							byte |= srcBuffer[2] << 5;
							if ((byte & ~0x7f) !== 0 || srcBuffer[1] !== 0 || srcBuffer[0] !== 0) {
								dstBuffer[position++] = (byte | 0x80) & 0xff;
								byte >>= 7;
								byte |= srcBuffer[1] << 6;
								if ((byte & ~0x7f) !== 0 || srcBuffer[0] !== 0) {
									dstBuffer[position++] = (byte | 0x80) & 0xff;
									byte >>= 7;
									byte |= srcBuffer[0] << 7;
									if ((byte & ~0x7f) !== 0) {
										dstBuffer[position++] = (byte | 0x80) & 0xff;
										byte >>= 7;
										if ((byte & ~0x7f) !== 0) {
											dstBuffer[position++] = (byte | 0x80) & 0xff;
											byte >>= 7;
										}
									}
								}
							}
						}
					}
				}
			}
		}
		dstBuffer[position++] = byte;
		return position;
	}
}
