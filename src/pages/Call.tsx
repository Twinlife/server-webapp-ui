/*
 *  Copyright (c) 2021-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
import { TFunction } from "i18next";
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
import Alert from "../components/Alert";
import Header from "../components/Header";
import ParticipantsGrid from "../components/ParticipantsGrid";
import SelectDevicesButton from "../components/SelectDevicesButton";
import SetupPanel from "../components/SetupPanel";
import StoresBadges from "../components/StoresBadges";
import Thanks from "../components/Thanks";
import WhiteButton from "../components/WhiteButton";
import { TwincodeInfo } from "../services/ContactService";
import { PeerCallService, TerminateReason } from "../services/PeerCallService";
import IsMobile from "../utils/IsMobile";

type FacingMode = "user" | "environment";

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
	alertOpen: boolean;
	alertTitle: string;
	alertContent: ReactNode;
}

const APP_TRANSFER: boolean = import.meta.env.VITE_APP_TRANSFER === "true";

class Call extends Component<CallProps, CallState> implements CallParticipantObserver, CallObserver {
	private localVideoRef: RefObject<HTMLVideoElement> = React.createRef();
	private peerCallService: PeerCallService = new PeerCallService();
	private callService: CallService = new CallService(this.peerCallService, this, this);

	state: CallState = {
		initializing: true,
		guestName: this.props.t("guest"),
		guestNameError: false,
		status: CallStatus.IDDLE,
		twincode: {
			name: null,
			description: null,
			avatarId: null,
			audio: false,
			video: false,
			transfer: false,
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
			this.callService = new CallService(this.peerCallService, this, this);
		}
	};

	/**
	 * The call status was changed.
	 *
	 * @param {CallStatus} status the new call status.
	 */
	onUpdateCallStatus(status: CallStatus): void {
		console.log("New call status ", CallStatus[status]);

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
		console.log("Call terminated " + reason);

		this.setState({
			terminateReason: reason,
			status: CallStatus.TERMINATED,
			alertOpen: false,
			alertTitle: "",
			alertContent: <></>,
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
		console.log("Add new participant ", participant);

		let participants: Array<CallParticipant> = this.callService.getParticipants();
		this.setState({ participants: participants });
	}

	/**
	 * One or several participants are removed from the call.
	 *
	 * @param {CallParticipant[]} participants the list of participants being removed.
	 */
	onRemoveParticipants(participants: Array<CallParticipant>): void {
		console.log("Remove participants ");
		let list: Array<CallParticipant> = this.callService.getParticipants();
		this.setState({ participants: list });
	}

	/**
	 * An event occurred for the participant and its state was changed.
	 *
	 * @param {CallParticipant} participant the participant.
	 * @param {CallParticipantEvent} event the event that occurred.
	 */
	onEventParticipant(participant: CallParticipant, event: CallParticipantEvent): void {
		console.log("Participant event: " + event);

		let participants: Array<CallParticipant> = this.callService.getParticipants();
		this.setState({ participants: participants });
	}

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
				const { status, videoMute, facingMode, usedVideoDevice } = this.state;
				if (!videoMute && !this.callService.hasVideoTrack()) {
					try {
						const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
							audio: false,
							video: {
								facingMode: facingMode,
								deviceId: usedVideoDevice,
							},
						});

						const devices = await navigator.mediaDevices.enumerateDevices();
						this.setState({
							videoDevices: devices.filter((device) => device.kind === "videoinput").slice(),
						});

						const videoTrack = mediaStream.getVideoTracks()[0];
						this.callService.addOrReplaceVideoTrack(videoTrack);
						this.setUsedDevices();
					} catch (error) {
						console.log("Add video track error", error);
						if (error instanceof DOMException) {
							console.log("Mute video DOMException", error.name);
							let alertMessage = <></>;
							switch (error.name) {
								case "NotAllowedError":
									console.log("NOT ALLOWED");
									alertMessage = <div>{this.props.t("camera_access_denied")}</div>;
									break;
								case "NotFoundError":
									console.log("NOT FOUND");
									alertMessage = <div>{this.props.t("camera_access_not_found")}</div>;
									break;
								default:
									console.log("DEFAULT ERROR");
									alertMessage = <div>{this.props.t("camera_access_error")}</div>;
									break;
							}
							this.setState({
								alertOpen: true,
								alertTitle: this.props.t("camera_access"),
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
										</div>{" "}
									</>
								),
							});
						}
						this.setState({ videoMute: true });
					}
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
			this.setState({ usedAudioDevice: deviceId });
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
			this.setState({ usedVideoDevice: deviceId });
			if (this.callService.hasVideoTrack()) {
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

	handleCallClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		const { twincode, guestName } = this.state;
		if (guestName === "") {
			this.setState({ guestNameError: true });
			console.error("Identity name needed");
			return;
		}

		this.callService.setIdentity(guestName, new ArrayBuffer(0));

		let name: string = twincode.name ? twincode.name : "Unknown";
		let video: boolean = !this.state.videoMute;
		let transfer: boolean = twincode.transfer;
		let avatarUrl: string = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
		this.callService.actionOutgoingCall(this.props.id, video, transfer, name, avatarUrl);
		ev.preventDefault();
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

		let name: string = twincode.name ? twincode.name : "Unknown";
		let transfer: boolean = twincode.transfer;
		let avatarUrl: string = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
		this.callService.actionAddCallParticipant(this.props.id, transfer, name, avatarUrl);
		ev.preventDefault();
	};

	getTerminateReasonMessage = (terminateReason: TerminateReason): string => {
		let terminatedConnectionLabelID = "";
		switch (terminateReason) {
			case "success":
				terminatedConnectionLabelID = "audio_call_activity_terminate";
				break;
			case "busy":
				terminatedConnectionLabelID = "audio_call_activity_terminate_busy";
				break;
			case "cancel":
				terminatedConnectionLabelID = "audio_call_activity_terminate_cancel";
				break;
			case "connectivity-error":
				terminatedConnectionLabelID = "audio_call_activity_terminate_connectivity_error";
				break;
			case "decline":
				terminatedConnectionLabelID = "audio_call_activity_terminate_decline";
				break;
			case "gone":
				terminatedConnectionLabelID = "audio_call_activity_terminate_gone";
				break;
			case "revoked":
				terminatedConnectionLabelID = "audio_call_activity_terminate_revoked";
				break;
			case "expired":
				terminatedConnectionLabelID = "audio_call_activity_terminate_timeout";
				break;
			case "general-error":
				console.error("PeerConnectionService.TerminateReason.GENERAL_ERROR");
				return "";
			default:
				return "";
		}
		return terminatedConnectionLabelID;
	};

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
			terminateReason,
			displayThanks,
			audioDevices,
			videoDevices,
			usedAudioDevice,
			usedVideoDevice,
			alertOpen,
			alertTitle,
			alertContent,
		} = this.state;

		if (displayThanks) {
			return <Thanks onCallBackClick={this.init} />;
		}

		return (
			<div className=" flex h-full w-screen flex-col bg-black p-4">
				<Header />

				{initializing && (
					<SetupPanel
						twincodeId={id}
						twincode={twincode}
						audioDevices={audioDevices}
						// videoDevices={videoDevices}
						usedAudioDevice={usedAudioDevice}
						// usedVideoDevice={usedVideoDevice}
						setTwincode={(twincode) => this.setState({ twincode })}
						setEnumeratedDevices={(devices) => this.setState(devices)}
						setUsedAudioDevice={(usedAudioDevice) => this.setState({ usedAudioDevice })}
						// setUsedVideoDevice={(usedVideoDevice) => this.setState({ usedVideoDevice })}
						onAddOrReplaceAudioTrack={(audioTrack) => {
							this.callService.addOrReplaceAudioTrack(audioTrack);
							this.setUsedDevices();
						}}
						onComplete={() => {
							if (
								!(document as any).webkitVisibilityState ||
								(document as any).webkitVisibilityState !== "prerender"
							) {
								this.peerCallService.setupWebsocket();
								setTimeout(() => {
									this.setState({ initializing: false });
								}, 2000);
							}
						}}
					/>
				)}

				{!initializing && !CallStatusOps.isTerminated(status) && (
					<ParticipantsGrid
						localVideoRef={this.localVideoRef}
						localMediaStream={this.callService.getMediaStream()}
						videoMute={videoMute}
						twincode={twincode}
						participants={this.state.participants}
						isIddle={CallStatusOps.isIddle(status)}
						guestName={guestName}
						guestNameError={guestNameError}
						setGuestName={(guestName: string) =>
							this.setState({ guestName, guestNameError: guestName === "" })
						}
						muteVideoClick={this.muteVideoClick}
					/>
				)}

				{!initializing && CallStatusOps.isTerminated(status) && terminateReason && (
					<div className="flex w-full flex-1 items-center justify-center text-center">
						<span>
							<Trans
								i18nKey={this.getTerminateReasonMessage(terminateReason)}
								values={{ contactName: twincode?.name }}
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
						selectAudioDevice={this.selectAudioDevice}
						selectVideoDevice={this.selectVideoDevice}
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
	selectAudioDevice,
	selectVideoDevice,
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
	selectAudioDevice: (deviceId: string) => void;
	selectVideoDevice: (deviceId: string) => void;
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
				{inCall && (
					<WhiteButton onClick={muteAudioClick} className="ml-3 rounded-full ">
						<img src={audioMute ? micOffIcon : micOnIcon} alt="" className="w-[37px]" />
					</WhiteButton>
				)}
				{hasVideo && (
					<WhiteButton onClick={muteVideoClick} className="ml-3">
						<img src={videoMute ? camOffIcon : camOnIcon} alt="" className="w-[37px]" />
					</WhiteButton>
				)}
				{!videoMute && IsMobile() && hasVideo && (
					<button
						className=" ml-3 rounded-full bg-white p-2 hover:bg-white/90 active:bg-white/80 "
						onClick={switchCameraClick}
					>
						<img src={switchCamIcon} alt="" />
					</button>
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

		let daysDifference = Math.floor(difference / 1000 / 60 / 60 / 24);
		difference -= daysDifference * 1000 * 60 * 60 * 24;

		let hoursDifference = Math.floor(difference / 1000 / 60 / 60);
		difference -= hoursDifference * 1000 * 60 * 60;
		let h = hoursDifference >= 10 ? hoursDifference : "0" + hoursDifference;

		let minutesDifference = Math.floor(difference / 1000 / 60);
		difference -= minutesDifference * 1000 * 60;
		let m = minutesDifference >= 10 ? minutesDifference : "0" + minutesDifference;

		let secondsDifference = Math.floor(difference / 1000);
		let s = secondsDifference >= 10 ? secondsDifference : "0" + secondsDifference;

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
