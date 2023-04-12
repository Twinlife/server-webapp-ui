/*
 *  Copyright (c) 2022 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { CallParticipant } from "./CallParticipant";
import { CallParticipantEvent } from "./CallParticipantEvent";

/**
 * Observer interface to be informed when a new call participant arrives, leaves or is updated.
 * @class
 */
export interface CallParticipantObserver {
	/**
	 * A new participant is added to the call group.
	 *
	 * @param {CallParticipant} participant the participant.
	 */
	onAddParticipant(participant: CallParticipant): void;

	/**
	 * One or several participants are removed from the call.
	 *
	 * @param {CallParticipant[]} participants the list of participants being removed.
	 */
	onRemoveParticipants(participants: Array<CallParticipant>): void;

	/**
	 * An event occurred for the participant and its state was changed.
	 *
	 * @param {CallParticipant} participant the participant.
	 * @param {CallParticipantEvent} event the event that occurred.
	 */
	onEventParticipant(participant: CallParticipant, event: CallParticipantEvent): void;
}
