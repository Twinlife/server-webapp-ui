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

/**
 * OnPush IQ.
 * <p>
 * Schema version N
 * Date: 2021/04/07
 *
 * <pre>
 * {
 * "schemaId":"<XXXXX>",
 * "schemaVersion":"N",
 *
 * "type":"record",
 * "name":"OnPushIQ",
 * "namespace":"org.twinlife.schemas.conversation",
 * "super":"org.twinlife.schemas.BinaryPacketIQ"
 * "fields": [
 * {"name":"deviceState", "type":"byte"},
 * {"name":"receivedTimestamp", "type":"long"}
 * ]
 * }
 *
 * </pre>
 * @extends BinaryPacketIQ
 * @class
 */
export class OnPushIQ extends BinaryPacketIQ {
	readonly deviceState: number;
	readonly receivedTimestamp: number;

	constructor(
		serializer: BinaryPacketIQ.BinaryPacketIQSerializer,
		requestId: number,
		deviceState: number,
		receivedTimestamp: number
	) {
		super(serializer, requestId);
		this.deviceState = deviceState;
		this.receivedTimestamp = receivedTimestamp;
	}

	static createSerializer(schemaId: UUID, schemaVersion: number): BinaryPacketIQ.BinaryPacketIQSerializer {
		return new OnPushIQ.OnPushIQSerializer(schemaId, schemaVersion);
	}
}

export namespace OnPushIQ {
	export class OnPushIQSerializer extends BinaryPacketIQ.BinaryPacketIQSerializer {
		constructor(schemaId: UUID, schemaVersion: number) {
			super(schemaId, schemaVersion);
		}
		public serialize(encoder: Encoder, object: any): void {
			super.serialize(encoder, object);
			let onPushIQ: OnPushIQ = <OnPushIQ>object;
			encoder.writeInt(onPushIQ.deviceState);
			encoder.writeLong(onPushIQ.receivedTimestamp);
		}

		public deserialize(decoder: Decoder): any {
			let requestId: number = decoder.readLong();
			let deviceState: number = decoder.readInt();
			let receivedTimestamp: number = decoder.readLong();
			return new OnPushIQ(this, requestId, deviceState, receivedTimestamp);
		}
	}
}
