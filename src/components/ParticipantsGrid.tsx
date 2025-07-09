/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { RefObject } from "react";
import { CallParticipant } from "../calls/CallParticipant";
import { CallService } from "../calls/CallService";
import { Item } from "../pages/Call";
import { TwincodeInfo } from "../services/ContactService";
import GuestNameForms from "./GuestNameForms";
import ParticipantGridCell from "./ParticipantGridCell";
import ChatBox from "./chatbox/ChatBox";
import { DraggableParticipant } from "./DraggableParticipant";

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

export type DisplayMode = {
	defaultMode: boolean;
	showParticipant: boolean;
	showLocalThumbnail: boolean;
	participantId: number | null;
};

export const ParticipantsGrid: React.FC<{
	chatPanelOpened: boolean;
	closeChatPanel: () => void;
	localVideoRef: RefObject<HTMLVideoElement>;
	localMediaStream: MediaStream;
	videoMute: boolean;
	isLocalAudioMute: boolean;
	twincode: TwincodeInfo;
	participants: CallParticipant[];
	isIdle: boolean;
	guestName: string;
	guestNameError: boolean;
	items: Item[];
	setGuestName: (value: string) => void;
	updateGuestName: (value: string) => void;
	mode: DisplayMode;
	muteVideoClick: (ev: React.MouseEvent<HTMLDivElement>) => void;
	videoClick: (ev: React.MouseEvent<HTMLDivElement>, participantId: number | undefined) => void;
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
	isIdle,
	guestName,
	guestNameError,
	items,
	setGuestName,
	updateGuestName,
	mode,
	muteVideoClick,
	videoClick,
	pushMessage,
}) => {
	const localAbsolute = mode.showLocalThumbnail && !mode.showParticipant;
	const nbParticipants = participants.length === 0 ? 2 : participants.length + (localAbsolute ? 0 : 1);
	const divClass = mode.showParticipant
		? "relative grid flex-1 gap-4 overflow-hidden py-4 transition-all"
		: "relative grid flex-1 gap-4 overflow-hidden py-4 landscape:py-2 lg:py-4 transition-all";
	if (DEBUG) {
		console.log("Local absolute=" + localAbsolute + " nbParticipants=" + nbParticipants);
	}
	return (
		<div
			className={[
				divClass,
				chatPanelOpened ? "pb-[300px] md:pb-4 md:pr-[316px]" : "pb-4 pr-0",
				getGridClass(mode, nbParticipants),
			].join(" ")}
		>
			{participants.map((participant) => (
				<ParticipantGridCell
					key={participant.getParticipantId()}
					cellClassName={getCellClass(participant.getParticipantId(), mode, participants.length + 1)}
					setRemoteRenderer={(ref) => participant.setRemoteRenderer(ref)}
					isAudioMute={participant.isAudioMute()}
					isCameraMute={participant.isCameraMute()}
					name={participant.getName() ?? ""}
					participantId={participant.getParticipantId()}
					videoClick={videoClick}
					avatarUrl={participant.getAvatarUrl() ?? ""}
				/>
			))}

			{/* Display Contact before call (participants.length === 0) */}
			{participants.length === 0 && (
				<ParticipantGridCell
					cellClassName={getCellClass(0, mode, nbParticipants)}
					isAudioMute={false}
					isCameraMute={true}
					name={twincode.name ?? ""}
					videoClick={videoClick}
					avatarUrl={`${import.meta.env.VITE_REST_URL}/images/${twincode.avatarId}`}
				/>
			)}
			<DraggableParticipant
				className={getCellClass(0, mode, nbParticipants)}
				localVideoRef={localVideoRef}
				localMediaStream={localMediaStream}
				localAbsolute={localAbsolute}
				videoMute={videoMute}
				isLocalAudioMute={isLocalAudioMute}
				isIdle={isIdle}
				enableVideo={twincode.video}
				guestName={guestName}
				guestNameError={guestNameError}
				setGuestName={setGuestName}
				updateGuestName={updateGuestName}
				muteVideoClick={muteVideoClick}
				videoClick={videoClick}
			></DraggableParticipant>

			{localAbsolute && (
				<div
					className={[
						isIdle ? "relative" : "relative ring-2 ring-black",
						"overflow-hidden rounded-md",
						getCellClass(0, mode, participants.length + 1),
					].join(" ")}
				>
					<div className={["relative bottom-2 right-2 text-sm"].join(" ")}>
						<GuestNameForms
							update={!isIdle}
							guestName={guestName}
							guestNameError={guestNameError}
							setGuestName={setGuestName}
							updateGuestName={updateGuestName}
						/>
					</div>
				</div>
			)}
			<ChatBox
				chatPanelOpened={chatPanelOpened}
				closeChatPanel={closeChatPanel}
				pushMessage={pushMessage}
				items={items}
			/>
		</div>
	);
};

function getGridClass(mode: DisplayMode, participantsAmount: number) {
	if (mode.showParticipant) {
		return "grid-cols-1 grid-rows-1 md:grid-cols-1 md:grid-rows-1 landscape:grid-cols-1 landscape:grid-rows-1";
	}
	switch (participantsAmount) {
		case 0:
		case 1:
			return "grid-cols-1 grid-rows-1 md:grid-cols-1 md:grid-rows-1 landscape:grid-cols-1 landscape:grid-rows-1";
		case 2:
			return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1 landscape:grid-cols-2 landscape:grid-rows-1";
		case 3:
			return "grid-cols-2 grid-rows-2 md:grid-cols-3 md:grid-rows-1 landscape:grid-cols-3 landscape:grid-rows-1";
		case 4:
			return "grid-cols-2 grid-rows-2 md:grid-cols-4 md:grid-rows-1 landscape:grid-cols-4 landscape:grid-rows-1";
		case 5:
			return "grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2 landscape:grid-cols-3 landscape:grid-rows-2";
		case 6:
			return "grid-cols-2 md:grid-cols-3 landscape:grid-cols-3";
		case 7:
			return "grid-cols-2 grid-rows-4 md:grid-cols-4 md:grid-rows-2 landscape:grid-cols-4 landscape:grid-rows-2";
		case 8:
			return "grid-cols-2 grid-rows-4 md:grid-cols-4 md:grid-rows-2 landscape:grid-cols-4 landscape:grid-rows-2";

		default:
			return "";
	}
}

function getCellClass(participantId: number, mode: DisplayMode, participantsAmount: number) {
	if (mode.showParticipant) {
		return mode.participantId === participantId ? "" : "hidden";
	}
	switch (participantsAmount) {
		case 1:
		case 2:
			return "";
		case 3:
			return "first:col-span-2 md:first:col-span-1 landscape:first:col-span-1";
		case 4:
			return "";
		case 5:
			return "portrait:first:col-span-2 landscape:first:row-span-2";
		case 6:
			return "";
		case 7:
			return "first:row-span-2 md:first:col-span-1 md:first:row-span-2 landscape:first:col-span-1 landscape:first-row-span-2";
		case 8:
			return "";

		default:
			return "";
	}
}
