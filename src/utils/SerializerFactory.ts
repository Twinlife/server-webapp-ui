/*
 *  Copyright (c) 2015-2022 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 */
import { UUID } from "./UUID";
import { Serializer } from "./Serializer";

export interface SerializerFactory {
	getObjectSerializer(object: any): Serializer;

	getSerializer(schemaId: UUID, schemaVersion: number): Serializer;
}
