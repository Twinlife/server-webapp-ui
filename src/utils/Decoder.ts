/*
 *  Copyright (c) 2015-2021 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { UUID } from "./UUID";

export interface Decoder {
	readBoolean(): boolean;

	readInt(): number;

	readLong(): number;

	readUUID(): UUID;

	readOptionalUUID(): UUID | null;

	readEnum(): number;

	readString(): string;

	readOptionalString(): string | null;

	readBytes(old: ArrayBuffer): ArrayBuffer;

	readOptionalBytes(old: ArrayBuffer | null): ArrayBuffer | null;

	readFixed(bytes: ArrayBuffer, start: number, length: number): void;
}
