/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { RefObject } from "react";
import { CallParticipant } from "../calls/CallParticipant";
import { CallService } from "../calls/CallService";
import { Item } from "../pages/Call";
import { TwincodeInfo } from "../services/ContactService";
import GuestNameForms from "./GuestNameForms";
import { ViewMode } from "../utils/DisplayMode";
import { ParticipantGridCell } from "./ParticipantGridCell";
import ParticipantScreen from "./ParticipantScreen";
import ChatBox from "./chatbox/ChatBox";
import { DraggableParticipant } from "./DraggableParticipant";
import { chatStore } from "../stores/chat";
import { useSnapshot } from "valtio";
import { isMobile } from "../utils/BrowserCapabilities";

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

export type DisplayMode = {
	mode: ViewMode;
	participantId: number | null;
};

export const ParticipantsGrid: React.FC<{
	localVideoRef: RefObject<HTMLVideoElement | null>;
	videoMute: boolean;
	isSharingScreen: boolean;
	isLocalAudioMute: boolean;
	twincode: TwincodeInfo;
	participants: CallParticipant[];
	isIdle: boolean;
	guestNameError: boolean;
	items: Item[];
	mode: DisplayMode;
	muteVideoClick: (ev: React.MouseEvent<HTMLElement>) => void;
	videoClick: (ev: React.MouseEvent<HTMLDivElement>, participantId: number | undefined) => void;
	pushMessage: typeof CallService.prototype.pushMessage;
}> = ({
	localVideoRef,
	videoMute,
	isSharingScreen,
	isLocalAudioMute,
	twincode,
	participants,
	isIdle,
	guestNameError,
	items,
	mode,
	muteVideoClick,
	videoClick,
	pushMessage,
}) => {
	const chat = useSnapshot(chatStore);
	const localAbsolute = mode.mode == ViewMode.VIEW_DEFAULT && participants.length <= 1;
	const nbParticipants = participants.length === 0 ? 2 : participants.length + (localAbsolute ? 0 : 1);
	const screens: Array<CallParticipant> = participants.filter((participant) => participant.isScreenSharing());
	const screenParticipantId: number | null = isSharingScreen
		? 0
		: screens.length > 0
			? screens[0].getParticipantId()
			: null;
	const displayMode: DisplayMode = {
		...mode,
		mode: screenParticipantId != null ? ViewMode.VIEW_SHARE_SCREEN : mode.mode,
	};
	const showName: boolean = !isMobile || participants.length < 12;
	const divClass =
		displayMode.mode == ViewMode.VIEW_FOCUS_PARTICIPANT || displayMode.mode == ViewMode.VIEW_FOCUS_CAMERA
			? "relative grid flex-1 gap-4 overflow-hidden md:py-4 transition-all"
			: "relative grid flex-1 grid-auto-rows-fr gap-4 overflow-hidden md:py-4 landscape:py-2 lg:py-4 transition-all";
	if (DEBUG) {
		console.log(
			"Display grid",
			nbParticipants,
			"participants absolute: ",
			localAbsolute,
			"mode",
			mode,
			"screenParticipant",
			screenParticipantId,
		);
	}

	return (
		<div className="flex flex-row w-full h-full p-1">
			{screenParticipantId != null && (
				<ParticipantScreen
					key={screenParticipantId}
					participant={screens.length > 0 ? screens[0] : null}
					videoClick={videoClick}
				/>
			)}
			<div
				className={[
					divClass,
					chat.chatPanelOpened ? "pb-[300px] md:pb-4 md:pr-[316px]" : "pb-4 pr-0",
					getGridClass(displayMode, nbParticipants),
				].join(" ")}
			>
				{participants.map((participant) => (
					<ParticipantGridCell
						key={participant.getParticipantId()}
						mode={displayMode.mode}
						cellClassName={getCellClass(
							participant.getParticipantId(),
							displayMode,
							participants.length + 1,
						)}
						participant={participant}
						videoClick={videoClick}
						showName={showName}
						avatarUrl={participant.getAvatarUrl() ?? ""}
					/>
				))}
				{twincode.video && (
					<DraggableParticipant
						className={getCellClass(0, displayMode, nbParticipants)}
						localVideoRef={localVideoRef}
						localAbsolute={localAbsolute && !screenParticipantId}
						videoMute={videoMute}
						isSharingScreen={isSharingScreen}
						isLocalAudioMute={isLocalAudioMute}
						isIdle={isIdle}
						enableVideo={twincode.video}
						guestNameError={guestNameError}
						muteVideoClick={muteVideoClick}
						videoClick={videoClick}
					></DraggableParticipant>
				)}

				{localAbsolute && isMobile && (
					<div
						className={[
							isIdle ? "relative" : "relative ring-2 ring-black",
							"overflow-hidden rounded-md",
							getCellClass(0, displayMode, participants.length + 1),
						].join(" ")}
					>
						<div className={["relative bottom-2 right-2 text-sm"].join(" ")}>
							<GuestNameForms update={!isIdle} guestNameError={guestNameError} />
						</div>
					</div>
				)}
				<ChatBox pushMessage={pushMessage} items={items} />
			</div>
		</div>
	);
};

function getGridClass(mode: DisplayMode, participantsAmount: number) {
	if (mode.mode == ViewMode.VIEW_FOCUS_PARTICIPANT || mode.mode == ViewMode.VIEW_FOCUS_CAMERA) {
		return "h-full grid-cols-1 grid-rows-1 md:grid-cols-1 md:grid-rows-1 landscape:grid-cols-1 landscape:grid-rows-1";
	}
	if (mode.mode == ViewMode.VIEW_SHARE_SCREEN) {
		return "pl-2 border-l-2 border-black grid grid-cols-1 gap-1 w-48 h-full overflow-scroll";
	}
	switch (participantsAmount) {
		case 0:
		case 1:
			return "h-full grid-cols-1 grid-rows-1 md:grid-cols-1 md:grid-rows-1 landscape:grid-cols-1 landscape:grid-rows-1";
		case 2:
			return "h-full grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1 landscape:grid-cols-2 landscape:grid-rows-1";
		case 3:
			return "h-full grid-cols-2 grid-rows-2 md:grid-cols-3 md:grid-rows-1 landscape:grid-cols-3 landscape:grid-rows-1";
		case 4 /* 2x2 grid */:
			return "h-full grid-cols-2 grid-rows-2 md:grid-cols-4 md:grid-rows-1 landscape:grid-cols-2 landscape:grid-rows-2";
		case 5 /* 2x3 grid */:
			return "h-full grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2 landscape:grid-cols-3 landscape:grid-rows-2";
		case 6:
			return "h-full grid-cols-2 md:grid-cols-3 landscape:grid-cols-3";
		case 7:
			return "h-full grid-cols-2 grid-rows-4 md:grid-cols-4 md:grid-rows-2 landscape:grid-cols-4 landscape:grid-rows-2";
		case 8 /* 2x4 grid */:
			return "h-full grid-cols-2 grid-rows-4 md:grid-cols-4 md:grid-rows-2 landscape:grid-cols-4 landscape:grid-rows-2";
		case 9 /* 3x3 grid */:
			return "h-full grid-cols-3 grid-rows-3 md:grid-cols-3 md:grid-rows-3 landscape:grid-cols-3 landscape:grid-rows-3";
		case 10:
		case 11:
		case 12 /* 3x4 grid */:
			return "h-full grid-cols-3 grid-rows-4 md:grid-cols-3 md:grid-rows-4 landscape:grid-cols-4 landscape:grid-rows-3";

		default: /* 4x4 grid */
			return "h-full grid-cols-4 grid-rows-4 md:grid-cols-4 md:grid-rows-4 landscape:grid-cols-4 landscape:grid-rows-4";
	}
}

function getCellClass(participantId: number, mode: DisplayMode, participantsAmount: number) {
	if (mode.mode == ViewMode.VIEW_FOCUS_PARTICIPANT || mode.mode == ViewMode.VIEW_FOCUS_CAMERA) {
		return mode.participantId === participantId ? "h-full" : "hidden";
	}
	if (mode.mode == ViewMode.VIEW_SHARE_SCREEN) {
		return "border-solid border-4 border-blue w-48 h-48";
	}
	switch (participantsAmount) {
		case 1:
		case 2:
			return "h-full";
		case 3:
			return "h-full first:col-span-2 md:first:col-span-1 landscape:first:col-span-1";
		case 4:
			return "h-full";
		case 5:
			return "h-full portrait:first:col-span-2 landscape:first:row-span-2";
		case 6:
			return "h-full";
		case 7:
			return "h-full first:row-span-2 md:first:col-span-1 md:first:row-span-2 landscape:first:col-span-1 landscape:first-row-span-2";
		case 10:
			return "h-full portrait:first:col-span-3 landscape:first:row-span-4";
		case 11:
			return "h-full portrait:first:col-span-2 landscape:first:row-span-2";
		case 13:
			return "h-full portrait:first:col-span-3 landscape:first:row-span-4 landscape:last-child:row-span-4";
		case 14:
			return "h-full portrait:first:col-span-3 landscape:first:row-span-3 landscape:last-child:row-span-3";
		case 15:
			return "h-full portrait:first:col-span-2 landscape:first:row-span-2 landscape:last-child:row-span-2";
		case 8:
		case 9:
		case 12:
		case 16:
		default:
			return "h-full";
	}
}
