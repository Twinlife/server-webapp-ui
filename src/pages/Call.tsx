/*
 *  Copyright (c) 2021-2024 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
import zonedTimeToUtc from "date-fns-tz/zonedTimeToUtc";
import i18n, { TFunction } from "i18next";
import { ScreenShare, ScreenShareOff } from "lucide-react";
import React, { Component, ReactNode, RefObject, useEffect, useState } from "react";
import "react-confirm-alert/src/react-confirm-alert.css";
import { Trans, useTranslation } from "react-i18next";
import { NavigateFunction, useNavigate, useParams } from "react-router-dom";
import camOffIcon from "../assets/cam-off.svg";
import camOnIcon from "../assets/cam-on.svg";
import micOffIcon from "../assets/mic-off.svg";
import micOnIcon from "../assets/mic-on.svg";
import phoneCallIcon from "../assets/phone-call.svg";
import switchCamIcon from "../assets/switch-cam.svg";
import { CallObserver } from "../calls/CallObserver";
import { CallParticipant } from "../calls/CallParticipant";
import { CallParticipantEvent } from "../calls/CallParticipantEvent";
import { CallParticipantObserver } from "../calls/CallParticipantObserver";
import { CallService } from "../calls/CallService";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import { ConversationService } from "../calls/ConversationService";
import Alert from "../components/Alert";
import Header from "../components/Header";
import InitializationPanel from "../components/InitializationPanel";
import ParticipantsGrid from "../components/ParticipantsGrid";
import SelectDevicesButton from "../components/SelectDevicesButton";
import StoresBadges from "../components/StoresBadges";
import Thanks from "../components/Thanks";
import WhiteButton from "../components/WhiteButton";
import { Schedule, TwincodeInfo, dateTimeToString } from "../services/ContactService";
import { PeerCallService, TerminateReason } from "../services/PeerCallService";
import IsMobile from "../utils/IsMobile";

type FacingMode = "user" | "environment";

type ScheduleLabels = {
	startDate: string;
	endDate: string;
	startTime: string;
	endTime: string;
};

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
	t: TFunction<"translation", undefined, "translation">;
	navigate: NavigateFunction;
}

interface CallState {
	initializing: boolean;
	guestName: string;
	guestNameError: boolean;
	twincode: TwincodeInfo;
	status: CallStatus;
	audioMute: boolean;
	videoMute: boolean;
	terminateReason: TerminateReason | null;
	participants: Array<CallParticipant>;
	displayThanks: boolean;
	audioDevices: MediaDeviceInfo[];
	videoDevices: MediaDeviceInfo[];
	facingMode: FacingMode;
	usedAudioDevice: string;
	usedVideoDevice: string;
	isSharingScreen: boolean;
	chatPanelOpened: boolean;
	items: Item[];
	atLeastOneParticipantSupportsMessages: boolean;
	messageNotificationDisplayed: boolean;
	alertOpen: boolean;
	alertTitle: string;
	alertContent: ReactNode;
}

//e.g. "13:30"
const timeFormat = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" });
//e.g. "1 Décembre 2023"
const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" });

const APP_TRANSFER: boolean = import.meta.env.VITE_APP_TRANSFER === "true";
const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

// Create only one instance of PeerCallService.
const peerCallService: PeerCallService = new PeerCallService();

class Call extends Component<CallProps, CallState> implements CallParticipantObserver, CallObserver {
	private localVideoRef: RefObject<HTMLVideoElement> = React.createRef();
	private callService: CallService = new CallService(peerCallService, this, this);

	state: CallState = {
		initializing: true,
		guestName: this.getGuestName(),
		guestNameError: false,
		status: CallStatus.IDDLE,
		twincode: {
			name: null,
			description: null,
			avatarId: null,
			audio: false,
			video: false,
			transfer: false,
			schedule: null,
		},
		audioMute: false,
		videoMute: false,
		terminateReason: null,
		participants: [],
		displayThanks: false,
		audioDevices: [],
		videoDevices: [],
		facingMode: "user",
		usedAudioDevice: "",
		usedVideoDevice: "",
		isSharingScreen: false,
		chatPanelOpened: false,
		items: [],
		atLeastOneParticipantSupportsMessages: false,
		messageNotificationDisplayed: false,
		alertOpen: false,
		alertTitle: "",
		alertContent: <></>,
	};

	componentDidMount = () => {
		this.init();
	};

	init = () => {
		this.setState({
			initializing: true,
			videoMute: true,
			displayThanks: false,
			status: CallStatus.IDDLE,
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
	};

	/**
	 * The call status was changed.
	 *
	 * @param {CallStatus} status the new call status.
	 */
	onUpdateCallStatus(status: CallStatus): void {
		if (DEBUG) {
			console.log("New call status ", CallStatus[status]);
		}

		this.setState({ status: status });
	}

	onOverrideAudioVideo(audio: boolean, video: boolean): void {
		const videoChanged = video ? this.state.videoMute : !this.state.videoMute;
		if (videoChanged) {
			this.toggleVideo();
		}

		const audioChanged = audio ? this.state.audioMute : !this.state.audioMute;
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
		console.info("Call terminated", reason);

		this.setState({
			terminateReason: reason,
			status: CallStatus.TERMINATED,
			alertOpen: false,
			alertTitle: "",
			alertContent: <></>,
			chatPanelOpened: false,
			items: [],
		});

		this.callService = null as any;

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
		this.setState({ participants: participants });
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
		const list: Array<CallParticipant> = this.callService.getParticipants();
		this.setState({ participants: list });
		this.checkIsMessageSupported();
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
			this.checkIsMessageSupported();
		}
	}

	checkIsMessageSupported = () => {
		if (DEBUG) {
			console.log("Check if participants support messages");
		}
		const atLeastOneParticipantSupportsMessages = this.callService.getParticipants().some((participant) => {
			if (DEBUG) {
				console.log("isMessageSupported", participant.getCallConnection()?.isMessageSupported());
			}
			return participant.getCallConnection()?.isMessageSupported();
		});
		if (DEBUG) {
			console.log("At least one participant supports messages: ", atLeastOneParticipantSupportsMessages);
		}
		this.setState({ atLeastOneParticipantSupportsMessages });
	};

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
	}

	updateItems = (items: Item[]) => {
		const previousItem: Item = items[items.length - 2];
		const item = items[items.length - 1];

		if (item.participant) {
			// Peer item
			if (previousItem && !item.displayName) {
				// Consecutive message from same participant
				item.corners.tl = "rounded-tl";
				previousItem.corners.bl = "rounded-bl";
			}
		} else {
			// Local item
			if (previousItem && !previousItem.participant) {
				// Consecutive message from local user
				item.corners.tr = "rounded-tr";
				previousItem.corners.br = "rounded-br";
			}
		}

		const { chatPanelOpened } = this.state;
		this.setState({ items, messageNotificationDisplayed: !chatPanelOpened });
	};

	setUsedDevices() {
		const mediaStream = this.callService.getMediaStream();
		for (const track of mediaStream.getTracks()) {
			if (track.kind === "audio") {
				this.setState({ usedAudioDevice: track.getSettings().deviceId ?? "" });
			}
			if (track.kind === "video") {
				this.setState({ usedVideoDevice: track.getSettings().deviceId ?? "" });
			}
		}
	}

	handleTerminateClick: React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
		ev.preventDefault();

		if (CallStatusOps.isActive(this.state.status)) {
			this.callService.actionTerminateCall("success");
		} else {
			this.callService.actionTerminateCall("cancel");
		}
	};

	muteAudioClick: React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
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

	muteVideoClick: React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
		ev.preventDefault();
		this.toggleVideo();
	};

	private toggleVideo = () => {
		if (this.state.twincode.video) {
			const { videoMute } = this.state;

			this.setState({ videoMute: !videoMute }, async () => {
				const { status, videoMute } = this.state;
				if (!videoMute && !this.callService.hasVideoTrack()) {
					await this.askForMediaPermission("video");
				}

				if (this.callService.hasVideoTrack() && CallStatusOps.isActive(status)) {
					this.callService.actionCameraMute(videoMute);
				}
			});
		}
	};

	switchCameraClick: React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
		ev.preventDefault();
		if (this.state.twincode.video) {
			if (IsMobile()) {
				this.setState(
					({ facingMode }) => {
						return { facingMode: facingMode === "user" ? "environment" : "user" };
					},
					async () => {
						const { facingMode, status } = this.state;
						try {
							const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
								audio: false,
								video: {
									facingMode,
								},
							});
							const videoTrack = mediaStream.getVideoTracks()[0];
							this.callService.addOrReplaceVideoTrack(videoTrack);
						} catch (error) {
							console.log("Replace video track error", error);
						}
					}
				);
			} else {
				console.log(this.state.audioDevices);
				console.log(this.state.videoDevices);
			}
		}
	};

	selectAudioDevice = async (deviceId: string) => {
		try {
			const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
				audio: { deviceId },
				video: false,
			});
			const audioTrack = mediaStream.getAudioTracks()[0];
			this.callService.addOrReplaceAudioTrack(audioTrack);
			this.setUsedDevices();
		} catch (error) {
			console.log("Select audio device error", error);
		}
	};

	selectVideoDevice = async (deviceId: string) => {
		try {
			if (this.callService.hasVideoTrack()) {
				this.setState({ isSharingScreen: false });
				const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: { deviceId },
				});
				const videoTrack = mediaStream.getVideoTracks()[0];
				this.callService.addOrReplaceVideoTrack(videoTrack);
				this.setUsedDevices();
			}
		} catch (error) {
			console.log("Select video device error", error);
		}
	};

	startScreenSharing = async (mediaStream: MediaStream) => {
		if (DEBUG) {
			console.log("Start screen sharing");
		}

		try {
			const videoTrack = mediaStream.getVideoTracks()[0];
			this.callService.addOrReplaceVideoTrack(videoTrack);
			this.setUsedDevices();
			this.setState({ videoMute: false, isSharingScreen: true });
			this.callService.actionCameraMute(false);
		} catch (error) {
			console.log("Screen sharing error", error);
		}
	};

	stopScreenSharing = () => {
		if (DEBUG) {
			console.log("Stop screen sharing");
		}

		this.setState({ videoMute: true, isSharingScreen: false });
		this.callService.actionCameraMute(true);
		this.callService.actionCameraStop();
		this.setUsedDevices();
	};

	handleCallClick: React.MouseEventHandler<HTMLButtonElement> = async (ev: React.MouseEvent<HTMLButtonElement>) => {
		const { twincode, guestName } = this.state;
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
		const video: boolean = !this.state.videoMute;
		const transfer: boolean = twincode.transfer;
		const avatarUrl: string = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
		this.callService.actionOutgoingCall(this.props.id, video, transfer, name, avatarUrl);
		ev.preventDefault();
	};

	askForMediaPermission = async (kind: "audio" | "video"): Promise<boolean> => {
		const { facingMode } = this.state;

		try {
			// We need to ask for devices access this way first to be able to fetch devices labels with enumerateDevices
			// (https://developer.mozilla.org/en-US/docs/Web/API/MediaDeviceInfo/label)
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: kind === "audio",
				video: kind === "video" ? { facingMode } : false,
			});
			for (const track of mediaStream.getTracks()) {
				if (track.kind === "audio" && kind === "audio") {
					this.callService.addOrReplaceAudioTrack(track);
					this.setUsedDevices();
				}
				if (track.kind === "video" && kind === "video") {
					this.callService.addOrReplaceVideoTrack(track);
					this.setUsedDevices();
				}
				mediaStream.removeTrack(track);
			}

			const devices = await navigator.mediaDevices.enumerateDevices();
			const enumeratedDevices = {
				audioDevices: devices.filter((device) => device.kind === "audioinput").slice(),
				videoDevices: devices.filter((device) => device.kind === "videoinput").slice(),
			};
			this.setState(enumeratedDevices);

			for (const track of mediaStream.getTracks()) {
				track.stop();
			}
			return true;
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
									kind === "audio" ? "microphone_access_not_found" : "camera_access_not_found"
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
				this.setState({
					videoMute: kind === "video" || this.state.videoMute,
					alertOpen: true,
					alertTitle: this.props.t(kind === "audio" ? "microphone_access" : "camera_access"),
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
			} else {
				console.error(error);
			}
		}
		return false;
	};

	handleTransferClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		const { twincode, guestName, status } = this.state;

		if (!CallStatusOps.isActive(status) || !twincode.transfer) {
			console.error(
				"Can't transfer: call active=" +
					CallStatusOps.isActive(status) +
					", twincode.transfer=" +
					twincode.transfer
			);
			return;
		}

		this.callService.setIdentity(guestName, new ArrayBuffer(0));

		const name: string = twincode.name ? twincode.name : "Unknown";
		const transfer: boolean = twincode.transfer;
		const avatarUrl: string = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
		this.callService.actionAddCallParticipant(this.props.id, transfer, name, avatarUrl);
		ev.preventDefault();
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
			//for now, we only handle schedules with a single time range of type DateTimeRange
			const timeRange = this.state.twincode.schedule.timeRanges[0];

			const start = timeRange.start.date;
			const end = timeRange.end.date;

			if (start.day === end.day && start.month === end.month && start.year === end.year) {
				return "audio_call_activity_terminate_schedule_single_day";
			} else {
				return "audio_call_activity_terminate_schedule_multiple_days";
			}
		}

		return this.terminateMessages[terminateReason];
	};

	/**
	 * Returns values for the schedule error messages, localized in i18next's current langage
	 */
	getScheduleLabels(schedule: Schedule | null): ScheduleLabels | null {
		if (!schedule?.timeRanges[0]) {
			return null;
		}

		const range = schedule.timeRanges[0];
		const timeZone = schedule.timeZone;

		const startDate = zonedTimeToUtc(dateTimeToString(range.start), timeZone);
		const endDate = zonedTimeToUtc(dateTimeToString(range.end), timeZone);

		return {
			startDate: dateFormat.format(startDate),
			endDate: dateFormat.format(endDate),
			startTime: timeFormat.format(startDate),
			endTime: timeFormat.format(endDate),
		};
	}

	getGuestName(): string {
		return window.localStorage.getItem("guestName") ?? this.props.t("guest");
	}

	render() {
		const { id, t } = this.props;
		const {
			initializing,
			guestName,
			guestNameError,
			twincode,
			videoMute,
			audioMute,
			status,
			participants,
			terminateReason,
			displayThanks,
			audioDevices,
			videoDevices,
			usedAudioDevice,
			usedVideoDevice,
			isSharingScreen,
			chatPanelOpened,
			items,
			atLeastOneParticipantSupportsMessages,
			messageNotificationDisplayed,
			alertOpen,
			alertTitle,
			alertContent,
		} = this.state;

		if (displayThanks) {
			return <Thanks onCallBackClick={this.init} />;
		}

		return (
			<div className=" flex h-full w-screen flex-col bg-black p-4">
				<Header
					messageNotificationDisplayed={messageNotificationDisplayed}
					openChatButtonDisplayed={
						!initializing && CallStatusOps.isActive(status) && atLeastOneParticipantSupportsMessages
					}
					openChatPanel={() =>
						this.setState({ chatPanelOpened: !chatPanelOpened, messageNotificationDisplayed: false })
					}
				/>

				{initializing && (
					<InitializationPanel
						twincodeId={id}
						twincode={twincode}
						onComplete={(twincode) => {
							this.setState({ twincode, initializing: false });
						}}
					/>
				)}

				{!initializing && !CallStatusOps.isTerminated(status) && (
					<ParticipantsGrid
						chatPanelOpened={chatPanelOpened}
						closeChatPanel={() => this.setState({ chatPanelOpened: false })}
						localVideoRef={this.localVideoRef}
						localMediaStream={this.callService.getMediaStream()}
						videoMute={videoMute}
						isLocalAudioMute={audioMute}
						twincode={twincode}
						participants={participants}
						isIddle={CallStatusOps.isIddle(status)}
						guestName={guestName}
						guestNameError={guestNameError}
						setGuestName={(guestName: string) => {
							this.setState({ guestName, guestNameError: guestName === "" });
							window.localStorage.setItem("guestName", guestName);
						}}
						updateGuestName={(guestName: string) => {
							this.setState({ guestName, guestNameError: guestName === "" });
							window.localStorage.setItem("guestName", guestName);
							if (guestName !== "") {
								this.callService.updateIdentity(guestName, new ArrayBuffer(0));
							}
						}}
						muteVideoClick={this.muteVideoClick}
						pushMessage={(message, copyAllowed) => {
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
							}
							return descriptor;
						}}
						items={items}
					/>
				)}

				{!initializing && CallStatusOps.isTerminated(status) && terminateReason && (
					<div className="flex w-full flex-1 items-center justify-center text-center">
						<span>
							<Trans
								i18nKey={this.getTerminateReasonMessage(terminateReason)}
								values={{
									contactName: twincode?.name,
									...this.getScheduleLabels(twincode?.schedule),
								}}
								t={t}
							/>
						</span>
					</div>
				)}

				{!initializing && !CallStatusOps.isTerminated(status) && (
					<CallButtons
						status={status}
						handleCallClick={this.handleCallClick}
						handleHangUpClick={this.handleTerminateClick}
						handleTransferClick={this.handleTransferClick}
						audioMute={audioMute}
						muteAudioClick={this.muteAudioClick}
						hasVideo={twincode.video}
						videoMute={videoMute}
						muteVideoClick={this.muteVideoClick}
						switchCameraClick={this.switchCameraClick}
						audioDevices={audioDevices}
						videoDevices={videoDevices}
						usedAudioDevice={usedAudioDevice}
						usedVideoDevice={usedVideoDevice}
						isSharingScreen={isSharingScreen}
						selectAudioDevice={this.selectAudioDevice}
						selectVideoDevice={this.selectVideoDevice}
						startScreenSharing={this.startScreenSharing}
						stopScreenSharing={this.stopScreenSharing}
					/>
				)}

				{CallStatusOps.isIddle(status) && (
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

const CallButtons = ({
	status,
	handleCallClick,
	handleHangUpClick: hangUpClick,
	handleTransferClick,
	audioMute,
	muteAudioClick,
	hasVideo,
	videoMute,
	muteVideoClick,
	switchCameraClick,
	audioDevices,
	videoDevices,
	usedAudioDevice,
	usedVideoDevice,
	isSharingScreen,
	selectAudioDevice,
	selectVideoDevice,
	startScreenSharing,
	stopScreenSharing,
}: {
	status: CallStatus;
	handleCallClick: React.MouseEventHandler;
	handleHangUpClick: React.MouseEventHandler;
	handleTransferClick: React.MouseEventHandler;
	audioMute: boolean;
	muteAudioClick: React.MouseEventHandler;
	hasVideo: boolean;
	videoMute: boolean;
	muteVideoClick: React.MouseEventHandler;
	switchCameraClick: React.MouseEventHandler;
	audioDevices: MediaDeviceInfo[];
	videoDevices: MediaDeviceInfo[];
	usedAudioDevice: string;
	usedVideoDevice: string;
	isSharingScreen: boolean;
	selectAudioDevice: (deviceId: string) => void;
	selectVideoDevice: (deviceId: string) => void;
	startScreenSharing: (mediaStream: MediaStream) => void;
	stopScreenSharing: () => void;
}) => {
	const { t } = useTranslation();
	const inCall = CallStatusOps.isActive(status);
	const isIddle = CallStatusOps.isIddle(status);
	const inTransfer = APP_TRANSFER && inCall;

	return (
		<div className="mx-auto flex w-full items-center justify-between md:w-96 md:rounded-lg md:bg-zinc-800 md:px-4 md:py-2">
			<div>
				<button
					className={[
						"flex items-center justify-center rounded-full px-6 py-3 text-white transition ",
						isIddle
							? "bg-blue hover:bg-blue/90 active:bg-blue/80"
							: "bg-red hover:bg-red/90 active:bg-red/80",
					].join(" ")}
					onClick={isIddle ? handleCallClick : hangUpClick}
				>
					<img src={phoneCallIcon} alt="" className="mr-3" />
					{inCall ? (
						<Timer />
					) : (
						<span className="font-light">{isIddle ? t("call") : t("audio_call_activity_calling")}</span>
					)}
				</button>
			</div>
			{inTransfer && (
				<div>
					<button
						className="flex items-center justify-center rounded-full bg-blue px-6 py-3 text-white transition hover:bg-blue/90 active:bg-blue/80"
						onClick={handleTransferClick}
					>
						<img src={phoneCallIcon} alt="" className="mr-3" />
						<span className="font-light">Transfer</span>
					</button>
				</div>
			)}

			<div className="flex items-center justify-end">
				{!videoMute && IsMobile() && hasVideo && (
					<button
						className=" ml-3 rounded-full bg-white p-2 hover:bg-white/90 active:bg-white/80 "
						onClick={switchCameraClick}
					>
						<img src={switchCamIcon} alt="" />
					</button>
				)}
				{inCall && (
					<WhiteButton onClick={muteAudioClick} className="ml-3 rounded-full ">
						<img src={audioMute ? micOffIcon : micOnIcon} alt="" className="w-[37px]" />
					</WhiteButton>
				)}
				{hasVideo && !isSharingScreen && (
					<WhiteButton onClick={muteVideoClick} className="ml-3">
						<img src={videoMute ? camOffIcon : camOnIcon} alt="" className="w-[37px]" />
					</WhiteButton>
				)}
				{!IsMobile() && (
					<WhiteButton
						className="ml-3 !p-[10px]"
						onClick={async () => {
							if (!isSharingScreen) {
								try {
									const mediaStream = await navigator.mediaDevices.getDisplayMedia({
										video: true,
										audio: false,
									});
									console.log("mediaStream", mediaStream);
									if (mediaStream) {
										startScreenSharing(mediaStream);
									}
								} catch (error) {
									console.error("Screen sharing error or denied : ", error);
								}
							} else {
								stopScreenSharing();
							}
						}}
					>
						{isSharingScreen ? <ScreenShareOff color="black" /> : <ScreenShare color="black" />}
					</WhiteButton>
				)}
				{!IsMobile() && (
					<SelectDevicesButton
						audioDevices={audioDevices}
						videoDevices={videoDevices}
						usedAudioDevice={usedAudioDevice}
						usedVideoDevice={usedVideoDevice}
						selectAudioDevice={selectAudioDevice}
						selectVideoDevice={selectVideoDevice}
					/>
				)}
			</div>
		</div>
	);
};

const Timer = () => {
	const [time, setTime] = useState("00:00");
	const [seconds, setSeconds] = useState(0);

	useEffect(() => {
		const interval = setInterval(incrementTime, 1000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		let difference = seconds * 1000;

		const daysDifference = Math.floor(difference / 1000 / 60 / 60 / 24);
		difference -= daysDifference * 1000 * 60 * 60 * 24;

		const hoursDifference = Math.floor(difference / 1000 / 60 / 60);
		difference -= hoursDifference * 1000 * 60 * 60;
		const h = hoursDifference >= 10 ? hoursDifference : "0" + hoursDifference;

		const minutesDifference = Math.floor(difference / 1000 / 60);
		difference -= minutesDifference * 1000 * 60;
		const m = minutesDifference >= 10 ? minutesDifference : "0" + minutesDifference;

		const secondsDifference = Math.floor(difference / 1000);
		const s = secondsDifference >= 10 ? secondsDifference : "0" + secondsDifference;

		setTime(h != "00" ? h + ":" : "" + m + ":" + s);
	}, [seconds]);

	const incrementTime = () => {
		setSeconds((seconds) => seconds + 1);
	};

	return <span className="font-light">{time}</span>;
};

const CallWithParams = () => {
	const { t } = useTranslation();
	const { id } = useParams();
	const navigate = useNavigate();
	return <Call id={id!} t={t} navigate={navigate} />;
};

export default CallWithParams;
