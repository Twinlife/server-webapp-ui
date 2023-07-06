/*
 *  Copyright (c) 2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
import { BinaryPacketIQ } from "../utils/BinaryPacketIQ";
import { Decoder } from "../utils/Decoder";
import { Encoder } from "../utils/Encoder";
import { UUID } from "../utils/UUID";

/**
 * IQ sent by the transfer target (browser) to the transferred participant
 * once the connection with the other participant has been established.
 * At this point the transferred participant knows they can terminate the call.
 * <p>
 * Schema version 1
 * <pre>
 * {
 *  "schemaId":"641bf1f6-ebbf-4501-9151-76abc1b9adad",
 *  "schemaVersion":"1",
 *
 *  "type":"record",
 *  "name":"TransferDoneIQ",
 *  "namespace":"org.twinlife.schemas.calls",
 *  "super":"org.twinlife.schemas.BinaryPacketIQ"
 * }
 *
 * </pre>
 *
 * @extends BinaryPacketIQ
 * @class
 */
export class TransferDoneIQ extends BinaryPacketIQ {
	public static createSerializer(schemaId: UUID, schemaVersion: number): BinaryPacketIQ.BinaryPacketIQSerializer {
		return new TransferDoneIQ.TransferDoneIQSerializer(schemaId, schemaVersion);
	}

	constructor(
		serializer: BinaryPacketIQ.BinaryPacketIQSerializer,
		requestId: number
	) {
		super(serializer, requestId);
	}
}

export namespace TransferDoneIQ {
	export class TransferDoneIQSerializer extends BinaryPacketIQ.BinaryPacketIQSerializer {
		constructor(schemaId: UUID, schemaVersion: number) {
			super(schemaId, schemaVersion, TransferDoneIQ);
		}

		public serialize(encoder: Encoder, object: any): void {
			super.serialize(encoder, object);
		}

		public deserialize(decoder: Decoder): any {
			let serviceRequestIQ: BinaryPacketIQ = super.deserialize(decoder) as BinaryPacketIQ;
			return new TransferDoneIQ(this, serviceRequestIQ.getRequestId());
		}
	}
}
