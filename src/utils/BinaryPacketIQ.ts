/*
 *  Copyright (c) 2020-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { UUID } from "./UUID";
import { Decoder } from "./Decoder";
import { Encoder } from "./Encoder";
import { Serializer } from "./Serializer";
import { BinaryCompactEncoder } from "./BinaryCompactEncoder";
import { ByteArrayOutputStream } from "./ByteArrayOutputStream";

/**
 * Base class of binary packets.
 * @param {BinaryPacketIQ.BinaryPacketIQSerializer} serializer
 * @param {BinaryPacketIQ} serviceRequestIQ
 * @class
 */
export class BinaryPacketIQ {
	public static SERIALIZER_BUFFER_DEFAULT_SIZE: number = 1024;

	public static createDefaultSerializer(schemaId: UUID, schemaVersion: number): BinaryPacketIQ.BinaryPacketIQSerializer {
		return new BinaryPacketIQ.BinaryPacketIQSerializer(schemaId, schemaVersion, BinaryPacketIQ);
	}

	mRequestId: number;
	mSerializer: BinaryPacketIQ.BinaryPacketIQSerializer;

	public constructor(serializer: BinaryPacketIQ.BinaryPacketIQSerializer, requestId: number) {
		this.mSerializer = serializer;
		this.mRequestId = requestId;
	}

	public getRequestId(): number {
		return this.mRequestId;
	}

	getBufferSize(): number {
		return BinaryPacketIQ.SERIALIZER_BUFFER_DEFAULT_SIZE;
	}

	public serializeCompact(): ArrayBuffer {
		let outputStream: ByteArrayOutputStream = new ByteArrayOutputStream(this.getBufferSize());
		let binaryEncoder: BinaryCompactEncoder = new BinaryCompactEncoder(outputStream);
		this.mSerializer.serialize(binaryEncoder, this);
		return outputStream.toByteArray();
}

	public toString(): string {
		return "BinaryPacketIQ[" + this.mRequestId + "]";
	}
}

export namespace BinaryPacketIQ {
	export class BinaryPacketIQSerializer extends Serializer {
		public constructor(schemaId: UUID, schemaVersion: number, clazz: any) {
			super(schemaId, schemaVersion, clazz);
		}

		public serialize(encoder: Encoder, serviceRequestIQ: BinaryPacketIQ): void {
			encoder.writeUUID(this.schemaId);
			encoder.writeInt(this.schemaVersion);
			encoder.writeLong(serviceRequestIQ.mRequestId);
		}

		public deserialize(decoder: Decoder): any {
			let requestId: number = decoder.readLong();
			return new BinaryPacketIQ(this, requestId);
		}
	}
}
