/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { MouseEventHandler, PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TwincodeInfo } from "../services/ContactService";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";

interface JoinMeetingProps extends PropsWithChildren {
	className?: string;
	title: string;
	twincode: TwincodeInfo;
	status: CallStatus;
	guestName: string;
	buttons?: ReactNode;
	children?: ReactNode;
	onStartClick: MouseEventHandler<HTMLButtonElement>;
	onCancelClick: MouseEventHandler<HTMLButtonElement>;
	setGuestName: (newGuestName: string) => void;
}

const JoinMeeting: React.FC<JoinMeetingProps> = ({
	className,
	twincode,
	status,
	guestName,
	onStartClick,
	onCancelClick,
	buttons,
	children,
	setGuestName,
}) => {
	const { t } = useTranslation();
	const avatarUrl = import.meta.env.VITE_REST_URL + "/images/" + twincode.avatarId;
	const isWaiting = CallStatusOps.isOutgoing(status);
	return (
		<div className={className}>
			<div className="flex items-center justify-between h-screen">
				<div className="w-full">
					<div className="border border-red-500 text-center">
						{isWaiting && (
							<>
								<span className="">{t("wait_meeting_message")}</span>
							</>
						)}
						{avatarUrl && (
							<>
								<div className="rounded-lg w-full justify-center border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
									<img
										src={avatarUrl}
										alt=""
										className="m-auto pointer-events-none z-10 object-cover h-24 w-24 rounded-full shadow-lg landscape:lg:w-48 landscape:lg:h-48"
									/>
								</div>
							</>
						)}

						<span className="font-bold">{twincode.name}</span>
						<div className="rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
							<input
								type="text"
								id="name"
								value={guestName}
								className=" bg-transparent border rounded px-3 py-2 focus:outline-none focus:ring-2"
								placeholder="Entrez un pseudo"
								onChange={(e) => setGuestName(e.target.value)}
							/>
						</div>
						{!isWaiting && (
							<div className="rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
								<button
									className={
										"flex w-full items-center justify-center px-6 py-3 text-white transition rounded-lg bg-blue hover:bg-blue/90 active:bg-blue/80"
									}
									onClick={onStartClick}
								>
									<span className="mr-3">{t("join_meeting_button")}</span>
								</button>
							</div>
						)}
						{isWaiting && (
							<div className="rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
								<button
									className={
										"flex w-full items-center justify-center px-6 py-3 text-white transition rounded-lg bg-red hover:bg-red/90 active:bg-red/80"
									}
									onClick={onCancelClick}
								>
									<span className="mr-3">{t("leave_meeting_button")}</span>
								</button>
							</div>
						)}
						<div className="rounded-lg border-2 border-solid border-transparent bg-black/70 px-2 py-1 transition">
							{buttons}
						</div>
					</div>
				</div>
			</div>
			<div className="flex h-full w-full col-span-3"> {children} </div>
		</div>
	);
};

export default JoinMeeting;
