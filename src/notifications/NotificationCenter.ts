/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { toast } from "react-toastify";
import { chatStore } from "../stores/chat";
import { notificationStore, NotificationState } from "../stores/notifications";
import { CallParticipant } from "../calls/CallParticipant";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";

const MEETING = import.meta.env.VITE_APP_MEETING === "true";

export enum NotificationType {
	NONE,
	AUDIO_CALLING,
	VIDEO_CALLING,
	PEER_RINGING,
	CALL_TERMINATED,
	MEMBER_JOINED,
	MEMBER_LEAVE,
	MESSAGE_RECEIVED,
	MESSAGE_SENT,
}

function getSound(type: NotificationType): string | null {
	switch (type) {
		case NotificationType.AUDIO_CALLING:
			return "/sounds/skred/connecting_ringtone.ogg";

		case NotificationType.VIDEO_CALLING:
			return "/sounds/skred/connecting_ringtone.ogg";

		case NotificationType.PEER_RINGING:
			return "/sounds/skred/ringing_ringtone.ogg";

		case NotificationType.CALL_TERMINATED:
			return "/sounds/skred/call_end_ringtone.ogg";

		case NotificationType.MEMBER_JOINED:
			return "/sounds/join-call.mp3";

		case NotificationType.MEMBER_LEAVE:
			return "/sounds/member-leave.mp3";

		case NotificationType.MESSAGE_RECEIVED:
			return "/sounds/message-received.mp3";

		case NotificationType.MESSAGE_SENT:
			return "/sounds/message-sent.mp3";

		default:
			return null;
	}
}

const NOTIFY_VOLUME: number = 0.3;
const RINGTONE_VOLUME: number = 0.5;

/**
 * Notification center to centralize and handle all notifications to play sound
 * and post visual notifications.
 */
export class NotificationCenter {
	sound: NotificationState;
	display: NotificationState;
	chatPanelOpened: boolean;
	activeNotification: NotificationType | null;
	audioContext: AudioContext | null;
	audioSource: AudioBufferSourceNode | null;
	gainNode: GainNode | null;

	constructor() {
		this.sound = notificationStore.sound;
		this.display = notificationStore.display;
		this.activeNotification = null;
		this.chatPanelOpened = chatStore.chatPanelOpened;
		this.audioContext = null;
		this.audioSource = null;
		this.gainNode = null;
	}

	/**
	 * The call status was changed.
	 *
	 * @param {CallStatus} status the new call status.
	 */
	public onUpdateCallStatus(newStatus: CallStatus, oldStatus: CallStatus): void {
		if (newStatus == CallStatus.OUTGOING_CALL) {
			if (!MEETING) {
				this.postSound(NotificationType.AUDIO_CALLING, RINGTONE_VOLUME);
			}
		} else if (newStatus == CallStatus.OUTGOING_VIDEO_CALL) {
			if (!MEETING) {
				this.postSound(NotificationType.VIDEO_CALLING, RINGTONE_VOLUME);
			}
		} else if (newStatus == CallStatus.OUTGOING_RINGING) {
			this.postSound(NotificationType.PEER_RINGING, RINGTONE_VOLUME);
		} else if (newStatus == CallStatus.TERMINATED) {
			if (CallStatusOps.isActive(oldStatus)) {
				this.postSound(NotificationType.CALL_TERMINATED, RINGTONE_VOLUME);
			} else {
				this.stopSound();
			}
		} else if (
			oldStatus == CallStatus.OUTGOING_CALL ||
			oldStatus == CallStatus.OUTGOING_VIDEO_CALL ||
			oldStatus == CallStatus.OUTGOING_RINGING
		) {
			this.stopSound();
		}
	}

	public stopSound() {
		if (this.audioSource) {
			this.audioSource.stop();
		}
		if (this.audioContext) {
			this.audioContext.close();
		}
		if (this.gainNode) {
			this.gainNode.disconnect();
		}
		this.audioSource = null;
		this.audioContext = null;
		this.gainNode = null;
	}

	public playSound(type: NotificationType, loop: boolean, volume?: number | null | undefined) {
		const soundFile = getSound(type);
		this.stopSound();
		this.audioContext = new window.AudioContext();
		if (!this.audioContext || !soundFile) {
			return;
		}

		fetch(soundFile)
			.then((response) => response.arrayBuffer())
			.then((arrayBuffer) => this.audioContext?.decodeAudioData(arrayBuffer))
			.then((audioBuffer) => {
				const source = this.audioContext?.createBufferSource();
				if (source != null && audioBuffer && this.audioContext) {
					this.audioSource = source;
					source.buffer = audioBuffer;
					source.loop = loop;
					if (volume != null) {
						const gainNode = this.audioContext.createGain();
						gainNode.gain.value = volume;
						this.gainNode = gainNode;
						source.connect(gainNode);
						gainNode.connect(this.audioContext.destination);
					} else {
						source.connect(this.audioContext.destination);
					}
					source.start(0);
				}
			});
	}

	public postSound(type: NotificationType, volume: number) {
		console.error("Posting sound notification " + type);
		if (
			type == NotificationType.AUDIO_CALLING ||
			type == NotificationType.VIDEO_CALLING ||
			type == NotificationType.PEER_RINGING
		) {
			this.playSound(type, true, volume);
			return;
		}
		this.playSound(type, false, volume);
		this.activeNotification = type;
	}

	public postMemberJoined(participant: CallParticipant): void {
		if (this.display.participantJoined && participant.getName()) {
			toast(participant.getName() + " joined");
		}
		if (this.sound.participantJoined) {
			this.postSound(NotificationType.MEMBER_JOINED, NOTIFY_VOLUME);
		}
	}

	public postMemberLeave(participants: Array<CallParticipant>): void {
		if (this.display.participantLeft) {
			for (const participant of participants) {
				if (participant.getName()) {
					toast("Member " + participant.getName() + " left");
				}
			}
		}
		if (this.sound.participantLeft) {
			this.postSound(NotificationType.MEMBER_LEAVE, NOTIFY_VOLUME);
		}
	}

	public postMessageSent(): void {
		if (this.sound.messageReceived) {
			this.postSound(NotificationType.MESSAGE_SENT, NOTIFY_VOLUME);
		}
	}

	public postNewMessage(): void {
		if (this.display.messageReceived && !this.chatPanelOpened) {
			toast("New message posted", { autoClose: 1000 });
		}
		if (this.sound.messageReceived) {
			this.postSound(NotificationType.MESSAGE_RECEIVED, NOTIFY_VOLUME);
		}
	}

	public updateSettings(): void {
		this.sound = notificationStore.sound;
		this.display = notificationStore.display;
		this.chatPanelOpened = chatStore.chatPanelOpened;
	}
}

export const notificationCenter = new NotificationCenter();
