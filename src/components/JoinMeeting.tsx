/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect, useState } from "react";
import { MouseEventHandler, PropsWithChildren, ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ContactService, TwincodeInfo, ScheduleState, ScheduleStatus } from "../services/ContactService";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import { useSnapshot } from "valtio";
import { profile } from "../stores/profile";
import InitializationPanel from "./InitializationPanel";

interface JoinMeetingProps extends PropsWithChildren {
	initializing: boolean;
	className?: string;
	title: string;
	twincodeId: string;
	twincode: TwincodeInfo;
	status: CallStatus;
	buttons?: ReactNode;
	children?: ReactNode;
	onStartClick: MouseEventHandler<HTMLButtonElement>;
	onCancelClick: MouseEventHandler<HTMLButtonElement>;
	onGetTwincode: (twincode: TwincodeInfo) => void;
}

const JoinMeeting: React.FC<JoinMeetingProps> = ({
	initializing,
	className,
	twincodeId,
	twincode,
	status,
	onStartClick,
	onCancelClick,
	onGetTwincode,
	buttons,
	children,
}) => {
	const { t } = useTranslation();
	const avatarUrl = twincode.avatarId != null ? import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId : null;
	const isWaiting = CallStatusOps.isOutgoing(status);
	const user = useSnapshot(profile);
	const [state, setState] = useState<ScheduleState | null>(null);
	const canCall = state != null && state.status != ScheduleStatus.OUTSIDE_SCHEDULE;

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
		if (!twincode.conference) {
			return t("twincode_invalid");
		}
		onGetTwincode(twincode);
		return null;
	};
	return (
		<div className={className}>
			<div className="flex items-center justify-between h-screen">
				<div className="w-full">
					<div className="border border-red-500 text-center">
						{initializing && (
							<InitializationPanel
								twincodeId={twincodeId}
								twincode={twincode}
								onComplete={checkTwincode}
							/>
						)}
						<div className="h-20 rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
							{isWaiting && (
								<>
									<span className="">{t("wait_meeting_message")}</span>
								</>
							)}
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
						{avatarUrl && (
							<>
								<div className="rounded-lg w-full justify-center border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
									<img
										src={avatarUrl}
										alt=""
										className="m-auto pointer-events-none z-10 object-cover h-20 w-20 rounded-full shadow-lg landscape:lg:w-48 landscape:lg:h-48"
									/>
								</div>
							</>
						)}
						<span className="font-bold">{twincode.name}</span>

						<div className="rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 pt-8 transition">
							<input
								type="text"
								id="name"
								value={user.name}
								className=" bg-transparent border rounded px-3 py-2 focus:outline-none text-center focus:ring-2"
								placeholder="Entrez un pseudo"
								onChange={(e) => (profile.name = e.target.value)}
							/>
						</div>
						<div className="rounded-lg border-2 border-solid h-20 border-transparent bg-black/70 px-2 py-1 transition">
							{!isWaiting && !initializing && profile.name && profile.name.length > 0 && canCall && (
								<button
									className={
										"flex w-full items-center justify-center px-6 py-3 text-white transition rounded-lg bg-blue hover:bg-blue/90 active:bg-blue/80"
									}
									onClick={onStartClick}
								>
									<span className="mr-3">{t("join_meeting_button")}</span>
								</button>
							)}
							{isWaiting && (
								<button
									className={
										"flex w-full items-center justify-center px-6 py-3 text-white transition rounded-lg bg-red hover:bg-red/90 active:bg-red/80"
									}
									onClick={onCancelClick}
								>
									<span className="mr-3">{t("leave_meeting_button")}</span>
								</button>
							)}
							{!isWaiting && state && state.delay > 0 && (
								<>
									<span className={state.delay <= 60000 ? "blink" : ""}>
										<Trans
											i18nKey="call_start_in_minutes"
											values={{
												delay: Math.round(state.delay / 60000),
											}}
											t={t}
										/>
									</span>
								</>
							)}
						</div>
						<div className="rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
							{buttons}
						</div>
					</div>
				</div>
			</div>
			<div className="flex h-full w-full relative"> {children} </div>
		</div>
	);
};

export default JoinMeeting;
