import { RefObject, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CallParticipant } from "../calls/CallParticipant";
import { CallService } from "../calls/CallService";
import { Item } from "../pages/Call";
import { TwincodeInfo } from "../services/ContactService";
import GuestNameForms from "./GuestNameForms";
import ParticipantGridCell from "./ParticipantGridCell";
import ChatBox from "./chatbox/ChatBox";

const ParticipantsGrid: React.FC<{
	chatPanelOpened: boolean;
	closeChatPanel: () => void;
	localVideoRef: RefObject<HTMLVideoElement>;
	localMediaStream: MediaStream;
	videoMute: boolean;
	isLocalAudioMute: boolean;
	twincode: TwincodeInfo;
	participants: CallParticipant[];
	isIddle: boolean;
	guestName: string;
	guestNameError: boolean;
	items: Item[];
	setGuestName: (value: string) => void;
	updateGuestName: (value: string) => void;
	muteVideoClick: (ev: React.MouseEvent<HTMLDivElement>) => void;
	pushMessage: typeof CallService.prototype.pushMessage;
}> = ({
	chatPanelOpened,
	closeChatPanel,
	localVideoRef,
	localMediaStream,
	videoMute,
	isLocalAudioMute,
	twincode,
	participants,
	isIddle,
	guestName,
	guestNameError,
	items,
	setGuestName,
	updateGuestName,
	muteVideoClick,
	pushMessage,
}) => {
	const { t } = useTranslation();

	useEffect(() => {
		if (localVideoRef.current) {
			localVideoRef.current.srcObject = localMediaStream;
		} else {
			console.log("There is no local video element");
		}
	}, [localMediaStream, localVideoRef]);

	return (
		// getGridClass(participants.length + 1) because current web user is not part of participants
		<div
			className={[
				"relative grid flex-1 gap-4 overflow-hidden py-4 transition-all",
				chatPanelOpened ? "pb-[300px] md:pb-4 md:pr-[316px]" : "pb-4 pr-0",
				getGridClass(participants.length + 1),
			].join(" ")}
		>
			{/* Display InCall participants */}
			{participants.map((participant) => (
				<ParticipantGridCell
					key={participant.getParticipantId()}
					cellClassName={getCellClass(participants.length + 1)}
					setRemoteRenderer={(ref) => participant.setRemoteRenderer(ref)}
					isAudioMute={participant.isAudioMute()}
					isCameraMute={participant.isCameraMute()}
					name={participant.getName() ?? ""}
					participantId={participant.getParticipantId()}
					avatarUrl={participant.getAvatarUrl() ?? ""}
				/>
			))}

			{/* Display Contact before call (participants.length === 0) */}
			{participants.length === 0 && (
				<ParticipantGridCell
					cellClassName={getCellClass(participants.length + 1)}
					isAudioMute={false}
					isCameraMute={true}
					name={twincode.name ?? ""}
					avatarUrl={`${import.meta.env.VITE_REST_URL}/images/${twincode.avatarId}`}
				/>
			)}

			<div
				className={[
					isIddle ? "relative" : "relative ring-2 ring-black",
					"overflow-hidden rounded-md",
					getCellClass(participants.length + 1),
				].join(" ")}
			>
				{isLocalAudioMute && (
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

				<video
					ref={localVideoRef}
					className={["h-full w-full object-cover", videoMute ? "hidden" : ""].join(" ")}
					autoPlay={true}
					playsInline={true}
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
					<GuestNameForms
						update={!isIddle}
						guestName={guestName}
						guestNameError={guestNameError}
						setGuestName={setGuestName}
						updateGuestName={updateGuestName}
					/>
				</div>
			</div>

			<ChatBox
				chatPanelOpened={chatPanelOpened}
				closeChatPanel={closeChatPanel}
				pushMessage={pushMessage}
				items={items}
			/>
		</div>
	);
};

export default ParticipantsGrid;

function getGridClass(participantsAmount: number) {
	switch (participantsAmount) {
		case 0:
		case 1:
		case 2:
			return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
		case 3:
			return "grid-cols-2 grid-rows-2 md:grid-cols-3 md:grid-rows-1";
		case 4:
			return "grid-cols-2 grid-rows-2 md:grid-cols-4 md:grid-rows-1";
		case 5:
			return "grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2";
		case 6:
			return "grid-cols-2 md:grid-cols-3";
		case 7:
			return "grid-cols-2 grid-rows-4 md:grid-cols-4 md:grid-rows-2";
		case 8:
			return "grid-cols-2 grid-rows-4 md:grid-cols-4 md:grid-rows-2";

		default:
			return "";
	}
}

function getCellClass(participantsAmount: number) {
	switch (participantsAmount) {
		case 1:
		case 2:
			return "";
		case 3:
			return "first:col-span-2 md:first:col-span-1";
		case 4:
			return "";
		case 5:
			return "first:row-span-2";
		case 6:
			return "";
		case 7:
			return "first:row-span-2 md:first:col-span-1 md:first:row-span-2 ";
		case 8:
			return "";

		default:
			return "";
	}
}
