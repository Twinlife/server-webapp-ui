/*
 *  Copyright (c) 2015-2022 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { UUID } from "./UUID";

export interface Encoder {
	writeBoolean(value: boolean): void;

	writeZero(): void;

	writeInt(value: number): void;

	writeLong(value: number): void;

	writeUUID(value: UUID): void;

	writeOptionalUUID(value: UUID | null): void;

	writeEnum(value: number): void;

	writeString(value: string): void;

	writeOptionalString(value: string | null): void;

	writeData(bytes: ArrayBuffer): void;

	writeOptionalBytes(bytes: ArrayBuffer | null): void;

	writeBytes(bytes: ArrayBuffer, start: number, length: number): void;

	writeFixed(bytes: ArrayBuffer, start: number, length: number): void;
}
