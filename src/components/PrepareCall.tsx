/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import clsx from "clsx";
import { useEffect, useState } from "react";
import { PropsWithChildren, ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ContactService, TwincodeInfo, ScheduleState, ScheduleStatus } from "../services/ContactService";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import { CallButtons, CallButtonHandlers } from "../components/CallButtons";
import InitializationPanel from "./InitializationPanel";
import { ParticipantAvatar } from "./ParticipantAvatar";

const TRANSFER = import.meta.env.VITE_APP_TRANSFER === "true";

interface PrepareCallProps extends PropsWithChildren {
	initializing: boolean;
	className?: string;
	title: string;
	twincodeId: string;
	twincode: TwincodeInfo;
	status: CallStatus;
	audioMute: boolean;
	videoMute: boolean;
	isSharingScreen: boolean;
	buttons?: ReactNode;
	children?: ReactNode;
	callbacks: CallButtonHandlers;
	onGetTwincode: (twincode: TwincodeInfo) => void;
}

const PrepareCall: React.FC<PrepareCallProps> = ({
	initializing,
	className,
	twincodeId,
	twincode,
	status,
	audioMute,
	videoMute,
	isSharingScreen,
	callbacks,
	onGetTwincode,
	buttons,
	children,
}) => {
	const { t } = useTranslation();
	const avatarUrl = twincode.avatarId != null ? import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId : null;
	const isWaiting = CallStatusOps.isOutgoing(status);
	const [state, setState] = useState<ScheduleState | null>(null);

	useEffect(() => {
		let retryTimeout: NodeJS.Timeout | null = null;
		const refreshState = () => {
			const scheduleState: ScheduleState = ContactService.isCurrentDateInRange(twincode.schedule);

			setState(scheduleState);
			if (retryTimeout) {
				clearTimeout(retryTimeout);
				retryTimeout = null;
			}
			if (scheduleState.delay > 0) {
				retryTimeout = setTimeout(() => refreshState(), 10000);
			}
		};
		refreshState();

		return () => {
			if (retryTimeout) {
				clearInterval(retryTimeout);
			}
		};
	}, [twincode]);

	const checkTwincode = (twincode: TwincodeInfo): string | null => {
		if (!twincode.name) {
			return t("twincode_error");
		}
		if (TRANSFER) {
			if (!twincode.transfer) {
				return t("twincode_invalid_for_transfer");
			}
		} else {
			if (twincode.conference) {
				return t("twincode_invalid");
			}
		}
		onGetTwincode(twincode);
		return null;
	};
	const allowCall: boolean =
		twincode.audio == true &&
		(state == null || (state.status === ScheduleStatus.WITHIN_SCHEDULE && state.delay == 0));
	return (
		<div className={className}>
			<div className="flex items-center rounded-lg bg-black/70 py-1 transition">
				{initializing && (
					<InitializationPanel twincodeId={twincodeId} twincode={twincode} onComplete={checkTwincode} />
				)}
				{!TRANSFER && (
					<div className="w-full rounded-lg text-sm bg-black/70 md:px-2 md:py-1 transition">
						{!isWaiting && twincode.schedule && (
							<Trans
								i18nKey={ContactService.getSchedule(twincode?.schedule)}
								values={{
									contactName: twincode?.name,
									...ContactService.getScheduleLabels(twincode.schedule),
								}}
								t={t}
							/>
						)}
					</div>
				)}
			</div>
			<div className="grid flex flex-1 gap-4 grid-rows-1 md:grid-cols-2 landscape:grid-cols-2 overflow-hidden">
					<div className="flex relative h-full w-full flex items-center justify-center rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
						<ParticipantAvatar name={twincode.name} avatarUrl={avatarUrl} isSpeaking={false} />
						<div
							className={clsx(
								"absolute bottom-2 right-2 z-20 rounded-lg bg-black/70 px-2 py-1 text-sm border-4",
								twincode.name == null && "hidden",
							)}
						>
							{twincode.name}
						</div>
					</div>
				{children}
			</div>
			<div className="flex items-center rounded-lg border-2 border-solid border-transparent bg-black/70 py-1 transition">
				<CallButtons
					className=""
					status={status}
					callbacks={callbacks}
					audioMute={audioMute}
					hasVideo={twincode.video}
					videoMute={videoMute}
					allowCall={allowCall}
					isSharingScreen={isSharingScreen}
				/>
				{buttons}
			</div>
		</div>
	);
};

export default PrepareCall;
