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
 * Participant transfer IQ sent to a call group member to indicate that a transfer is taking place.
 * Upon reception, the member which sent this IQ will be replaced by the member whose ID is found in the payload.
 *
 * Schema version 1
 * <pre>
 * {
 *  "schemaId":"800fd629-83c4-4d42-8910-1b4256d19eb8",
 *  "schemaVersion":"1",
 *
 *  "type":"record",
 *  "name":"ParticipantTransferIQ",
 *  "namespace":"org.twinlife.schemas.calls",
 *  "super":"org.twinlife.schemas.BinaryPacketIQ"
 *  "fields": [
 *     {"name":"memberId", "type":"String"}
 *  ]
 * }
 *
 * </pre>
 * @extends BinaryPacketIQ
 * @class
 */
export class ParticipantTransferIQ extends BinaryPacketIQ {
	public static createSerializer(schemaId: UUID, schemaVersion: number): BinaryPacketIQ.BinaryPacketIQSerializer {
		return new ParticipantTransferIQ.ParticipantInfoIQSerializer(schemaId, schemaVersion);
	}

	readonly memberId: string;

	constructor(serializer: BinaryPacketIQ.BinaryPacketIQSerializer, requestId: number, memberId: string) {
		super(serializer, requestId);
		this.memberId = memberId;
	}
}

export namespace ParticipantTransferIQ {
	export class ParticipantInfoIQSerializer extends BinaryPacketIQ.BinaryPacketIQSerializer {
		constructor(schemaId: UUID, schemaVersion: number) {
			super(schemaId, schemaVersion, ParticipantTransferIQ);
		}

		public serialize(encoder: Encoder, object: any): void {
			super.serialize(encoder, object);
			const participantInfoIQ: ParticipantTransferIQ = object as ParticipantTransferIQ;
			encoder.writeString(participantInfoIQ.memberId);
		}

		public deserialize(decoder: Decoder): any {
			let serviceRequestIQ: BinaryPacketIQ = super.deserialize(decoder) as BinaryPacketIQ;
			let memberId: string = decoder.readString();
			return new ParticipantTransferIQ(this, serviceRequestIQ.getRequestId(), memberId);
		}
	}
}
