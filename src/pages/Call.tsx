/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
import i18n, { TFunction } from "i18next";
import { createRef, Component, ReactNode, RefObject } from "react";
import "react-confirm-alert/src/react-confirm-alert.css";
import { Trans, useTranslation } from "react-i18next";
import { NavigateFunction, useNavigate, useParams } from "react-router-dom";
import { CallObserver } from "../calls/CallObserver";
import { CallParticipant } from "../calls/CallParticipant";
import { CallParticipantEvent } from "../calls/CallParticipantEvent";
import { CallParticipantObserver } from "../calls/CallParticipantObserver";
import { CallService } from "../calls/CallService";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import { ConversationService } from "../calls/ConversationService";
import Alert from "../components/Alert";
import Header from "../components/Header";
import { LocalParticipant } from "../components/LocalParticipant";
import { ViewMode } from "../utils/DisplayMode";
import { ParticipantsGrid, DisplayMode } from "../components/ParticipantsGrid";
import StoresBadges from "../components/StoresBadges";
import PrepareCall from "../components/PrepareCall";
import Thanks from "../components/Thanks";
import { ContactService, TwincodeInfo } from "../services/ContactService";
import { PeerCallService, TerminateReason } from "../services/PeerCallService";
import { isMobile } from "../utils/BrowserCapabilities";
import { CallButtons, CallButtonHandlers } from "../components/CallButtons";
import { NotificationCenter, notificationCenter } from "../notifications/NotificationCenter";
import { MediaStreams } from "../utils/MediaStreams";
import { AudioTrack } from "../utils/AudioTrack";
import { VideoTrack } from "../utils/VideoTrack";
import { Notifications } from "../notifications/Notifications";
import { chatStore } from "../stores/chat";
import { profile } from "../stores/profile";
import { subscribe } from "valtio/index";
import { audioStore } from "../stores/audio";
import { videoStore } from "../stores/video";

type FacingMode = "user" | "environment";

export type Item = {
	participant: CallParticipant | null;
	descriptor: ConversationService.Descriptor;
	displayName: boolean;
	corners: {
		tl?: string;
		tr?: string;
		bl?: string;
		br?: string;
	};
};

interface CallProps {
	id: string;
	t: TFunction<"translation", "translation">;
	navigate: NavigateFunction;
}

export interface CallState {
	initializing: boolean;
	guestNameError: boolean;
	twincode: TwincodeInfo;
	status: CallStatus;
	audioMute: boolean;
	videoMute: boolean;
	terminateReason: TerminateReason | null;
	participants: Array<CallParticipant>;
	displayThanks: boolean;
	facingMode: FacingMode;
	isSharingScreen: boolean;
	items: Item[];
	alertOpen: boolean;
	alertTitle: string;
	alertContent: ReactNode;
	displayMode: DisplayMode;
}

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";
const TRANSFER = import.meta.env.VITE_APP_TRANSFER === "true";

// Create only one instance of PeerCallService.
const peerCallService: PeerCallService = new PeerCallService();

export class Call
	extends Component<CallProps, CallState>
	implements CallParticipantObserver, CallObserver, CallButtonHandlers
{
	protected localVideoRef: RefObject<HTMLVideoElement | null> = createRef();
	protected callService: CallService = new CallService(peerCallService, this, this);
	protected notificationCenter: NotificationCenter = notificationCenter;

	state: CallState = {
		initializing: true,
		guestNameError: false,
		status: CallStatus.IDLE,
		twincode: {
			name: null,
			description: null,
			avatarId: null,
			audio: false,
			video: false,
			transfer: false,
			conference: false,
			schedule: null,
		},
		audioMute: false,
		videoMute: false,
		terminateReason: null,
		participants: [],
		displayThanks: false,
		facingMode: "user",
		isSharingScreen: false,
		items: [],
		alertOpen: false,
		alertTitle: "",
		alertContent: <></>,
		displayMode: {
			mode: ViewMode.VIEW_DEFAULT,
			participantId: null,
		},
	};

	componentDidMount = () => {
		this.init();
	};

	init(): void {
		console.error("First state video", videoStore.enable, this);
		this.setState({
			initializing: true,
			videoMute: !videoStore.enable,
			displayThanks: false,
			status: CallStatus.IDLE,
			audioMute: false,
			terminateReason: null,
			participants: [],
			alertOpen: false,
			alertTitle: "",
			alertContent: <></>,
		});
		if (!this.callService) {
			this.callService = new CallService(peerCallService, this, this);
		}

		subscribe(profile, () => {
			this.setState({ guestNameError: profile.name === "" });
			if (profile.name !== "") {
				this.callService.updateIdentity(profile.name, new ArrayBuffer(0));
			}
		});
		subscribe(audioStore, () => {
			const deviceId = audioStore.inputDeviceId;
			if (deviceId) {
				console.error("Device", deviceId);
				this.selectAudioDevice(deviceId);
			}
		});
		subscribe(videoStore, () => {
			const deviceId = videoStore.videoDeviceId;
			if (deviceId) {
				console.error("Device", deviceId);
				this.selectVideoDevice(deviceId);
			}
		});
	}

	/**
	 * The call status was changed.
	 *
	 * @param {CallStatus} status the new call status.
	 */
	onUpdateCallStatus(status: CallStatus): void {
		const previousStatus: CallStatus = this.state.status;

		if (DEBUG) {
			console.log("Call status ", CallStatus[previousStatus], " => ", CallStatus[status]);
		}

		this.setState({ status: status });
		this.notificationCenter.onUpdateCallStatus(status, previousStatus);
	}

	onOverrideAudioVideo(audio: boolean, video: boolean): void {
		const videoChanged = video != !this.state.videoMute;
		if (videoChanged) {
			this.toggleVideo();
		}

		const audioChanged = audio != !this.state.audioMute;
		if (audioChanged) {
			this.toggleAudio();
		}
	}

	/**
	 * Called when the call is terminated.
	 *
	 * @param reason the call termination reason.
	 */
	onTerminateCall(reason: TerminateReason): void {
		const { status } = this.state;

		console.info("Call terminated", reason, "in state", CallStatus[status]);

		this.notificationCenter.onUpdateCallStatus(CallStatus.TERMINATED, status);
		chatStore.chatPanelOpened = false;
		chatStore.unreadMessages = 0;
		this.leaveFullscreen();
		this.setState({
			terminateReason: reason,
			status: CallStatus.TERMINATED,
			alertOpen: false,
			alertTitle: "",
			alertContent: <></>,
			isSharingScreen: false,
			items: [],
		});
		if (reason == "cancel") {
			return;
		}

		this.callService.actionCameraMute(true);
		this.callService = new CallService(peerCallService, this, this);

		setTimeout(() => {
			this.setState({ displayThanks: true });
		}, CallService.FINISH_TIMEOUT);
	}

	/**
	 * A new participant is added to the call group.
	 *
	 * @param {CallParticipant} participant the participant.
	 */
	onAddParticipant(participant: CallParticipant): void {
		if (DEBUG) {
			console.log("Add new participant ", participant);
		}

		const participants: Array<CallParticipant> = this.callService.getParticipants();
		const displayMode: DisplayMode = this.state.displayMode;
		this.setState({ participants: participants, displayMode: displayMode });
	}

	/**
	 * One or several participants are removed from the call.
	 *
	 * @param {CallParticipant[]} participants the list of participants being removed.
	 */
	onRemoveParticipants(participants: Array<CallParticipant>): void {
		if (DEBUG) {
			console.log("Remove", participants.length, "participants");
		}

		this.notificationCenter.postMemberLeave(participants);
		const list: Array<CallParticipant> = this.callService.getParticipants();
		const displayMode: DisplayMode = this.state.displayMode;
		if (displayMode.participantId !== null) {
			displayMode.participantId = null;
			displayMode.mode = ViewMode.VIEW_DEFAULT;
		}
		this.setState({ participants: list, displayMode: displayMode });
	}

	/**
	 * An event occurred for the participant and its state was changed.
	 *
	 * @param {CallParticipant} participant the participant.
	 * @param {CallParticipantEvent} event the event that occurred.
	 */
	onEventParticipant(participant: CallParticipant, event: CallParticipantEvent): void {
		if (DEBUG) {
			console.log("Participant event: ", event);
		}

		const participants: Array<CallParticipant> = this.callService.getParticipants();
		this.setState({ participants: participants });
		if (event === CallParticipantEvent.EVENT_SUPPORTS_MESSAGES) {
			// We now assume everybody supports messages.
		} else if (event == CallParticipantEvent.EVENT_SCREEN_SHARING_ON) {
			const displayMode: DisplayMode = this.state.displayMode;
			displayMode.mode = ViewMode.VIEW_SHARE_SCREEN;
			displayMode.participantId = participant.getParticipantId();
			this.setState({ displayMode: displayMode });
		} else if (event == CallParticipantEvent.EVENT_SCREEN_SHARING_OFF) {
			const displayMode: DisplayMode = this.state.displayMode;
			displayMode.mode = ViewMode.VIEW_DEFAULT;
			displayMode.participantId = null;
			this.setState({ displayMode: displayMode });
		} else if (event == CallParticipantEvent.EVENT_IDENTITY) {
			this.notificationCenter.postMemberJoined(participant);
		}
	}

	/**
	 * A descriptor (message, invitation) was send by the participant.
	 *
	 * @param {CallParticipant} participant the participant.
	 * @param {ConversationService.Descriptor} descriptor the descriptor that was received.
	 */
	onPopDescriptor(participant: CallParticipant, descriptor: ConversationService.Descriptor): void {
		if (DEBUG) {
			console.log("onPopDescriptor", participant, descriptor);
		}

		const { items } = this.state;
		const newItem: Item = {
			participant,
			descriptor,
			displayName: false,
			corners: {},
		};

		const previousItem: Item = items[items.length - 1];
		if (
			items.length === 0 ||
			previousItem.participant === null ||
			previousItem.participant?.getParticipantId() !== participant.getParticipantId()
		) {
			newItem.displayName = true;
		}
		items.push(newItem);

		this.updateItems(items);
		this.notificationCenter.postNewMessage();
	}

	private updateItems = (items: Item[]) => {
		const previousItem: Item = items[items.length - 2];
		const item = items[items.length - 1];

		if (item.participant) {
			// Peer item
			if (previousItem && !item.displayName) {
				// Consecutive message from same participant
				item.corners.tl = "rounded-tl";
				previousItem.corners.bl = "rounded-bl";
			}
			chatStore.unreadMessages++;
		} else {
			// Local item
			if (previousItem && !previousItem.participant) {
				// Consecutive message from local user
				item.corners.tr = "rounded-tr";
				previousItem.corners.br = "rounded-br";
			}
		}

		this.setState({ items });
	};

	onTerminateClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();

		if (CallStatusOps.isActive(this.state.status)) {
			this.callService.actionTerminateCall("success");
		} else {
			this.callService.actionTerminateCall("cancel");
		}
	};

	onMuteAudioClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();
		this.toggleAudio();
	};

	private toggleAudio = () => {
		const { audioMute } = this.state;
		this.setState({ audioMute: !audioMute }, () => {
			const { audioMute } = this.state;
			this.callService.actionAudioMute(audioMute);
		});
	};

	onMuteVideoClick: React.MouseEventHandler<HTMLElement> = (ev: React.MouseEvent<HTMLElement>) => {
		ev.preventDefault();
		this.toggleVideo();
	};

	onVideoClick = (ev: React.MouseEvent<HTMLDivElement>, participantId: number | undefined) => {
		ev.preventDefault();
		const displayMode: DisplayMode = this.state.displayMode;
		if (participantId === undefined || displayMode.participantId == participantId) {
			displayMode.participantId = null;
			displayMode.mode = ViewMode.VIEW_DEFAULT;
		} else {
			displayMode.participantId = participantId;
			displayMode.mode = participantId > 0 ? ViewMode.VIEW_FOCUS_PARTICIPANT : ViewMode.VIEW_FOCUS_CAMERA;
		}
		this.setState({ displayMode: displayMode });
	};

	public toggleVideo = () => {
		if (this.state.twincode.video) {
			const { videoMute, isSharingScreen } = this.state;

			const displayMode: DisplayMode = this.state.displayMode;
			if (isSharingScreen) {
				this.callService.actionCameraMute(true);
				displayMode.mode = ViewMode.VIEW_DEFAULT;
				displayMode.participantId = null;
			}
			this.setState(
				{ videoMute: !videoMute && !isSharingScreen, isSharingScreen: false, displayMode: displayMode },
				async () => {
					const { videoMute } = this.state;
					videoStore.enable = !videoMute;
					if (!videoMute && !this.callService.hasVideoTrack()) {
						await this.askForMediaPermission("video");
					}

					if (this.callService.hasVideoTrack()) {
						this.muteCamera(videoMute);
					}
				},
			);
		}
	};

	muteCamera = (videoMute: boolean) => {
		this.callService.actionCameraMute(videoMute);
	};

	pushMessage = (message: string, copyAllowed: boolean) => {
		const descriptor = this.callService.pushMessage(message, copyAllowed);
		if (descriptor) {
			this.updateItems([
				...this.state.items,
				{
					participant: null,
					descriptor,
					displayName: false,
					corners: {},
				},
			]);
			this.notificationCenter.postMessageSent();
		}
		return descriptor;
	};

	/**
	 * Enter fullscreen if supported.
	 */
	private enterFullscreen = () => {
		const element: HTMLElement = document.documentElement;
		if (element.requestFullscreen) {
			if (!document.fullscreenElement) {
				element.requestFullscreen().catch((err) => {
					console.error("cannot enter fullscreen: " + err);
				});
			}

			// @ts-expect-error: check for Safari specific method
		} else if (element.webkitRequestFullscreen) {
			// @ts-expect-error: check for Safari specific method
			element.webkitRequestFullscreen();
		}
	};

	/**
	 * Leave fullscreen if supported.
	 */
	private leaveFullscreen = () => {
		const element: HTMLElement = document.documentElement;
		if (document.exitFullscreen) {
			if (document.fullscreenElement) {
				document.exitFullscreen().catch((err) => {
					console.error("exitfullscreen error: " + err);
				});
			}
			// @ts-expect-error: check for Safari specific method
		} else if (element.webkitExitFullscreen) {
			// @ts-expect-error: check for Safari specific method
			element.webkitExitFullscreen();
		}
	};

	onSwitchCameraClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();
		if (this.state.twincode.video && !this.state.videoMute) {
			if (isMobile) {
				this.setState(
					({ facingMode }) => {
						return { facingMode: facingMode === "user" ? "environment" : "user" };
					},
					async () => {
						const fMode = this.state.facingMode;

						this.callService.getMediaStream().setVideoTrack(null, false);
						const constraints = {
							audio: false,
							video: {
								facingMode: fMode === "user" ? "user" : { exact: "environment" },
							},
						};
						const mediaStream = await this.getUserMedia(constraints);
						if (mediaStream) {
							this.setVideoTrack(mediaStream.getVideoTracks()[0], false);
						}
					},
				);
			}
		}
	};

	setVideoTrack = (mediaStream: MediaStreamTrack, isScreenSharing: boolean) => {
		this.callService.setVideoTrack(new VideoTrack(mediaStream, null), isScreenSharing);
	};

	selectAudioDevice = async (deviceId: string) => {
		const constraints = {
			audio: { deviceId },
			video: false,
		};

		const audioStream: MediaStream | null = await this.getUserMedia(constraints);
		if (audioStream) {
			this.callService.setAudioTrack(new AudioTrack(audioStream.getAudioTracks()[0]));
		}
	};

	selectVideoDevice = async (deviceId: string) => {
		if (this.callService.hasVideoTrack()) {
			this.setState({ isSharingScreen: false });
			const mediaStream: MediaStream | null = await this.getUserMedia({
				audio: false,
				video: { deviceId },
			});
			if (mediaStream) {
				this.setVideoTrack(mediaStream.getVideoTracks()[0], false);
			}
		}
	};

	onSharingScreenClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();
		if (!this.state.isSharingScreen) {
			this.startScreenSharing();
		} else {
			this.stopScreenSharing();
		}
	};

	onChatClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();
		chatStore.chatPanelOpened = !chatStore.chatPanelOpened;
	};

	private startScreenSharing = async () => {
		if (DEBUG) {
			console.log("Start screen sharing");
		}

		if (this.state.twincode.video) {
			try {
				const mediaStream = await navigator.mediaDevices.getDisplayMedia({
					video: true,
					audio: false,
				});
				if (mediaStream) {
					console.info("Selecting display stream", mediaStream.id);
					this.setVideoTrack(mediaStream.getVideoTracks()[0], true);
					const callStream: MediaStreams = this.callService.getMediaStream();
					if (callStream.video) {
						callStream.video.track.onended = (_event: Event) => {
							// onended is called if the user stops screen sharing from its browser
							if (this.state.isSharingScreen) {
								this.stopScreenSharing();
							}
						};
					}
					const displayMode: DisplayMode = this.state.displayMode;
					displayMode.participantId = 0;
					this.setState({ isSharingScreen: true, displayMode: displayMode });
				}
			} catch (error: unknown) {
				console.error("Screen sharing error or denied : ", error);
				if (error instanceof DOMException) {
					this.alertError(this.props.t("screen_sharing_access"), this.state.videoMute, error.message);
				}
			}
		}
	};

	private stopScreenSharing = () => {
		if (DEBUG) {
			console.log("Stop screen sharing");
		}

		const displayMode: DisplayMode = this.state.displayMode;
		displayMode.mode = ViewMode.VIEW_DEFAULT;
		displayMode.participantId = null;
		this.setState({ isSharingScreen: false, displayMode: displayMode }, async () => {
			const { videoMute, twincode } = this.state;
			if (!videoMute && twincode.video) {
				await this.askForMediaPermission("video");
			}
		});
		this.callService.actionCameraMute(true);
	};

	onCallClick: React.MouseEventHandler<HTMLButtonElement> = async (ev: React.MouseEvent<HTMLButtonElement>) => {
		const { twincode } = this.state;
		const guestName = profile.name;
		if (guestName === "") {
			this.setState({ guestNameError: true });
			console.error("Identity name needed");
			return;
		}

		if (!this.callService.hasAudioTrack()) {
			if (!(await this.askForMediaPermission("audio"))) {
				return;
			}
		}

		this.callService.setIdentity(guestName, new ArrayBuffer(0));

		const name: string = twincode.name ? twincode.name : "Unknown";
		const video: boolean = twincode.video && (!this.state.videoMute || this.state.isSharingScreen);
		const transfer: boolean = twincode.transfer;
		const avatarUrl: string = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
		this.callService.actionOutgoingCall(this.props.id, video, transfer, name, avatarUrl);
		ev.preventDefault();
		if (isMobile) {
			this.enterFullscreen();
		}
	};

	public askForMediaPermission = async (kind: "audio" | "video"): Promise<boolean> => {
		const fMode = this.state.facingMode;

		// We need to ask for devices access this way first to be able to fetch devices labels with enumerateDevices
		// (https://developer.mozilla.org/en-US/docs/Web/API/MediaDeviceInfo/label)
		const constraints: MediaStreamConstraints = {
			audio: kind === "audio",
			video: kind === "video" ? { facingMode: fMode === "user" ? "user" : { exact: "environment" } } : false,
		};

		const mediaStream = await this.getUserMedia(constraints);
		if (mediaStream == null) {
			return false;
		}

		for (const track of mediaStream.getTracks()) {
			if (track.kind === "audio" && kind === "audio") {
				this.callService.setAudioTrack(new AudioTrack(track));
			}
			if (track.kind === "video" && kind === "video") {
				this.setVideoTrack(track, false);
			}
			mediaStream.removeTrack(track);
		}
		return true;
	};

	private getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
		const kind = constraints.video ? "video" : "audio";
		try {
			// We need to ask for devices access this way first to be able to fetch devices labels with enumerateDevices
			// (https://developer.mozilla.org/en-US/docs/Web/API/MediaDeviceInfo/label)
			const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

			return mediaStream;
		} catch (error: unknown) {
			if (error instanceof DOMException) {
				// Inside this block, err is known to be a ValidationError
				console.error("Error during permissions granting", kind, error.name);
				let alertMessage = <></>;
				switch (error.name) {
					case "NotAllowedError":
						if (DEBUG) {
							console.log("NOT ALLOWED");
						}
						alertMessage = (
							<div>
								{this.props.t(kind === "audio" ? "microphone_access_denied" : "camera_access_denied")}
							</div>
						);
						break;
					case "NotFoundError":
						if (DEBUG) {
							console.log("NOT FOUND");
						}
						alertMessage = (
							<div>
								{this.props.t(
									kind === "audio" ? "microphone_access_not_found" : "camera_access_not_found",
								)}
							</div>
						);
						break;
					default:
						if (DEBUG) {
							console.log("DEFAULT ERROR");
						}
						alertMessage = (
							<div>
								{this.props.t(kind === "audio" ? "microphone_access_error" : "camera_access_error")}
							</div>
						);
						break;
				}
				this.alertError(
					this.props.t(kind === "audio" ? "microphone_access" : "camera_access"),
					kind === "video" || this.state.videoMute,
					alertMessage,
				);
			} else {
				console.error(error);
			}
			return null;
		}
	};

	onTransferClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		const { twincode, status } = this.state;

		if (!CallStatusOps.isActive(status) || !twincode.transfer) {
			console.error(
				"Can't transfer: call active=" +
					CallStatusOps.isActive(status) +
					", twincode.transfer=" +
					twincode.transfer,
			);
			return;
		}

		this.callService.setIdentity(profile.name, new ArrayBuffer(0));

		const name: string = twincode.name ? twincode.name : "Unknown";
		const transfer: boolean = twincode.transfer;
		const avatarUrl: string = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
		this.callService.actionAddCallParticipant(this.props.id, transfer, name, avatarUrl);
		ev.preventDefault();
	};

	alertError = (alertTitle: string, videoMute: boolean, alertMessage: unknown) => {
		this.setState({
			videoMute: videoMute,
			alertOpen: true,
			alertTitle: alertTitle,
			alertContent: (
				<>
					{alertMessage}
					<div className="mt-6 text-right">
						<button
							type="button"
							className="inline-flex w-full justify-center rounded-md bg-white/90 px-2 py-1 text-xs text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
							onClick={() => this.setState({ alertOpen: false })}
						>
							OK
						</button>
					</div>
				</>
			),
		});
	};

	private terminateMessages: { [key in TerminateReason]: string } = {
		success: "audio_call_activity_terminate",
		busy: "audio_call_activity_terminate_busy",
		cancel: "audio_call_activity_terminate_cancel",
		"connectivity-error": "audio_call_activity_terminate_connectivity_error",
		decline: "audio_call_activity_terminate_decline",
		disconnected: "application_no_network_connectivity",
		gone: "audio_call_activity_terminate_gone",
		revoked: "audio_call_activity_terminate_revoked",
		expired: "audio_call_activity_terminate_timeout",
		"not-authorized": "audio_call_activity_terminate_timeout",
		"transfer-done": "call_activity_transfert_call_message",
		unknown: "general_error_message",
		schedule: "audio_call_activity_terminate_schedule_unknown",
		"general-error": "general_error_message",
	};

	getTerminateReasonMessage = (terminateReason: TerminateReason): string => {
		if (terminateReason === "general-error") {
			console.error("PeerConnectionService.TerminateReason.GENERAL_ERROR");
		}

		if (terminateReason === "unknown") {
			console.error("PeerConnectionService.TerminateReason.unknown");
		}

		//special case for schedule, as it has different messages according to the schedule's settings.
		if (terminateReason === "schedule" && this.state.twincode.schedule) {
			return ContactService.getSchedule(this.state.twincode.schedule);
		}

		return this.terminateMessages[terminateReason];
	};

	onGetTwincode(twincode: TwincodeInfo): string | null {
		if (!twincode.name || !twincode.audio) {
			return "twincode_error";
		}
		this.setState({ twincode, initializing: false }, () => {
			this.onReadyCall();
		});
		return null;
	}

	onReadyCall(): void {}

	render() {
		const { id, t } = this.props;
		const {
			initializing,
			guestNameError,
			twincode,
			videoMute,
			audioMute,
			status,
			participants,
			displayMode,
			terminateReason,
			displayThanks,
			isSharingScreen,
			items,
			alertOpen,
			alertTitle,
			alertContent,
		} = this.state;

		if (displayThanks) {
			return <Thanks onCallBackClick={this.init} />;
		}

		const callType = twincode.transfer ? i18n.t("transfer") : i18n.t("call");

		document.title = i18n.t("title", {
			appName: import.meta.env.VITE_APP_NAME,
			callType: callType,
			linkName: twincode.name,
		});
		const isActive = CallStatusOps.isActive(status);
		const isTerminated = CallStatusOps.isTerminated(status);

		if (DEBUG) {
			if (initializing) {
				console.log("Render initializing", status, "mode", displayMode.mode);
			} else if (isActive) {
				console.log("Render active", status, "mode", displayMode.mode);
			} else if (isTerminated) {
				console.log("Render terminated", status, "mode", displayMode.mode, terminateReason);
			} else {
				console.log("Render", status, "mode", displayMode.mode);
			}
		}
		return (
			<div className="relative flex h-full w-screen flex-col bg-black portrait:p-1 portrait:md:p-4 landscape:p-2 landscape:lg:p-4">
				<Header className={isActive ? "absolute z-10 top-5 left-5 md:top-8 md:left-8" : ""} />
				<Notifications />

				{!isActive && (
					<PrepareCall
						className="flex h-full w-screen flex flex-col"
						initializing={initializing}
						twincodeId={id}
						twincode={twincode}
						status={status}
						title={twincode.name ? twincode.name : "?"}
						callbacks={this}
						audioMute={audioMute}
						videoMute={videoMute}
						isSharingScreen={isSharingScreen}
						onGetTwincode={(twincode: TwincodeInfo) => {
							this.onGetTwincode(twincode);
						}}
					>
						<div className="flex-1 relative h-full w-full rounded-lg overflow-hidden">
							<LocalParticipant
								localVideoRef={this.localVideoRef}
								localAbsolute={false}
								videoMute={videoMute}
								isLocalAudioMute={false}
								isIdle={true}
								isScreenSharing={isSharingScreen}
								enableVideo={true}
								guestNameError={guestNameError}
								muteVideoClick={this.onMuteVideoClick}
							></LocalParticipant>
						</div>
					</PrepareCall>
				)}
				{isActive && (
					<>
						<ParticipantsGrid
							localVideoRef={this.localVideoRef}
							videoMute={videoMute}
							isSharingScreen={isSharingScreen}
							isLocalAudioMute={audioMute}
							twincode={twincode}
							participants={participants}
							isIdle={CallStatusOps.isIdle(status)}
							guestNameError={guestNameError}
							muteVideoClick={this.onMuteVideoClick}
							videoClick={this.onVideoClick}
							mode={displayMode}
							pushMessage={this.pushMessage}
							items={items}
						/>
						<CallButtons
							className={"absolute-button-list"}
							status={status}
							callbacks={this}
							allowCall={true}
							audioMute={audioMute}
							hasVideo={twincode.video}
							videoMute={videoMute}
							isSharingScreen={isSharingScreen}
						/>
					</>
				)}

				{isTerminated && terminateReason && (
					<div className="flex w-full flex-1 items-center justify-center text-center">
						<span>
							<Trans
								i18nKey={this.getTerminateReasonMessage(terminateReason)}
								values={{
									contactName: twincode?.name,
									...ContactService.getScheduleLabels(twincode?.schedule),
								}}
								t={t}
							/>
						</span>
					</div>
				)}
				{!TRANSFER && !isMobile && CallStatusOps.isIdle(status) && (
					<>
						<div className="py-6 text-center font-light">{t("next_time_app")}</div>
						<div className="mx-auto">
							<StoresBadges />
						</div>
					</>
				)}

				<Alert
					title={alertTitle}
					isOpen={alertOpen}
					content={alertContent}
					onClose={() => this.setState({ alertOpen: false })}
				/>
			</div>
		);
	}
}

const CallWithParams = () => {
	const { t } = useTranslation();
	const { id } = useParams();
	const navigate = useNavigate();
	return <Call id={id!} t={t} navigate={navigate} />;
};

export default CallWithParams;
