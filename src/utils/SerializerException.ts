/*
 *  Copyright (c) 2017-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
export class SerializerException extends Error {
	public constructor(exception?: unknown) {
		if (exception === null) {
			super("Serialize error");
		} else if (exception instanceof Error) {
			super(exception.message);
			this.message = exception.message;
		} else if (typeof exception === "string") {
			super(exception);
			this.message = exception;
		} else if (exception === undefined) {
			super("Unknown error");
		} else throw new Error("invalid overload");
	}
}
