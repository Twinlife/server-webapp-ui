/*
 *  Copyright (c) 2017-2018 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
export class SerializerException extends Error {
	public constructor(exception?: any) {
		if (
			(exception != null &&
				exception["__classes"] &&
				exception["__classes"].indexOf("java.lang.Exception") >= 0) ||
			(exception != null && exception instanceof Error) ||
			exception === null
		) {
			super(exception);
			this.message = exception;
			Object.setPrototypeOf(this, SerializerException.prototype);
		} else if (typeof exception === "string" || exception === null) {
			let __args = arguments;
			let message: any = __args[0];
			super(message);
			this.message = message;
			Object.setPrototypeOf(this, SerializerException.prototype);
		} else if (exception === undefined) {
			super();
			Object.setPrototypeOf(this, SerializerException.prototype);
		} else throw new Error("invalid overload");
	}
}
