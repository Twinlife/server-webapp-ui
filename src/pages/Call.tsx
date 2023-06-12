/*
 *  Copyright (c) 2021-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 */
import { AxiosResponse } from "axios";
import { TFunction } from "i18next";
import React, { Component, RefObject, useEffect, useState } from "react";
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
import Header from "../components/Header";
import ParticipantsGrid from "../components/ParticipantsGrid";
import SelectDevicesButton from "../components/SelectDevicesButton";
import StoresBadges from "../components/StoresBadges";
import Thanks from "../components/Thanks";
import WhiteButton from "../components/WhiteButton";
import { ContactService, TwincodeInfo } from "../services/ContactService";
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
}

class Call extends Component<CallProps, CallState> implements CallParticipantObserver, CallObserver {
	private localVideoRef: RefObject<HTMLVideoElement> = React.createRef();
	private contactService: ContactService = new ContactService();
	private peerCallService: PeerCallService = new PeerCallService();
	private callService: CallService = new CallService(this.peerCallService, this, this);
	private twincodeId: string | null = null;

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
	};

	componentDidMount = () => {
		this.init();
	};

	init = () => {
		this.setState({ initializing: true });
		if (!this.callService) {
			this.callService = new CallService(this.peerCallService, this, this);
		}
		this.enumerateDevices();
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

	retrieveInformation() {
		const id = this.props.id;

		if (id) {
			this.twincodeId = id;
			this.contactService
				.getTwincode(id)
				.then(async (response: AxiosResponse<TwincodeInfo, any>) => {
					let twincode = response.data;
					this.setState({
						initializing: false,
						twincode: twincode,
						videoMute: true,
						displayThanks: false,
						status: CallStatus.IDDLE,
						audioMute: false,
						terminateReason: null,
						participants: [],
					});

					const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
						audio: true,
					});
					this.callService.addOrReplaceAudioTrack(mediaStream.getAudioTracks()[0]);
					this.setUsedDevices();

					if (this.localVideoRef.current) {
						this.localVideoRef.current.srcObject = this.callService.getMediaStream();
					} else {
						console.log("There is no local video element");
					}
				})
				.catch((e) => {
					console.error("retrieveInformation", e);
					this.props.navigate("/error");
				});
		}
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
		const { audioMute } = this.state;
		this.setState({ audioMute: !audioMute }, () => {
			const { audioMute } = this.state;
			this.callService.actionAudioMute(audioMute);
		});
	};

	muteVideoClick: React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
		ev.preventDefault();
		if (this.state.twincode.video) {
			const { videoMute } = this.state;

			this.setState({ videoMute: !videoMute }, async () => {
				const { status, videoMute, facingMode, usedVideoDevice } = this.state;
				if (!videoMute && !this.callService.hasVideoTrack()) {
					try {
						const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
							audio: false,
							video: {
								facingMode: IsMobile() ? facingMode : undefined,
								deviceId: usedVideoDevice,
							},
						});
						const videoTrack = mediaStream.getVideoTracks()[0];
						this.callService.addOrReplaceVideoTrack(videoTrack);
						this.setUsedDevices();
					} catch (error) {
						console.log("Add video track error", error);
					}
				}

				if (CallStatusOps.isActive(status)) {
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

	enumerateDevices(): void {
		navigator.mediaDevices
			// We need to ask for devices access this way first to be able to fetch devices labels with enumerateDevices
			// (https://developer.mozilla.org/en-US/docs/Web/API/MediaDeviceInfo/label)
			.getUserMedia({ audio: true, video: true })
			.then((mediaStream) => {
				for (const track of mediaStream.getTracks()) {
					if (track.kind === "audio") {
						this.setState({ usedAudioDevice: track.getSettings().deviceId ?? "" });
					}
					if (track.kind === "video") {
						this.setState({ usedVideoDevice: track.getSettings().deviceId ?? "" });
					}
				}

				navigator.mediaDevices.enumerateDevices().then((devices) => {
					console.log("Available devices", JSON.stringify(devices, null, 2));
					this.setState({
						audioDevices: devices.filter((device) => device.kind === "audioinput").slice(),
						videoDevices: devices.filter((device) => device.kind === "videoinput").slice(),
					});

					for (const track of mediaStream.getTracks()) {
						track.stop();
					}
				});
			})
			.catch((error) => console.error("Error during enumerateDevices", error))
			.finally(() => {
				this.retrieveInformation();
			});
	}

	handleCallClick: React.MouseEventHandler<HTMLButtonElement> = (ev: React.MouseEvent<HTMLButtonElement>) => {
		const id = this.props.id;

		if (!this.twincodeId || !id) {
			return;
		}

		const { guestName } = this.state;
		if (guestName === "") {
			this.setState({ guestNameError: true });
			console.error("Identity name needed");
			return;
		}

		this.callService.setIdentity(guestName, new ArrayBuffer(0));

		let twincode: TwincodeInfo = this.state.twincode;
		let name: string = twincode.name ? twincode.name : "Unknown";
		let video: boolean = !this.state.videoMute;
		let avatarUrl: string = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
		this.callService.actionOutgoingCall(this.twincodeId, video, name, avatarUrl);
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
		const { t } = this.props;
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
		} = this.state;

		if (displayThanks) {
			return <Thanks onCallBackClick={this.init} />;
		}

		return (
			<div className=" flex h-full w-screen flex-col bg-black p-4">
				<Header />

				{initializing && (
					<div className="flex flex-1 items-center justify-center">
						<svg
							className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							></circle>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					</div>
				)}

				{!initializing && !CallStatusOps.isTerminated(status) && (
					<ParticipantsGrid
						localVideoRef={this.localVideoRef}
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
						audioMute={audioMute}
						muteAudioClick={this.muteAudioClick}
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
			</div>
		);
	}
}

const CallButtons = ({
	status,
	handleCallClick,
	handleHangUpClick: hangUpClick,
	audioMute,
	muteAudioClick,
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
	audioMute: boolean;
	muteAudioClick: React.MouseEventHandler;
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
	const [t] = useTranslation();
	const inCall = CallStatusOps.isActive(status);
	const isIddle = CallStatusOps.isIddle(status);

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
			<div className="flex items-center justify-end">
				{inCall && (
					<WhiteButton onClick={muteAudioClick} className="ml-3 rounded-full ">
						<img src={audioMute ? micOffIcon : micOnIcon} alt="" className="w-[37px]" />
					</WhiteButton>
				)}
				<WhiteButton onClick={muteVideoClick} className="ml-3">
					<img src={videoMute ? camOffIcon : camOnIcon} alt="" className="w-[37px]" />
				</WhiteButton>
				{!videoMute && IsMobile() && (
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
