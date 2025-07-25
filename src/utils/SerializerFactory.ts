/*
 *  Copyright (c) 2015-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 */
import { Serializer } from "./Serializer";
import { UUID } from "./UUID";

export interface SerializerFactory {
	getObjectSerializer(object: unknown): Serializer;

	getSerializer(schemaId: UUID, schemaVersion: number): Serializer;
}
