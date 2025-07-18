/*
 *  Copyright (c) 2021-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { BinaryPacketIQ } from "../utils/BinaryPacketIQ";
import { Decoder } from "../utils/Decoder";
import { Encoder } from "../utils/Encoder";
import { UUID } from "../utils/UUID";
import { ConversationService } from "./ConversationService";

/**
 * PushTwincode IQ.
 * <p>
 * Schema version 2
 * Date: 2021/04/07
 *
 * <pre>
 * {
 * "schemaId":"72863c61-c0a9-437b-8b88-3b78354e54b8",
 * "schemaVersion":"2",
 *
 * "type":"record",
 * "name":"PushTwincodeIQ",
 * "namespace":"org.twinlife.schemas.conversation",
 * "super":"org.twinlife.schemas.BinaryPacketIQ"
 * "fields": [
 * {"name":"twincodeOutboundId", "type":"uuid"}
 * {"name":"sequenceId", "type":"long"}
 * {"name":"sendToTwincodeOutboundId", "type":["null", "UUID"]},
 * {"name":"replyTo", "type":["null", {
 * {"name":"twincodeOutboundId", "type":"uuid"},
 * {"name":"sequenceId", "type":"long"}
 * }},
 * {"name":"createdTimestamp", "type":"long"}
 * {"name":"sentTimestamp", "type":"long"}
 * {"name":"expireTimeout", "type":"long"}
 * {"name":"twincode", "type":"UUID"}
 * {"name":"schemaId", "type":"UUID"}
 * {"name":"copyAllowed", "type":"boolean"}
 * ]
 * }
 *
 * </pre>
 * @extends BinaryPacketIQ
 * @class
 */
export class PushTwincodeIQ extends BinaryPacketIQ {
	readonly twincodeDescriptor: ConversationService.TwincodeDescriptor;

	constructor(
		serializer: BinaryPacketIQ.BinaryPacketIQSerializer,
		requestId: number,
		twincodeDescriptor: ConversationService.TwincodeDescriptor,
	) {
		super(serializer, requestId);
		this.twincodeDescriptor = twincodeDescriptor;
	}

	static createSerializer(schemaId: UUID, schemaVersion: number): BinaryPacketIQ.BinaryPacketIQSerializer {
		return new PushTwincodeIQ.PushTwincodeIQSerializer(schemaId, schemaVersion);
	}
}

export namespace PushTwincodeIQ {
	export class PushTwincodeIQSerializer extends BinaryPacketIQ.BinaryPacketIQSerializer {
		constructor(schemaId: UUID, schemaVersion: number) {
			super(schemaId, schemaVersion);
		}
		public serialize(encoder: Encoder, object: PushTwincodeIQ): void {
			super.serialize(encoder, object);
			const pushTwincodeIQ: PushTwincodeIQ = <PushTwincodeIQ>object;
			const descriptor: ConversationService.TwincodeDescriptor = pushTwincodeIQ.twincodeDescriptor;
			encoder.writeUUID(descriptor.twincodeOutboundId);
			encoder.writeLong(descriptor.sequenceId);
			encoder.writeOptionalUUID(descriptor.sendTo);
			const replyTo: ConversationService.DescriptorId | null = descriptor.replyTo;
			if (replyTo == null || replyTo.twincodeOutboundId == null) {
				encoder.writeEnum(0);
			} else {
				encoder.writeEnum(1);
				encoder.writeUUID(replyTo.twincodeOutboundId);
				encoder.writeLong(replyTo.sequenceId);
			}
			encoder.writeLong(descriptor.createdTimestamp);
			encoder.writeLong(descriptor.sentTimestamp);
			encoder.writeLong(descriptor.expireTimeout);
			encoder.writeUUID(descriptor.twincodeId);
			encoder.writeUUID(descriptor.schemaId);
			encoder.writeBoolean(descriptor.copyAllowed);
		}

		public deserialize(decoder: Decoder): PushTwincodeIQ | null {
			const requestId: number = decoder.readLong();
			const twincodeOutboundId: UUID = decoder.readUUID();
			const sequenceId: number = decoder.readLong();
			const sendTo: UUID | null = decoder.readOptionalUUID();
			let replyTo: ConversationService.DescriptorId | null;
			if (decoder.readEnum() == 1) {
				const replyToTwincode = decoder.readUUID();
				const replyToSequence = decoder.readLong();
				replyTo = new ConversationService.DescriptorId(replyToTwincode, replyToSequence);
			} else {
				replyTo = null;
			}
			const createdTimestamp: number = decoder.readLong();
			const sentTimestamp: number = decoder.readLong();
			const expireTimeout: number = decoder.readLong();
			const twincodeId: UUID = decoder.readUUID();
			const schemaId: UUID = decoder.readUUID();
			const copyAllowed: boolean = decoder.readBoolean();
			const descriptor: ConversationService.TwincodeDescriptor = new ConversationService.TwincodeDescriptor(
				twincodeOutboundId,
				sequenceId,
				expireTimeout,
				replyTo,
				sendTo,
				createdTimestamp,
				twincodeId,
				schemaId,
				copyAllowed,
			);
			descriptor.sentTimestamp = sentTimestamp;
			return new PushTwincodeIQ(this, requestId, descriptor);
		}
	}
}
