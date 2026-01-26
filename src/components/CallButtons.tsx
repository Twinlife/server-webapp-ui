/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */

import { Mic, MicOff, SwitchCamera, Video, VideoOff } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PhoneCallIcon from "../assets/phone-call.svg";
import MonitorOff from "../assets/monitor-off.svg";
import MonitorOn from "../assets/monitor.svg";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import SelectDevicesButton from "../components/SelectDevicesButton";
import WhiteButton from "../components/WhiteButton";
import IsMobile from "../utils/IsMobile";

const isMobile = IsMobile();

export interface CallButtonHandlers {
	onCallClick: React.MouseEventHandler<HTMLButtonElement>;
	onTerminateClick: React.MouseEventHandler<HTMLButtonElement>;
	onTransferClick: React.MouseEventHandler<HTMLButtonElement>;

	onMuteAudioClick: React.MouseEventHandler<HTMLButtonElement>;
	onMuteVideoClick: React.MouseEventHandler<HTMLButtonElement>;
	onSharingScreenClick: React.MouseEventHandler<HTMLButtonElement>;
	onSwitchCameraClick: React.MouseEventHandler<HTMLButtonElement>;
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
	status,
	callbacks,
	audioMute,
	hasVideo,
	videoMute,
	audioDevices,
	videoDevices,
	usedAudioDevice,
	usedVideoDevice,
	isSharingScreen,
	selectAudioDevice,
	selectVideoDevice,
	transfer,
	hasCallButton,
}: {
	status: CallStatus;
	callbacks: CallButtonHandlers;
	audioMute: boolean;
	hasVideo: boolean;
	videoMute: boolean;
	audioDevices: MediaDeviceInfo[];
	videoDevices: MediaDeviceInfo[];
	usedAudioDevice: string;
	usedVideoDevice: string;
	isSharingScreen: boolean;
	selectAudioDevice: (deviceId: string) => void;
	selectVideoDevice: (deviceId: string) => void;
	transfer: boolean;
	hasCallButton: boolean;
}) => {
	const { t } = useTranslation();
	const inCall = CallStatusOps.isActive(status);
	const isIdle = CallStatusOps.isIdle(status);
	const inTransfer = transfer && inCall;
	const callLabel = transfer ? t("transfer") : t("call");

	return (
		<div className="mx-auto flex w-auto items-center justify-between md:rounded-lg md:bg-zinc-800 md:px-4 md:py-2">
			{hasCallButton && (
				<div>
					<button
						className={[
							"flex items-center justify-center rounded-full px-6 py-3 text-white transition ",
							isIdle
								? "bg-blue hover:bg-blue/90 active:bg-blue/80"
								: "bg-red hover:bg-red/90 active:bg-red/80",
						].join(" ")}
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
			{inTransfer && (
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
				{isMobile && hasVideo && (
					<WhiteButton
						onClick={callbacks.onSwitchCameraClick}
						className={["ml-3 !p-[10px]", videoMute ? "btn-white-disabled" : ""].join(" ")}
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
					<SelectDevicesButton
						audioDevices={audioDevices}
						videoDevices={videoDevices}
						usedAudioDevice={usedAudioDevice}
						usedVideoDevice={usedVideoDevice}
						selectAudioDevice={selectAudioDevice}
						selectVideoDevice={selectVideoDevice}
					/>
				)}
				{hasCallButton && (
					<div>
						<button
							className={
								"flex items-center justify-center rounded-full ml-3 !p-[10px] px-3 py-2 text-white transition bg-red hover:bg-red/90 active:bg-red/80"
							}
							onClick={callbacks.onTerminateClick}
						>
							<span className="mr-1">
								<PhoneCallIcon />
							</span>
						</button>
					</div>
				)}
			</div>
		</div>
	);
};
