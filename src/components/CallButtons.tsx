/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
import clsx from "clsx";
import { Mic, MicOff, SwitchCamera, Video, VideoOff } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PhoneCallIcon from "../assets/phone-call.svg";
import MonitorOff from "../assets/monitor-off.svg";
import MonitorOn from "../assets/monitor.svg";
import ChatIcon from "../assets/chat-black.svg";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import WhiteButton from "../components/WhiteButton";
import { isMobile } from "../utils/BrowserCapabilities";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { SettingsDialog } from "../settings/SettingsDialog";
import { chatStore } from "../stores/chat";
import { useSnapshot } from "valtio";
import { mediaStreams } from "../utils/MediaStreams";

const MEETING = import.meta.env.VITE_APP_MEETING === "true";
const TRANSFER = import.meta.env.VITE_APP_TRANSFER === "true";

export interface CallButtonHandlers {
	onCallClick: React.MouseEventHandler<HTMLButtonElement>;
	onTerminateClick: React.MouseEventHandler<HTMLButtonElement>;
	onTransferClick: React.MouseEventHandler<HTMLButtonElement>;

	onMuteAudioClick: React.MouseEventHandler<HTMLButtonElement>;
	onMuteVideoClick: React.MouseEventHandler<HTMLButtonElement>;
	onSharingScreenClick: React.MouseEventHandler<HTMLButtonElement>;
	onSwitchCameraClick: React.MouseEventHandler<HTMLButtonElement>;
	onChatClick: React.MouseEventHandler<HTMLButtonElement>;
}

const Timer = () => {
	const [seconds, setSeconds] = useState(0);

	const time = useMemo(() => {
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

		return h !== "00" ? `${h}:${m}:${s}` : `${m}:${s}`;
	}, [seconds]);

	const incrementTime = () => {
		setSeconds((prevSeconds) => prevSeconds + 1);
	};

	useEffect(() => {
		const interval = setInterval(incrementTime, 1000);
		return () => clearInterval(interval);
	}, []);

	return <span className="font-light">{time}</span>;
};

export const CallButtons = ({
	className,
	status,
	callbacks,
	audioMute,
	hasVideo,
	videoMute,
	allowCall,
	isSharingScreen,
}: {
	className: string;
	status: CallStatus;
	callbacks: CallButtonHandlers;
	audioMute: boolean;
	hasVideo: boolean;
	videoMute: boolean;
	allowCall: boolean;
	isSharingScreen: boolean;
}) => {
	const { t } = useTranslation();
	const inCall = CallStatusOps.isActive(status);
	const isIdle = CallStatusOps.isIdle(status);
	const inTransfer = TRANSFER && inCall;
	const callLabel = TRANSFER ? t("transfer") : t("call");
	const [isSettingsOpen, setSettingsOpen] = useState<boolean>(false);
	const [isButtonsVisible, setButtonsVisible] = useState<boolean>(true);
	const hasCallButton = (!MEETING && !CallStatusOps.isTerminated(status)) || inCall;
	const chat = useSnapshot(chatStore);

	const openSettings = () => {
		setSettingsOpen(true);
	};
	const closeSettings = () => {
		setSettingsOpen(false);
		if (!inCall && videoMute) {
			mediaStreams.stop();
		}
	};
	useEffect(() => {
		let hideTimeout: NodeJS.Timeout | null = null;

		const handleMouseMove = () => {
			setButtonsVisible(true);
			console.log("Set buttons visible");
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("touchend", handleTouchEvent);
			if (inCall) {
				hideTimeout = setTimeout(() => hideButtons(), 5000);
				console.log("set hide timeout 5s");
			} else {
				console.log("Not in call, buttons visible");
			}
		};
		const handleTouchEvent = (ev: Event) => {
			ev.preventDefault();
			handleMouseMove();
		};

		const hideButtons = () => {
			setButtonsVisible(false);
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("touchend", handleTouchEvent);
			console.log("set buttons hidden");
			if (hideTimeout) {
				clearTimeout(hideTimeout);
			}
			hideTimeout = null;
		};

		if (isButtonsVisible) {
			handleMouseMove();
		}

		return () => {
			if (hideTimeout) {
				clearTimeout(hideTimeout);
			}
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, [inCall]);

	return (
		<div
			className={clsx(
				"mx-auto flex w-auto items-center justify-between md:rounded-lg bg-zinc-800 md:px-4 md:py-2",
				className,
				inCall && !isButtonsVisible ? "hidden" : "",
			)}
			style={{ display: inCall && !isButtonsVisible ? "none" : "flex" }}
		>
			{hasCallButton && (
				<div>
					<button
						disabled={!allowCall && !inCall}
						className={clsx(
							"flex items-center justify-center rounded-full px-6 py-3 text-white transition ",
							isIdle && !allowCall ? "button-disabled" : "",
							isIdle
								? "bg-blue hover:bg-blue/90 active:bg-blue/80"
								: "bg-red hover:bg-red/90 active:bg-red/80",
						)}
						onClick={isIdle ? callbacks.onCallClick : callbacks.onTerminateClick}
					>
						<span className="mr-3">
							<PhoneCallIcon />
						</span>
						{inCall ? (
							<Timer />
						) : (
							<span className="font-light">{isIdle ? callLabel : t("audio_call_activity_calling")}</span>
						)}
					</button>
				</div>
			)}
			{TRANSFER && inTransfer && (
				<div>
					<button
						className="ml-3 flex items-center justify-center rounded-full bg-blue px-6 py-3 text-white transition hover:bg-blue/90 active:bg-blue/80"
						onClick={callbacks.onTransferClick}
					>
						<span className="mr-3">
							<PhoneCallIcon />
						</span>
						<span className="font-light">{t("transfer")}</span>
					</button>
				</div>
			)}

			<div className="flex items-center justify-end">
				{inCall && (
					<WhiteButton onClick={callbacks.onChatClick} className="relative ml-3 !p-[10px]">
						{chat.unreadMessages > 0 && (
							<span className="absolute right-1 top-1 flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75"></span>
								<span className="relative inline-flex h-2 w-2 rounded-full bg-red"></span>
							</span>
						)}
						<ChatIcon />
					</WhiteButton>
				)}
				{isMobile && hasVideo && (
					<WhiteButton
						onClick={callbacks.onSwitchCameraClick}
						className={clsx("ml-3 !p-[10px]", videoMute ? "btn-white-disabled" : "")}
					>
						<SwitchCamera color="black" />
					</WhiteButton>
				)}
				{
					<WhiteButton onClick={callbacks.onMuteAudioClick} className="ml-3 !p-[10px] ">
						{audioMute ? <MicOff color="black" /> : <Mic color="black" />}
					</WhiteButton>
				}
				{hasVideo && (
					<WhiteButton onClick={callbacks.onMuteVideoClick} className="ml-3 !p-[10px]">
						{videoMute || isSharingScreen ? <VideoOff color="black" /> : <Video color="black" />}
					</WhiteButton>
				)}
				{hasVideo && !isMobile && (
					<WhiteButton onClick={callbacks.onSharingScreenClick} className="ml-3 !p-[10px]">
						{isSharingScreen ? <MonitorOn /> : <MonitorOff />}
					</WhiteButton>
				)}
				{!isMobile && (
					<>
						<WhiteButton onClick={openSettings} className="ml-3 !p-[10px]">
							<Cog6ToothIcon className="m-auto w-[29px] text-black" aria-hidden="true" />
						</WhiteButton>
						<SettingsDialog
							isOpen={isSettingsOpen}
							hasVideo={hasVideo}
							onClose={closeSettings}
							title="test"
						/>
					</>
				)}
			</div>
		</div>
	);
};
