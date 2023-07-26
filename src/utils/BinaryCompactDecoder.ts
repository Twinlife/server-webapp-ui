/*
 *  Copyright (c) 2015-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { ByteArrayInputStream } from "./ByteArrayInputStream";
import { Decoder } from "./Decoder";
import { SerializerException } from "./SerializerException";
import { UUID } from "./UUID";

export class BinaryCompactDecoder implements Decoder {
	static LOG_TAG: string = "BinaryDecoder";

	static DEBUG: boolean = false;

	mInputStream: ByteArrayInputStream;

	private mBuffer: ArrayBuffer = new ArrayBuffer(8);

	private textDecoder: TextDecoder = new TextDecoder('utf-8');

	public constructor(inputStream: ByteArrayInputStream) {
		this.mInputStream = inputStream;
	}

	public readBoolean(): boolean {
		let value: number;
		try {
			value = this.mInputStream.read();
		} catch (exception) {
			throw new SerializerException(exception);
		}
		if (value < 0) {
			throw new SerializerException();
		}
		return value !== 0;
	}

	public readInt(): number {
		let value: number = 0;
		let shift: number = 0;
		do {
			let b: number;
			try {
				b = this.mInputStream.read();
			} catch (exception) {
				throw new SerializerException(exception);
			}
			if (b >= 0) {
				value |= (b & 127) << shift;
				if ((b & 128) === 0) {
					return (value >>> 1) ^ -(value & 1);
				}
			} else {
				throw new SerializerException();
			}
			shift += 7;
		} while (shift < 32);
		throw new SerializerException();
	}

	public readLong(): number {
		// SCz: this is not really correct but should work for small values < 2^31
		return this.readInt();
	}

	public readLongArrayBuffer(): ArrayBuffer {
		let value: number = 0;
		let buffer: ArrayBuffer = new ArrayBuffer(8);
		let dstBuffer: Uint8Array = new Uint8Array(buffer, 0, 8);
		for (let i = 0; i < 8; i++) {
			dstBuffer[i] = 0;
		}
		let b: number;
		try {
			b = this.mInputStream.read();
			if (b >= 0) {
				value |= b & 0x7f;
				dstBuffer[7] = value & 0xff;
				if ((b & 0x80) !== 0) {
					b = this.mInputStream.read();
					if (b >= 0) {
						value |= (b & 0x7f) << 7;
						dstBuffer[7] = value & 0xff;
						value >>= 8;
						dstBuffer[6] = value & 0xff;
						if ((b & 0x80) !== 0) {
							b = this.mInputStream.read();
							if (b >= 0) {
								value |= (b & 0x7f) << 6;
								dstBuffer[6] = value & 0xff;
								value >>= 8;
								dstBuffer[5] = value & 0xff;
								if ((b & 0x80) !== 0) {
									b = this.mInputStream.read();
									if (b >= 0) {
										value |= (b & 0x7f) << 5;
										dstBuffer[5] = value & 0xff;
										value >>= 8;
										dstBuffer[4] = value & 0xff;
										if ((b & 0x80) !== 0) {
											b = this.mInputStream.read();
											if (b >= 0) {
												value |= (b & 0x7f) << 4;
												dstBuffer[4] = value & 0xff;
												value >>= 8;
												dstBuffer[3] = value & 0xff;
												if ((b & 0x80) !== 0) {
													b = this.mInputStream.read();
													if (b >= 0) {
														value |= (b & 0x7f) << 3;
														dstBuffer[3] = value & 0xff;
														value >>= 8;
														dstBuffer[2] = value & 0xff;
														if ((b & 0x80) !== 0) {
															b = this.mInputStream.read();
															if (b >= 0) {
																value |= (b & 0x7f) << 2;
																dstBuffer[2] = value & 0xff;
																value >>= 8;
																dstBuffer[1] = value & 0xff;
																if ((b & 0x80) !== 0) {
																	b = this.mInputStream.read();
																	if (b >= 0) {
																		value |= (b & 0x7f) << 1;
																		dstBuffer[1] = value & 0xff;
																		value >>= 8;
																		dstBuffer[0] = value & 0xff;
																		if ((b & 0x80) !== 0) {
																			b = this.mInputStream.read();
																			if (b >= 0) {
																				value |= b & 0x7f;
																				dstBuffer[0] = value & 0xff;
																				if ((b & 0x80) !== 0) {
																					b = this.mInputStream.read();
																					if (b >= 0) {
																						value |= (b & 0x7f) << 7;
																						dstBuffer[0] = value & 0xff;
																					}
																				}
																			}
																		}
																	}
																}
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
			let leftShitf1 = new ArrayBuffer(8);
			let srcBuffer: Uint8Array = new Uint8Array(buffer, 0, 8);
			dstBuffer = new Uint8Array(leftShitf1, 0, 8);
			for (let i: number = 1; i < 8; i++) {
				dstBuffer[i] = (srcBuffer[i] >>> 1) | ((srcBuffer[i - 1] & 0x1) << 7);
			}
			dstBuffer[0] = srcBuffer[0] >>> 1;
			b = srcBuffer[7] & 1;
			srcBuffer = new Uint8Array(leftShitf1, 0, 8);
			dstBuffer = new Uint8Array(buffer, 0, 8);
			for (let i: number = 0; i < 8; i++) {
				if (b === 1) {
					dstBuffer[i] = srcBuffer[i] ^ 0xff;
				} else {
					dstBuffer[i] = srcBuffer[i];
				}
			}
			return buffer;
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	public readUUID(): UUID {
		try {
			const buff = new ArrayBuffer(16);
			this.mInputStream.readBuffer(buff, 0, buff.byteLength);
			const reversedBuff = new Uint8Array(buff);
			return new UUID(reversedBuff.reverse().buffer);
		} catch (exception) {
			throw new SerializerException();
		}
	}

	public readOptionalUUID(): UUID | null {
		if (this.readBoolean()) {
			return this.readUUID();
		} else {
			return null;
		}
	}

	public readEnum(): number {
		return this.readInt();
	}

	public readString(): string {
		try {
			let length: number = this.readInt();
			if (length === 0) {
				return "";
			}
			let buffer: ArrayBuffer = new ArrayBuffer(length);
			this.doReadBytes(buffer, 0, length);
			return this.textDecoder.decode(buffer);
		} catch (exception) {
			throw new SerializerException(exception);
		}
	}

	public readOptionalString(): string | null {
		if (this.readInt() === 1) {
			return this.readString();
		} else {
			return null;
		}
	}

	public readBytes(buffer: ArrayBuffer): ArrayBuffer {
		const length: number = this.readInt();
		let lBuffer: ArrayBuffer;
		if (buffer != null && length <= buffer.byteLength) {
			throw new SerializerException("Need Implementation");
		} else {
			lBuffer = new ArrayBuffer(length);
		}
		this.doReadBytes(lBuffer, 0, length);
		return lBuffer;
	}

	public readOptionalBytes(buffer: ArrayBuffer): ArrayBuffer | null {
		if (this.readInt() === 1) {
			return this.readBytes(buffer);
		} else {
			return null;
		}
	}

	public readFixed(bytes: ArrayBuffer, start: number, length: number): void {
		this.doReadBytes(bytes, start, length);
	}

	private doReadBytes(bytes: ArrayBuffer, start: number, length: number): void {
		while (true) {
			let n: number;
			try {
				n = this.mInputStream.readBuffer(bytes, start, length);
			} catch (exception) {
				throw new SerializerException(exception);
			}
			if (n === length || length === 0) {
				return;
			}
			if (n < 0) {
				throw new SerializerException();
			}
			start += n;
			length -= n;
		}
	}

	private readBinaryLong(): number {
		let value: number;
		value = this.mInputStream.read();
		value |= ((n) => (n < 0 ? Math.ceil(n) : Math.floor(n)))(this.mInputStream.read() as number) << 8;
		value |= ((n) => (n < 0 ? Math.ceil(n) : Math.floor(n)))(this.mInputStream.read() as number) << 16;
		value |= ((n) => (n < 0 ? Math.ceil(n) : Math.floor(n)))(this.mInputStream.read() as number) << 24;
		value |= ((n) => (n < 0 ? Math.ceil(n) : Math.floor(n)))(this.mInputStream.read() as number) << 32;
		value |= ((n) => (n < 0 ? Math.ceil(n) : Math.floor(n)))(this.mInputStream.read() as number) << 40;
		value |= ((n) => (n < 0 ? Math.ceil(n) : Math.floor(n)))(this.mInputStream.read() as number) << 48;
		let b: number = this.mInputStream.read();
		if (b < 0) {
			throw new SerializerException();
		}
		value |= b << 56;
		return value;
	}
}
