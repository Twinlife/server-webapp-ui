/*
 *  Copyright (c) 2015-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { Decoder } from "./Decoder";
import { Encoder } from "./Encoder";
import { UUID } from "./UUID";

export abstract class Serializer {
	public schemaId: UUID;

	public schemaVersion: number = 0;

	public clazz: any = null;

	public constructor(schemaId: UUID, schemaVersion: number, clazz: any) {
		this.schemaId = schemaId;
		this.schemaVersion = schemaVersion;
		this.clazz = clazz;
	}

	public abstract serialize(encoder: Encoder, object: any): void;

	public abstract deserialize(decoder: Decoder): any;

	public isSupported(majorVersion: number, minorVersion: number): boolean {
		return true;
	}
}
