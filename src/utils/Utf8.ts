/*
 *  Copyright (c) 2015-2025 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
export class Utf8 {
	public static UTF8: string;
	public static UTF8_$LI$(): string {
		if (Utf8.UTF8 == null) Utf8.UTF8 = "UTF-8";
		return Utf8.UTF8;
	}

	public static getBytes(content: string): Uint8Array | null {
		if (content == null) {
			return null;
		}
		const textEncoder = new TextEncoder();
		const bytes: Uint8Array = textEncoder.encode(content);
		return bytes;
	}

	public static create(data: ArrayBuffer, _length: number): string {
		const textDecoder: TextDecoder = new TextDecoder("utf-8");
		return textDecoder.decode(data);
	}
}
