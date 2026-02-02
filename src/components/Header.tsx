/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import ChatIcon from "../assets/chat.svg";
import { chatStore } from "../stores/chat";
import { useSnapshot } from "valtio";

interface HeaderProps {
	openChatButtonDisplayed: boolean;
	openChatPanel?: () => void;
}
export default function Header({ openChatButtonDisplayed, openChatPanel }: HeaderProps) {
	const chat = useSnapshot(chatStore);
	return (
		<div className="flex w-full items-center justify-between">
			<a href={import.meta.env.VITE_APP_WEBSITE} target="_blank" className="flex items-center justify-start">
				<img src={"/logo/" + import.meta.env.VITE_APP_LOGO} alt="" className="w-8" />
				<div className="ml-2 font-light text-grey">{import.meta.env.VITE_APP_NAME}</div>
			</a>
			{openChatButtonDisplayed && openChatPanel && (
				<button onClick={openChatPanel} className="relative">
					{chat.unreadMessages > 0 && (
						<span className="absolute -right-1 -top-1 flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75"></span>
							<span className="relative inline-flex h-2 w-2 rounded-full bg-red"></span>
						</span>
					)}
					<ChatIcon />
				</button>
			)}
		</div>
	);
}
