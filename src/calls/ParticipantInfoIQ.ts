/*
 *  Copyright (c) 2022-2024 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { BinaryPacketIQ } from "../utils/BinaryPacketIQ";
import { Decoder } from "../utils/Decoder";
import { Encoder } from "../utils/Encoder";
import { UUID } from "../utils/UUID";

/**
 * Participant info IQ sent to a call group member to share the participant name and picture.
 *
 * Schema version 1
 * <pre>
 * {
 * "schemaId":"a8aa7e0d-c495-4565-89bb-0c5462b54dd0",
 * "schemaVersion":"1",
 *
 * "type":"record",
 * "name":"ParticipantInfoIQ",
 * "namespace":"org.twinlife.schemas.calls",
 * "super":"org.twinlife.schemas.BinaryPacketIQ"
 * "fields": [
 * {"name":"memberId", "type":"String"},
 * {"name":"name", "type":"String"},
 * {"name":"description", [null, "type":"String"}],
 * {"name":"avatar", [null, "type":"bytes"]}
 * ]
 * }
 *
 * </pre>
 * @extends BinaryPacketIQ
 * @class
 */
export class ParticipantInfoIQ extends BinaryPacketIQ {
	public static createSerializer(schemaId: UUID, schemaVersion: number): BinaryPacketIQ.BinaryPacketIQSerializer {
		return new ParticipantInfoIQ.ParticipantInfoIQSerializer(schemaId, schemaVersion);
	}

	memberId: string;
	name: string;
	description: string | null;
	thumbnailData: ArrayBuffer | null;

	constructor(
		serializer: BinaryPacketIQ.BinaryPacketIQSerializer,
		requestId: number,
		memberId: string,
		name: string,
		description: string | null,
		thumbnailData: ArrayBuffer | null,
	) {
		super(serializer, requestId);
		this.memberId = memberId;
		this.name = name;
		this.description = description;
		this.thumbnailData = thumbnailData;
	}
}

export namespace ParticipantInfoIQ {
	export class ParticipantInfoIQSerializer extends BinaryPacketIQ.BinaryPacketIQSerializer {
		constructor(schemaId: UUID, schemaVersion: number) {
			super(schemaId, schemaVersion);
		}

		public serialize(encoder: Encoder, object: ParticipantInfoIQ): void {
			super.serialize(encoder, object);
			const participantInfoIQ: ParticipantInfoIQ = object as ParticipantInfoIQ;
			encoder.writeString(participantInfoIQ.memberId);
			encoder.writeString(participantInfoIQ.name);
			encoder.writeOptionalString(participantInfoIQ.description);
			encoder.writeOptionalBytes(participantInfoIQ.thumbnailData);
		}

		public deserialize(decoder: Decoder): ParticipantInfoIQ {
			const serviceRequestIQ: BinaryPacketIQ = super.deserialize(decoder) as BinaryPacketIQ;
			const memberId: string = decoder.readString();
			const name: string = decoder.readString();
			const description: string | null = decoder.readOptionalString();
			const thumbnailData: ArrayBuffer | null = decoder.readOptionalBytes(null);
			return new ParticipantInfoIQ(
				this,
				serviceRequestIQ.getRequestId(),
				memberId,
				name,
				description,
				thumbnailData,
			);
		}
	}
}
