/*
 *  Copyright (c) 2020 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 */
import { UUID } from "./UUID";

export class SchemaKey {
	public schemaId: UUID;
	public version: number;

	public constructor(schemaId: UUID, version: number) {
		this.schemaId = schemaId;
		this.version = version;
	}

	public equals(object: UUID): boolean {
		if (!(object != null && object instanceof SchemaKey)) {
			return false;
		}
		const key: SchemaKey = object as SchemaKey;
		return this.schemaId.equals(key.schemaId) && this.version === key.version;
	}

	public toString(): string {
		return this.schemaId + ":" + this.version;
	}
}
