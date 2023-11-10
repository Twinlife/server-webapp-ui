/*
 *  Copyright (c) 2019-2020 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twin.life)
 *   Olivier Dupont (Oliver.Dupont@twin.life)
 */

/*
 * Derived from UUID.java
 *  https://android.googlesource.com/platform/libcore (f8dfc9872ecc2f8c3cbc7cb747c2f010f14b3247)
 *  ojluni/src/main/java/java/util/UUID.java
 */

/*
 * Copyright (c) 1995, 2013, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */

export class UUID {
	private value: ArrayBuffer = new ArrayBuffer(16);

	public constructor(value1: any, value2?: any) {
		if (value1 != null && value1 instanceof ArrayBuffer && value2 === undefined) {
			this.value = value1;
		} else if (value1 !== null && value1 instanceof Buffer && value1.byteLength === 16 && value2 === undefined) {
			this.value = new ArrayBuffer(16);
			const srcBuffer: Uint8Array = new Uint8Array(value1);
			const dstBuffer: Uint8Array = new Uint8Array(this.value);
			dstBuffer.set(srcBuffer);
		} else if (value1 === 0 && value2 === 0) {
			this.value = new ArrayBuffer(16);
			const dstBuffer: Uint8Array = new Uint8Array(this.value);
			for (let i = 0; i < 16; i++) {
				dstBuffer[i] = 0;
			}
		} else {
			throw new Error("Invalid UUID constructor");
		}
	}

	public constructor$byte_A(value: ArrayBuffer) {
		this.value = value;
	}

	public static fromString(name: string): UUID {
		const buffer: ArrayBuffer = new ArrayBuffer(16);
		const dstBuffer: Uint8Array = new Uint8Array(buffer);
		for (let i = 0, index = 0; i < name.length && index < 16; i++) {
			if (name[i] === "-") {
				continue;
			}
			let value: number;
			let low: number = 0;
			let high: number = 0;
			for (let j = 0; j < 2; j++) {
				switch (name[i]) {
					case "0":
						value = 0;
						break;

					case "1":
						value = 1;
						break;

					case "2":
						value = 2;
						break;

					case "3":
						value = 3;
						break;

					case "4":
						value = 4;
						break;

					case "5":
						value = 5;
						break;

					case "6":
						value = 6;
						break;

					case "7":
						value = 7;
						break;

					case "8":
						value = 8;
						break;

					case "9":
						value = 9;
						break;

					case "a":
					case "A":
						value = 10;
						break;

					case "b":
					case "B":
						value = 11;
						break;

					case "c":
					case "C":
						value = 12;
						break;

					case "d":
					case "D":
						value = 13;
						break;

					case "e":
					case "E":
						value = 14;
						break;

					case "f":
					case "F":
						value = 15;
						break;
					default:
						value = 0;
						break;
				}
				if (j === 0) {
					high = value;
					i++;
				} else {
					low = value;
				}
			}
			dstBuffer[index++] = high * 16 + low;
		}
		return new UUID(buffer);
	}

	public getValue(): ArrayBuffer {
		return this.value;
	}

	public getLeastSignificantBits(): ArrayBuffer {
		const srcBuffer: Uint8Array = new Uint8Array(this.value, 8, 8);
		const buffer: ArrayBuffer = new ArrayBuffer(8);
		const dstBuffer: Uint8Array = new Uint8Array(buffer, 0, 8);
		dstBuffer.set(srcBuffer);
		return buffer;
	}

	public getMostSignificantBits(): ArrayBuffer {
		const srcBuffer: Uint8Array = new Uint8Array(this.value, 0, 8);
		const buffer: ArrayBuffer = new ArrayBuffer(8);
		const dstBuffer: Uint8Array = new Uint8Array(buffer, 0, 8);
		dstBuffer.set(srcBuffer);
		return buffer;
	}

	public hashCode(): number {
		const srcBuffer: Uint8Array = new Uint8Array(this.value);
		let result: number = 1;
		for (let i = 0; i < 16; i++) {
			result = 31 * result + srcBuffer[i];
		}
		return result;
	}

	public equals(obj: any): boolean {
		if (obj === undefined || obj === null || !(obj instanceof UUID)) {
			return false;
		}
		if (obj.value.byteLength !== 16) {
			return false;
		}
		for (let i = 0; i < 16; i++) {
			const srcBuffer1: Uint8Array = new Uint8Array(this.value);
			const srcBuffer2: Uint8Array = new Uint8Array(obj.getValue());
			if (srcBuffer1[i] !== srcBuffer2[i]) {
				return false;
			}
		}
		return true;
	}

	public isNull(): boolean {
		for (let i = 0; i < 16; i++) {
			const srcBuffer: Uint8Array = new Uint8Array(this.value);
			if (srcBuffer[i] !== 0) {
				return false;
			}
		}
		return true;
	}

	public compareTo(val: UUID): number {
		for (let i = 0; i < 16; i++) {
			const srcBuffer1: Uint8Array = new Uint8Array(this.value);
			const srcBuffer2: Uint8Array = new Uint8Array(val.getValue());
			if (srcBuffer1[i] === srcBuffer2[i]) {
				continue;
			}
			return srcBuffer1[i] > srcBuffer2[i] ? 1 : -1;
		}
		return 0;
	}

	public toString(): string {
		const srcBuffer: Uint8Array = new Uint8Array(this.value);
		let string: string = "";
		for (let i = 0; i < 16; i++) {
			for (let j = 0; j < 2; j++) {
				let value: number;
				if (j === 0) {
					value = (srcBuffer[i] >> 4) & 15;
				} else {
					value = srcBuffer[i] & 15;
				}
				switch (value) {
					case 0:
						string += "0";
						break;

					case 1:
						string += "1";
						break;

					case 2:
						string += "2";
						break;

					case 3:
						string += "3";
						break;

					case 4:
						string += "4";
						break;

					case 5:
						string += "5";
						break;

					case 6:
						string += "6";
						break;

					case 7:
						string += "7";
						break;

					case 8:
						string += "8";
						break;

					case 9:
						string += "9";
						break;

					case 10:
						string += "a";
						break;

					case 11:
						string += "b";
						break;

					case 12:
						string += "c";
						break;

					case 13:
						string += "d";
						break;

					case 14:
						string += "e";
						break;

					case 15:
						string += "f";
						break;

					default:
						break;
				}
			}
			if (i === 3 || i === 5 || i === 7 || i === 9) {
				string += "-";
			}
		}
		return string;
	}
}
// UUID["__class"] = "java.util.UUID";
// UUID["__interfaces"] = ["java.io.Serializable"];
