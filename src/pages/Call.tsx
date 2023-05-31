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
import React, { Component, RefObject, useEffect, useRef, useState } from "react";
import "react-confirm-alert/src/react-confirm-alert.css";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import appStoreBadge from "../assets/appstore-badge.svg";
import camOffIcon from "../assets/cam-off.svg";
import camOnIcon from "../assets/cam-on.svg";
import androidPlayBadge from "../assets/google-play-badge.png";
import micOffIcon from "../assets/mic-off.svg";
import micOnIcon from "../assets/mic-on.svg";
import phoneCallIcon from "../assets/phone-call.svg";
import switchCamIcon from "../assets/switch-cam.svg";
import twinmeLogo from "../assets/twinme.png";
import { CallObserver } from "../calls/CallObserver";
import { CallParticipant } from "../calls/CallParticipant";
import { CallParticipantEvent } from "../calls/CallParticipantEvent";
import { CallParticipantObserver } from "../calls/CallParticipantObserver";
import { CallService } from "../calls/CallService";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import config from "../config.json";
import { ContactService, TwincodeInfo } from "../services/ContactService";
import { PeerCallService, TerminateReason } from "../services/PeerCallService";

interface CallProps {
	id: string;
	t: TFunction<"translation", undefined, "translation">;
}

interface CallState {
	guestName: string;
	guestNameError: boolean;
	twincode: TwincodeInfo;
	status: CallStatus;
	audioMute: boolean;
	videoMute: boolean;
	terminateReason: TerminateReason | null;
	participants: Array<CallParticipant>;
}

class Call extends Component<CallProps, CallState> implements CallParticipantObserver, CallObserver {
	private localVideoRef: RefObject<HTMLVideoElement> = React.createRef();
	private contactService: ContactService = new ContactService();
	private peerCallService: PeerCallService = new PeerCallService();
	private callService: CallService = new CallService(this.peerCallService, this, this);
	private twincodeId: string | null = null;

	state: CallState = {
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
	};

	componentDidMount = () => {
		this.retrieveInformation();
	};

	/**
	 * The call status was changed.
	 *
	 * @param {CallStatus} status the new call status.
	 */
	onUpdateCallStatus(status: CallStatus): void {
		console.log("New call status " + status);

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
	}

	/**
	 * A new participant is added to the call group.
	 *
	 * @param {CallParticipant} participant the participant.
	 */
	onAddParticipant(participant: CallParticipant): void {
		console.log("Add new participant " + participant);

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

	reverseDisplay: React.MouseEventHandler<HTMLVideoElement> = (ev: React.MouseEvent<HTMLVideoElement>) => {
		/* if (this.remoteVideoElement && this.localVideoElement) {
            this.remoteVideoElement.pause();
            this.localVideoElement.pause();

            const stream = this.remoteVideoElement.srcObject;
            this.remoteVideoElement.srcObject = this.localVideoElement.srcObject;
            this.localVideoElement.srcObject = stream;
        }*/
	};

	retrieveInformation() {
		const id = this.props.id;

		if (id) {
			this.twincodeId = id;
			this.contactService
				.getTwincode(id)
				.then(async (response: AxiosResponse<TwincodeInfo, any>) => {
					let twincode = response.data;
					this.setState({ twincode: twincode, videoMute: true });

					const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
						audio: true,
					});
					const callServiceMediaStream = this.callService.setMediaStream(mediaStream);

					if (this.localVideoRef.current) {
						this.localVideoRef.current.srcObject = callServiceMediaStream;
					} else {
						console.log("There is no local video element");
					}
				})
				.catch((e) => {
					console.error("retrieveInformation", e);
				});
		}
	}

	handleTerminateClick: React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
		ev.preventDefault();

		this.callService.actionTerminateCall("success");
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
				const { status, videoMute } = this.state;
				if (!videoMute && !this.callService.hasVideoTrack()) {
					try {
						const mediaStream: MediaStream = await navigator.mediaDevices.getUserMedia({
							audio: false,
							video: true,
						});
						const videoTrack = mediaStream.getVideoTracks()[0];
						this.callService.addVideoTrack(videoTrack);
					} catch (error) {
						console.log("Add video track", error);
					}
				}

				if (CallStatusOps.isActive(status)) {
					this.callService.actionCameraMute(videoMute);
				}
			});
		}
	};

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
		let avatarUrl: string = config.rest_url + "/images/" + twincode.avatarId;
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
		const { guestName, guestNameError, twincode, videoMute, audioMute, status, terminateReason } = this.state;

		return (
			<div className=" flex h-full w-screen flex-col bg-black p-4">
				<Header />
				{!CallStatusOps.isTerminated(status) && (
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
					/>
				)}

				{CallStatusOps.isTerminated(status) && terminateReason && (
					<TerminateLabel
						terminateLabel={this.getTerminateReasonMessage(terminateReason)}
						contactName={twincode?.name}
					/>
				)}

				{!CallStatusOps.isTerminated(status) && (
					<CallButtons
						status={status}
						handleCallClick={this.handleCallClick}
						handleHangUpClick={this.handleTerminateClick}
						audioMute={audioMute}
						muteAudioClick={this.muteAudioClick}
						videoMute={videoMute}
						muteVideoClick={this.muteVideoClick}
					/>
				)}

				<NextTimeLabel />
				<StoresBadges />
			</div>
		);
	}
}

const NextTimeLabel = () => {
	const { t } = useTranslation();
	return <div className="py-6 text-center font-light">{t("next_time_app")}</div>;
};

const TerminateLabel = ({ terminateLabel, contactName }: { terminateLabel: string; contactName: string | null }) => {
	const { t } = useTranslation();

	return (
		<div className="flex w-full flex-1 items-center justify-center text-center">
			<span>
				<Trans i18nKey={terminateLabel} values={{ contactName }} t={t} />
			</span>
		</div>
	);
};

const Header = () => (
	<div className="flex w-full items-center justify-between">
		<div className="flex items-center justify-start">
			<img src={twinmeLogo} alt="" className="w-8" />
			<div className="ml-2 font-light text-grey">{config.appName}</div>
		</div>
		{/* <div>Coccinelle d'occasion</div> */}
	</div>
);

const ParticipantsGrid = ({
	localVideoRef,
	videoMute,
	twincode,
	participants,
	isIddle,
	guestName,
	guestNameError,
	setGuestName,
}: {
	localVideoRef: RefObject<HTMLVideoElement>;
	videoMute: boolean;
	twincode: TwincodeInfo;
	participants: CallParticipant[];
	isIddle: boolean;
	guestName: string;
	guestNameError: boolean;
	setGuestName: (value: string) => void;
}) => {
	const { t } = useTranslation();

	let gridClass = "";
	if (participants.length < 2) {
		gridClass = "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
	} else if (participants.length < 5) {
		gridClass = "grid-cols-2 grid-rows-2";
	} else if (participants.length < 5) {
		gridClass = "grid-cols-2 grid-rows-2";
	} else if (participants.length < 7) {
		gridClass = "grid-cols-3 grid-rows-2";
	} else if (participants.length < 10) {
		gridClass = "grid-cols-3 grid-rows-3";
	}

	return (
		<div className={["grid flex-1 gap-4 overflow-hidden py-4", gridClass].join(" ")}>
			{participants.map((participant) => (
				<ParticipantGridCell key={participant.getParticipantId()} participant={participant} />
			))}
			{participants.length === 0 && (
				<>
					<div className="relative flex items-center justify-center overflow-hidden rounded-md bg-[#202020]">
						{twincode.avatarId && (
							<>
								<img
									src={`${config.rest_url}/images/${twincode.avatarId}`}
									alt=""
									className="z-10 h-full w-full object-cover md:h-48 md:w-48 md:rounded-full md:shadow-lg"
								/>
								<img
									src={`${config.rest_url}/images/${twincode.avatarId}`}
									alt=""
									className="absolute left-0 top-0 h-full w-full object-cover blur"
								/>
							</>
						)}
						<div
							className={["absolute bottom-2 right-2 z-10 rounded-lg bg-black/70 px-2 py-1 text-sm"].join(
								" "
							)}
						>
							{twincode.name}
						</div>
					</div>
				</>
			)}
			<div className="relative overflow-hidden rounded-md">
				<video
					ref={localVideoRef}
					className={["h-full w-full object-cover", videoMute ? "hidden" : ""].join(" ")}
					autoPlay
					muted={true}
				></video>

				<div
					className={[
						"flex h-full w-full flex-col items-center justify-center bg-[#202020]",
						videoMute ? "" : "hidden",
					].join(" ")}
				>
					<div
						className={[
							"flex h-20 w-20 items-center justify-center rounded-full bg-[#2f2f2f] text-5xl md:h-28 md:w-28",
							videoMute ? "" : "hidden",
						].join(" ")}
					>
						<svg width="2rem" height="2rem" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg">
							<g
								transform="translate(8 12)"
								stroke="#808080"
								strokeWidth="2"
								fill="none"
								fillRule="evenodd"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m22 2-7 5 7 5z" />
								<rect width="15" height="14" rx="2" />
							</g>
						</svg>
					</div>
					<span className=" mt-2 text-sm md:text-base">{t("activate_camera")}</span>
				</div>
				<div className={["absolute bottom-2 right-2 text-sm"].join(" ")}>
					{isIddle && (
						<>
							{guestNameError && (
								<div className="animate-skaheX py-1 text-orange-600">Veuillez saisir un nom</div>
							)}
							<div
								className={[
									"rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition",
									guestNameError ? "!border-orange-600" : "",
								].join(" ")}
							>
								<input
									type="text"
									value={guestName}
									className=" bg-transparent placeholder:font-light placeholder:text-[#656565] focus:outline-none "
									placeholder="Entrez un pseudo"
									onChange={(e) => setGuestName(e.target.value)}
								/>
							</div>
						</>
					)}
					{!isIddle && <div className="rounded-lg bg-black/70 px-2 py-1">{guestName}</div>}
				</div>
			</div>
		</div>
	);
};

const ParticipantGridCell = ({ participant }: { participant: CallParticipant }) => {
	const ref = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (ref.current) participant.setRemoteRenderer(ref.current);
	}, []);

	return (
		<div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[#202020]">
			{participant.isAudioMute() && (
				<div className="absolute right-2 top-2 text-2xl">
					<svg width="1em" height="1em" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
						<g fill="none" fillRule="evenodd">
							<circle fill="#FD605D" cx={13} cy={13} r={13} />
							<path
								d="m8.825 18.486.809-.795c.77.577 1.72.933 2.763.933h1.145c2.528 0 4.578-2.014 4.578-4.5V13h1.144v1.125c0 3.106-2.562 5.625-5.722 5.625v1.124h.572c.316 0 .572.252.572.563 0 .311-.256.563-.572.563h-2.289a.568.568 0 0 1-.572-.563c0-.311.256-.563.572-.563h.572V19.75a5.726 5.726 0 0 1-3.572-1.264zm8.15-8.012v3.088c0 2.175-1.793 3.937-4.006 3.937a4.017 4.017 0 0 1-2.358-.769l6.364-6.256zm-10.3 3.65V13h1.144v1.125c0 .423.079.825.19 1.213l-.91.895a5.507 5.507 0 0 1-.425-2.108zm2.367.199c-.05-.246-.078-.5-.078-.76V7.936C8.964 5.763 10.757 4 12.969 4a3.986 3.986 0 0 1 3.795 2.733l-7.722 7.59zM6.5 19.5l-.5-.607L19.197 5.921l.303.579-13 13z"
								fill="#FFF"
							/>
						</g>
					</svg>
				</div>
			)}

			<img
				src={participant.getAvatarUrl() ?? ""}
				alt=""
				className="pointer-events-none z-10 h-full w-full object-cover md:h-48 md:w-48 md:rounded-full md:shadow-lg"
			/>
			<img
				src={participant.getAvatarUrl() ?? ""}
				alt=""
				className="pointer-events-none absolute left-0 top-0 h-full w-full object-cover blur"
			/>

			<video
				ref={ref}
				autoPlay
				id={"videoElement-" + participant.getParticipantId()}
				className={["h-full w-full object-cover", participant.isCameraMute() ? "hidden" : ""].join(" ")}
			></video>
			<div
				className={[
					"absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-sm",
					participant.getName() ? "" : "hidden",
				].join(" ")}
			>
				{participant.getName()}
			</div>
		</div>
	);
};

const CallButtons = ({
	status,
	handleCallClick,
	handleHangUpClick: hangUpClick,
	audioMute,
	muteAudioClick,
	videoMute,
	muteVideoClick,
}: {
	status: CallStatus;
	handleCallClick: React.MouseEventHandler;
	handleHangUpClick: React.MouseEventHandler;
	audioMute: boolean;
	muteAudioClick: React.MouseEventHandler;
	videoMute: boolean;
	muteVideoClick: React.MouseEventHandler;
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
					<button
						className="mr-3 rounded-full bg-white p-1 hover:bg-white/90 active:bg-white/80"
						onClick={muteAudioClick}
					>
						<img src={audioMute ? micOffIcon : micOnIcon} alt="" className="w-[37px]" />
					</button>
				)}
				<button
					className="mr-3 rounded-full bg-white p-1 hover:bg-white/90 active:bg-white/80"
					onClick={muteVideoClick}
				>
					<img src={videoMute ? camOffIcon : camOnIcon} alt="" className="w-[37px]" />
				</button>
				<button className="rounded-full bg-white p-2 hover:bg-white/90 active:bg-white/80 ">
					<img src={switchCamIcon} alt="" />
				</button>
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

const StoresBadges = () => {
	let isMobile = window.matchMedia("(any-pointer:coarse)").matches;
	console.log("IS MOBILE", isMobile);

	return (
		<div className="mx-auto grid max-w-md grid-cols-2">
			<a href="https://apps.apple.com/app/twinme-private-messenger/id889904498" target="_blank">
				<img className="mx-auto" src={appStoreBadge} alt="Download on the App Store" />
			</a>
			<a href="https://play.google.com/store/apps/details?id=org.twinlife.device.android.twinme" target="_blank">
				<img
					className="mx-auto"
					style={{ width: 154, marginTop: -10 }}
					src={androidPlayBadge}
					alt="Get it on Google Play"
				/>
			</a>
		</div>
	);
};

const CallWithParams = () => {
	const { t } = useTranslation();
	const { id } = useParams();
	return <Call id={id!} t={t} />;
};

export default CallWithParams;
