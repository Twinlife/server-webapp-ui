/*
 *  Copyright (c) 2021-2024 twinlife SA.
 *
 *  All Rights Reserved.
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
 * PushObject IQ.
 * <p>
 * Schema version 5
 * Date: 2021/04/07
 *
 * <pre>
 * {
 * "schemaId":"26e3a3bd-7db0-4fc5-9857-bbdb2032960e",
 * "schemaVersion":"5",
 *
 * "type":"record",
 * "name":"PushObjectIQ",
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
 * {"name":"object", "type":"Object"}
 * {"name":"copyAllowed", "type":"boolean"}
 * ]
 * }
 *
 * </pre>
 * @extends BinaryPacketIQ
 * @class
 */
export class PushObjectIQ extends BinaryPacketIQ {
	public static createSerializer(schemaId: UUID, schemaVersion: number): BinaryPacketIQ.BinaryPacketIQSerializer {
		return new PushObjectIQ.PushObjectIQSerializer(schemaId, schemaVersion);
	}

	readonly descriptor: ConversationService.MessageDescriptor;

	constructor(
		serializer: BinaryPacketIQ.BinaryPacketIQSerializer,
		requestId: number,
		MessageDescriptorImpl: ConversationService.MessageDescriptor
	) {
		super(serializer, requestId);
		this.descriptor = MessageDescriptorImpl;
	}
}

export namespace PushObjectIQ {
	export class PushObjectIQSerializer extends BinaryPacketIQ.BinaryPacketIQSerializer {
		static MESSAGE_SCHEMA_ID: UUID = UUID.fromString("c1ba9e82-43a7-413a-ab9f-b743859e7595");

		constructor(schemaId: UUID, schemaVersion: number) {
			super(schemaId, schemaVersion);
		}

		public serialize(encoder: Encoder, object: any): void {
			super.serialize(encoder, object);
			let pushObjectIQ: PushObjectIQ = <PushObjectIQ>object;
			let descriptor: ConversationService.MessageDescriptor | null = pushObjectIQ.descriptor;
			encoder.writeUUID(descriptor.twincodeOutboundId);
			encoder.writeLong(descriptor.sequenceId);
			encoder.writeOptionalUUID(descriptor.sendTo);
			let replyTo: ConversationService.DescriptorId | null = descriptor.replyTo;
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
			encoder.writeUUID(PushObjectIQSerializer.MESSAGE_SCHEMA_ID);
			encoder.writeInt(1);
			encoder.writeString(descriptor.message);
			encoder.writeBoolean(descriptor.copyAllowed);
		}

		public deserialize(decoder: Decoder): any {
			const serviceRequestIQ: BinaryPacketIQ = super.deserialize(decoder) as BinaryPacketIQ;
			let twincodeOutboundId: UUID = decoder.readUUID();
			let sequenceId: number = decoder.readLong();
			let sendTo: UUID | null = decoder.readOptionalUUID();
			let replyTo: ConversationService.DescriptorId | null;
			if (decoder.readEnum() == 1) {
				let replyToTwincode = decoder.readUUID();
				let replyToSequence = decoder.readLong();
				replyTo = new ConversationService.DescriptorId(replyToTwincode, replyToSequence);
			} else {
				replyTo = null;
			}
			let createdTimestamp: number = decoder.readLong();
			let sentTimestamp: number = decoder.readLong();
			let expireTimeout: number = decoder.readLong();
			let schemaId: UUID = decoder.readUUID();
			let schemaVersion: number = decoder.readInt();
			if (schemaId.compareTo(PushObjectIQSerializer.MESSAGE_SCHEMA_ID) != 0) {
				return null;
			}
			let message: string = decoder.readString();
			let copyAllowed: boolean = decoder.readBoolean();
			let descriptor: ConversationService.MessageDescriptor = new ConversationService.MessageDescriptor(
				twincodeOutboundId,
				sequenceId,
				expireTimeout,
				replyTo,
				sendTo,
				createdTimestamp,
				message,
				copyAllowed
			);
			descriptor.sentTimestamp = sentTimestamp;
			return new PushObjectIQ(this, serviceRequestIQ.mRequestId, descriptor);
		}
	}
}
