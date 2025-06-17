/*
 *  Copyright (c) 2022-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
export class Version {
	public major: number;
	public minor: number;
	public patch: number;

	public constructor(major?: number | string | null, minor?: number | string | null) {
		if ((typeof major === "number" || major === null) && (typeof minor === "number" || minor === null)) {
			this.major = major === null ? 0 : major;
			this.minor = minor === null ? 0 : minor;
			this.patch = 0;
		} else if ((typeof major === "string" || major === null) && minor === undefined) {
			const __args = arguments;
			const version: string = __args[0];
			const numbers: string[] = version.trim().split("\\.");
			if (numbers.length > 0) {
				this.major = Version.toInteger(numbers[0]);
				if (numbers.length > 1) {
					this.minor = Version.toInteger(numbers[1]);
					if (numbers.length > 2) {
						this.patch = Version.toInteger(numbers[2]);
					} else {
						this.patch = 0;
					}
				} else {
					this.minor = 0;
					this.patch = 0;
				}
			} else {
				this.major = 0;
				this.minor = 0;
				this.patch = 0;
			}
		} else throw new Error("invalid overload");
	}

	/**
	 * Compare two versions.
	 *
	 * @param   {Version} second the object to be compared.
	 * @return  {number} a negative integer, zero, or a positive integer as this object
	 * is less than, equal to, or greater than the specified object.
	 */
	public compareTo(second: Version): number {
		let result: number = this.major - second.major;
		if (result !== 0) {
			return result;
		}
		result = this.minor - second.minor;
		if (result !== 0) {
			return result;
		}
		return this.patch - second.patch;
	}

	public toString(): string {
		return this.major + "." + this.minor + "." + this.patch;
	}

	/**
	 * Convert the string to an integer handling errors.
	 *
	 * @param {string} value the value to convert.
	 * @return {number} the integer value or 0.
	 */
	static toInteger(value: string): number {
		try {
			return parseInt(value);
		} catch (ignored: unknown) {
			return 0;
		}
	}
}
