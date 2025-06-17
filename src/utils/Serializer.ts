/*
 *  Copyright (c) 2015-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
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

	public constructor(schemaId: UUID, schemaVersion: number) {
		this.schemaId = schemaId;
		this.schemaVersion = schemaVersion;
	}

	public abstract serialize(encoder: Encoder, object: unknown): void;

	public abstract deserialize(decoder: Decoder): unknown;
}
