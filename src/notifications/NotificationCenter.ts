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
import { isMobile } from "../utils/BrowserCapabilities";

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

const NOTIFY_VOLUME: number = 0.1;
const RINGTONE_VOLUME: number = 0.1;

class SoundPlayer {
	private readonly audioContext: AudioContext | null;
	private readonly gainNode: GainNode | null;
	private audioSource: AudioBufferSourceNode | null;

	constructor() {
		this.audioContext = new window.AudioContext();
		this.gainNode = new GainNode(this.audioContext);
		this.gainNode.connect(this.audioContext.destination);
		this.audioSource = null;
	}

	public playSound(type: NotificationType, loop: boolean, volume?: number | null | undefined) {
		const soundFile = getSound(type);
		this.stopSound();
		if (!this.audioContext || !soundFile) {
			return;
		}
		if (this.audioContext.state === "suspended") {
			this.audioContext.resume().then(() => {
				this.doPlaySound(soundFile, loop, volume === undefined || volume == null ? 0 : volume);
			});
		} else {
			this.doPlaySound(soundFile, loop, volume === undefined || volume == null ? 0 : volume);
		}
	}

	public stopSound() {
		if (this.audioSource) {
			this.audioSource.stop();
		}
		this.audioSource = null;
	}

	private doPlaySound(soundFile: string, loop: boolean, volume: number): void {
		fetch(soundFile)
			.then((response) => response.arrayBuffer())
			.then((arrayBuffer) => this.audioContext?.decodeAudioData(arrayBuffer))
			.then((audioBuffer) => {
				const source = this.audioContext?.createBufferSource();
				if (source != null && audioBuffer && this.audioContext) {
					this.audioSource = source;
					source.buffer = audioBuffer;
					source.loop = loop;
					if (volume != null && this.gainNode) {
						this.gainNode.gain.value = volume;
						source.connect(this.gainNode);
					} else {
						source.connect(this.audioContext.destination);
					}
					source.start(0);
				}
			});
	}
}

// Use a single global instance for the AudioContext to avoid problems.
const soundPlayer: SoundPlayer = new SoundPlayer();

/**
 * Notification center to centralize and handle all notifications to play sound
 * and post visual notifications.
 */
export class NotificationCenter {
	sound: NotificationState;
	display: NotificationState;
	chatPanelOpened: boolean;
	activeNotification: NotificationType | null;

	constructor() {
		this.sound = notificationStore.sound;
		this.display = notificationStore.display;
		this.activeNotification = null;
		this.chatPanelOpened = chatStore.chatPanelOpened;
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
			if (!isMobile && CallStatusOps.isActive(oldStatus)) {
				this.postSound(NotificationType.CALL_TERMINATED, NOTIFY_VOLUME);
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
		soundPlayer.stopSound();
	}

	public postSound(type: NotificationType, volume: number) {
		console.info("Posting sound notification " + type);
		if (
			type == NotificationType.AUDIO_CALLING ||
			type == NotificationType.VIDEO_CALLING ||
			type == NotificationType.PEER_RINGING
		) {
			soundPlayer.playSound(type, true, volume);
			return;
		}
		soundPlayer.playSound(type, false, volume);
		this.activeNotification = type;
	}

	public postMemberJoined(participant: CallParticipant): void {
		if (this.display.participantJoined && participant.getName()) {
			this.postToast(participant.getName() + " joined");
		}
		if (!isMobile && this.sound.participantJoined) {
			this.postSound(NotificationType.MEMBER_JOINED, NOTIFY_VOLUME);
		}
	}

	public postMemberLeave(participants: Array<CallParticipant>): void {
		if (this.display.participantLeft) {
			for (const participant of participants) {
				if (participant.getName()) {
					this.postToast("Member " + participant.getName() + " left");
				}
			}
		}
		if (!isMobile && this.sound.participantLeft) {
			this.postSound(NotificationType.MEMBER_LEAVE, NOTIFY_VOLUME);
		}
	}

	public postMessageSent(): void {
		if (!isMobile && this.sound.messageReceived) {
			this.postSound(NotificationType.MESSAGE_SENT, NOTIFY_VOLUME);
		}
	}

	public postNewMessage(): void {
		if (this.display.messageReceived && !this.chatPanelOpened) {
			this.postToast("New message posted");
		}
		if (!isMobile && this.sound.messageReceived) {
			this.postSound(NotificationType.MESSAGE_RECEIVED, NOTIFY_VOLUME);
		}
	}

	public updateSettings(): void {
		this.sound = notificationStore.sound;
		this.display = notificationStore.display;
		this.chatPanelOpened = chatStore.chatPanelOpened;
	}

	private postToast(message: string) {
		toast(message, { autoClose: 1000 });
	}
}

export const notificationCenter = new NotificationCenter();
