import { RefObject, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CallParticipant } from "../calls/CallParticipant";
import { TwincodeInfo } from "../services/ContactService";
import ParticipantGridCell from "./ParticipantGridCell";

const ParticipantsGrid: React.FC<{
	localVideoRef: RefObject<HTMLVideoElement>;
	localMediaStream: MediaStream;
	videoMute: boolean;
	twincode: TwincodeInfo;
	participants: CallParticipant[];
	isIddle: boolean;
	guestName: string;
	guestNameError: boolean;
	setGuestName: (value: string) => void;
	muteVideoClick: (ev: React.MouseEvent<HTMLDivElement>) => void;
}> = ({
	localVideoRef,
	localMediaStream,
	videoMute,
	twincode,
	participants,
	isIddle,
	guestName,
	guestNameError,
	setGuestName,
	muteVideoClick,
}) => {
	const { t } = useTranslation();

	let gridClass = "";
	if (participants.length < 2) {
		gridClass = [
			isIddle ? "grid-cols-1 grid-rows-2" : "grid-cols-1 grid-rows-1",
			"md:grid-cols-2 md:grid-rows-1",
		].join(" ");
	} else if (participants.length < 5) {
		gridClass = "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-2";
	} else if (participants.length < 5) {
		gridClass = "grid-cols-2 grid-rows-2";
	} else if (participants.length < 7) {
		gridClass = "grid-cols-3 grid-rows-2";
	} else if (participants.length < 10) {
		gridClass = "grid-cols-3 grid-rows-3";
	}

	useEffect(() => {
		if (localVideoRef.current) {
			localVideoRef.current.srcObject = localMediaStream;
		} else {
			console.log("There is no local video element");
		}
	}, [localMediaStream]);

	return (
		<div className={["grid flex-1 gap-4 overflow-hidden py-4", gridClass].join(" ")}>
			{participants.map((participant) => (
				<ParticipantGridCell
					key={participant.getParticipantId()}
					setRemoteRenderer={(ref) => participant.setRemoteRenderer(ref)}
					isAudioMute={participant.isAudioMute()}
					isCameraMute={participant.isCameraMute()}
					name={participant.getName() ?? ""}
					participantId={participant.getParticipantId()}
					avatarUrl={participant.getAvatarUrl() ?? ""}
				/>
			))}
			{participants.length === 0 && (
				<ParticipantGridCell
					isAudioMute={false}
					isCameraMute={true}
					name={twincode.name ?? ""}
					avatarUrl={`${import.meta.env.VITE_REST_URL}/images/${twincode.avatarId}`}
				/>
			)}
			<div
				className={[
					isIddle
						? "relative"
						: "absolute right-7 top-16 z-10 h-36 w-24 ring-2 ring-black md:relative md:right-auto md:top-auto md:h-auto md:w-auto",
					"overflow-hidden rounded-md",
				].join(" ")}
			>
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
							"flex h-20 w-20 items-center justify-center rounded-full bg-[#2f2f2f] text-5xl ring-slate-600 transition duration-200 ease-in-out md:h-28 md:w-28",
							videoMute ? "" : "hidden",
							twincode.video ? "cursor-pointer hover:ring" : "",
						].join(" ")}
						onClick={(e) => {
							if (twincode.video) {
								muteVideoClick(e);
							}
						}}
					>
						{twincode.video ? (
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
						) : (
							<div className="flex h-full w-full items-center justify-center">
								<img
									src={"/logo/" + import.meta.env.VITE_APP_LOGO_BIG}
									alt=""
									className="w-[70px] md:w-[80px]"
								/>
							</div>
						)}
					</div>
					{twincode.video && (
						<span className={[isIddle ? "" : "hidden md:block", "mt-2 text-sm md:text-base"].join(" ")}>
							{t("activate_camera")}
						</span>
					)}
				</div>
				<div className={["absolute bottom-2 right-2 text-sm"].join(" ")}>
					{isIddle && (
						<>
							{guestNameError && (
								<div className="animate-skaheX py-1 text-orange-600">{t("nickname_empty_error")}</div>
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

export default ParticipantsGrid;
