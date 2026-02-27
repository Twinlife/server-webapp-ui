/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { DefaultAvatar } from "./DefaultAvatar";
import { CallParticipant } from "../calls/CallParticipant";

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

interface ParticipantGridCellProps {
	cellClassName: string;
	participant: CallParticipant;
	avatarUrl: string;
	videoClick: (ev: React.MouseEvent<HTMLDivElement>, participantId: number | undefined) => void;
}

const ParticipantGridCell: React.FC<ParticipantGridCellProps> = ({
	cellClassName,
	participant,
	avatarUrl,
	videoClick,
}) => {
	const participantId = participant.getParticipantId();
	const refVideo = useRef<HTMLVideoElement>(null);
	const refAudio = useRef<HTMLAudioElement>(null);
	const isCameraMute = participant.isCameraMute();
	const isScreenSharing = participant.isScreenSharing();
	const noVideo = isCameraMute || isScreenSharing;
	const name = participant.getName();
	const isSpeaking = participant.isSpeaking();

	if (DEBUG) {
		console.log("Refresh", participant.getParticipantId(), "name", participant.getName());
	}
	useEffect(() => {
		if (refVideo.current) participant.setRemoteRenderer(refVideo.current, refAudio.current);
		if (DEBUG) {
			console.log("set video participant", participant);
		}
	}, [isScreenSharing, refVideo, refAudio, isCameraMute]);

	return (
		<div
			className={clsx(
				"relative flex w-full items-center justify-center border-2 border-solid overflow-hidden rounded-lg bg-[#202020]",
				cellClassName,
				!isSpeaking && "border-transparent",
				isSpeaking && "border-solid border-blue",
			)}
			onClick={(e) => {
				videoClick(e, participantId);
			}}
		>
			{participant.isAudioMute() && (
				<div className="absolute left-2 top-2 z-20 text-2xl md:left-auto md:right-2">
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
			{!avatarUrl && noVideo && (
				<DefaultAvatar
					name={name ? name : "?"}
					className={clsx("md:h-24 md:w-24 border-4", isSpeaking && "border-blue border-solid")}
				/>
			)}

			{avatarUrl && noVideo && (
				<>
					<img
						src={avatarUrl}
						alt=""
						className="pointer-events-none z-10 object-cover h-24 w-24 rounded-full shadow-lg landscape:lg:w-48 landscape:lg:h-48"
					/>
					<img
						src={avatarUrl}
						alt=""
						className="pointer-events-none absolute left-0 top-0 h-full w-full object-cover blur block"
					/>
				</>
			)}

			<video
				ref={refVideo}
				autoPlay={true}
				playsInline={true}
				id={"videoElement-" + participantId}
				className={clsx("h-full object-cover", noVideo && "hidden")}
			></video>
			<audio ref={refAudio} autoPlay={true} playsInline={true} id={"audioElement-" + participantId}></audio>
			<div
				className={clsx(
					"absolute bottom-2 right-2 z-20 rounded-lg bg-black/70 px-2 py-1 text-sm border-4 border-solid",
					name == null && "hidden",
					!isSpeaking && "border-transparent",
					isSpeaking && "fast-blink border-transparent",
				)}
			>
				{name}
			</div>
		</div>
	);
};

export default ParticipantGridCell;
