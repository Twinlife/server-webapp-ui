/*
 *  Copyright (c) 2022, 2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
/**
 * An event that informs about a change on the call participant.
 * @enum
 * @property {CallParticipantEvent} EVENT_IDENTITY
 * @property {CallParticipantEvent} EVENT_AUDIO_ON
 * @property {CallParticipantEvent} EVENT_AUDIO_OFF
 * @property {CallParticipantEvent} EVENT_VIDEO_ON
 * @property {CallParticipantEvent} EVENT_VIDEO_OFF
 * @property {CallParticipantEvent} EVENT_RINGING
 * @class
 */
export enum CallParticipantEvent {
	EVENT_IDENTITY,
	EVENT_AUDIO_ON,
	EVENT_AUDIO_OFF,
	EVENT_VIDEO_ON,
	EVENT_VIDEO_OFF,
	EVENT_RINGING
}
