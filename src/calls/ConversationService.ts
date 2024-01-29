/*
 *  Copyright (c) 2015-2024 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Houssem Temanni (Houssem.Temanni@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { UUID } from "../utils/UUID";

export namespace ConversationService {
	export const VERSION: string = "2.16.1";
	export enum Permission {
		INVITE_MEMBER,
		UPDATE_MEMBER,
		REMOVE_MEMBER,
		SEND_MESSAGE,
		SEND_IMAGE,
		SEND_AUDIO,
		SEND_VIDEO,
		SEND_FILE,
		DELETE_MESSAGE,
		DELETE_IMAGE,
		DELETE_AUDIO,
		DELETE_VIDEO,
		DELETE_FILE,
		RESET_CONVERSATION,
		SEND_GEOLOCATION,
		SEND_TWINCODE,
		RECEIVE_MESSAGE,
		SEND_COMMAND,
	}

	export class DescriptorId {
		readonly twincodeOutboundId: UUID;
		readonly sequenceId: number;

		public constructor(twincodeOutboundId: UUID, sequenceId: number) {
			this.twincodeOutboundId = twincodeOutboundId;
			this.sequenceId = sequenceId;
		}

		public equals(object: any): boolean {
			if (!(object != null && object instanceof <any>ConversationService.DescriptorId)) {
				return false;
			}
			const descriptorId: ConversationService.DescriptorId = <ConversationService.DescriptorId>object;
			return (
				descriptorId.twincodeOutboundId.compareTo(this.twincodeOutboundId) == 0 &&
				descriptorId.sequenceId === this.sequenceId
			);
		}

		public toString(): string {
			return this.twincodeOutboundId + ":" + this.sequenceId;
		}
	}

	export enum AnnotationType {
		FORWARD,
		FORWARDED,
		SAVE,
		LIKE,
		POLL,
	}

	export class DescriptorAnnotation {
		mType: ConversationService.AnnotationType | null = null;

		mCount: number = 0;

		mValue: number = 0;

		public constructor(type: ConversationService.AnnotationType, value: number, count: number) {
			this.mType = type;
			this.mValue = value;
			this.mCount = count;
		}

		public getType(): ConversationService.AnnotationType | null {
			return this.mType;
		}

		public getCount(): number {
			return this.mCount;
		}

		public getValue(): number {
			return this.mValue;
		}
	}

	export class Descriptor {
		readonly type: Descriptor.Type;
		readonly twincodeOutboundId: UUID;
		readonly sequenceId: number;
		readonly replyTo: DescriptorId | null;
		readonly sendTo: UUID | null;
		readonly expireTimeout: number;

		readonly createdTimestamp: number;
		updatedTimestamp: number = 0;
		sentTimestamp: number = 0;
		receivedTimestamp: number = 0;
		readTimestamp: number = 0;
		deletedTimestamp: number = 0;
		peerDeletedTimestamp: number = 0;

		constructor(
			type: Descriptor.Type,
			twincodeOutboundId: UUID,
			sequenceId: number,
			expireTimeout: number,
			replyTo: DescriptorId | null,
			sendTo: UUID | null,
			createdTimestamp: number
		) {
			this.type = type;
			this.twincodeOutboundId = twincodeOutboundId;
			this.sequenceId = sequenceId;
			this.expireTimeout = expireTimeout;
			this.replyTo = replyTo;
			this.sendTo = sendTo;
			this.createdTimestamp = createdTimestamp;
		}

		isExpired(): boolean {
			return false;
		}
	}

	export namespace Descriptor {
		export enum Type {
			DESCRIPTOR,
			OBJECT_DESCRIPTOR,
			TRANSIENT_OBJECT_DESCRIPTOR,
			FILE_DESCRIPTOR,
			IMAGE_DESCRIPTOR,
			AUDIO_DESCRIPTOR,
			VIDEO_DESCRIPTOR,
			NAMED_FILE_DESCRIPTOR,
			INVITATION_DESCRIPTOR,
			GEOLOCATION_DESCRIPTOR,
			TWINCODE_DESCRIPTOR,
			CALL_DESCRIPTOR,
			CLEAR_DESCRIPTOR,
		}
	}

	export class MessageDescriptor extends ConversationService.Descriptor {
		readonly message: string;
		readonly copyAllowed: boolean;

		constructor(
			twincodeOutboundId: UUID,
			sequenceId: number,
			expireTimeout: number,
			replyTo: DescriptorId | null,
			sendTo: UUID | null,
			createdTimestamp: number,
			message: string,
			copyAllowed: boolean
		) {
			super(
				Descriptor.Type.OBJECT_DESCRIPTOR,
				twincodeOutboundId,
				sequenceId,
				expireTimeout,
				replyTo,
				sendTo,
				createdTimestamp
			);
			this.message = message;
			this.copyAllowed = copyAllowed;
		}
	}

	export class TransientMessageDescriptor extends ConversationService.Descriptor {}

	export class TwincodeDescriptor extends ConversationService.Descriptor {
		readonly twincodeId: UUID;
		readonly schemaId: UUID;
		readonly copyAllowed: boolean;

		constructor(
			twincodeOutboundId: UUID,
			sequenceId: number,
			expireTimeout: number,
			replyTo: DescriptorId | null,
			sendTo: UUID | null,
			createdTimestamp: number,
			twincodeId: UUID,
			schemaId: UUID,
			copyAllowed: boolean
		) {
			super(
				Descriptor.Type.TWINCODE_DESCRIPTOR,
				twincodeOutboundId,
				sequenceId,
				expireTimeout,
				replyTo,
				sendTo,
				createdTimestamp
			);

			this.twincodeId = twincodeId;
			this.schemaId = schemaId;
			this.copyAllowed = copyAllowed;
		}
	}

	export enum UpdateType {
		CONTENT,
		TIMESTAMPS,
		LOCAL_ANNOTATIONS,
		PEER_ANNOTATIONS,
	}

	export class GeolocationDescriptor extends ConversationService.Descriptor {
		longitude: number = 0;
		latitude: number = 0;
		altitude: number = 0;
		mapLongitudeDelta: number = 0;
		mapLatitudeDelta: number = 0;
		localMapPath: string | null = null;
	}

	export enum ClearMode {
		CLEAR_MEDIA,
		CLEAR_LOCAL,
		CLEAR_BOTH_MEDIA,
		CLEAR_BOTH,
	}
}
