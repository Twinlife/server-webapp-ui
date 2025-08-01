/*
 *  Copyright (c) 2024-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect, useRef, useState } from "react";
import closeImage from "../../assets/close.png";
import CollapseIcon from "../../assets/collapse.svg";
import ExpandIcon from "../../assets/expand.svg";
import sendImage from "../../assets/send.png";
import { CallService } from "../../calls/CallService";
import { ConversationService } from "../../calls/ConversationService";
import { Item } from "../../pages/Call";
import ChatBoxInput from "./ChatBoxInput";
import InvitationDialog from "./InvitationDialog";
import InvitationItem, { InvitationUI } from "./InvitationItem";

interface ChatBoxInterface {
	chatPanelOpened: boolean;
	items: Item[];
	closeChatPanel: () => void;
	pushMessage: typeof CallService.prototype.pushMessage;
}

export default function ChatBox({ chatPanelOpened, items, closeChatPanel, pushMessage }: ChatBoxInterface) {
	const [chatPanelFull, setChatPanelFull] = useState(false);
	const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
	const [invitationUI, setInvitationUI] = useState<InvitationUI | null>(null);
	const [message, setMessage] = useState("");

	const openInvitation = (invitationUI: InvitationUI) => {
		setInvitationUI(invitationUI);
		setInvitationDialogOpen(true);
	};

	const closeInvitation = () => {
		setInvitationUI(null);
		setInvitationDialogOpen(false);
	};

	const scrollBoxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (scrollBoxRef.current) {
			scrollBoxRef.current.scroll({
				top: scrollBoxRef.current.scrollHeight,
				behavior: "smooth",
			});
		}
	}, [items]);

	const sendMessage = () => {
		if (!message || message === "") return;
		pushMessage(message.trim(), true);
		setMessage("");
	};

	return (
		<div
			className={[
				"absolute bottom-0 right-0 z-20 overflow-hidden transition-all",
				"h-0 w-full px-0 opacity-0",
				"md:h-full ",
				chatPanelOpened ? "h-[300px] py-4 opacity-100 md:w-[300px]" : "h-0 py-0 md:w-0",
				chatPanelFull && "!h-full !w-full py-4",
			].join(" ")}
		>
			<div
				className={[
					"flex h-full w-full flex-col items-center justify-start overflow-hidden rounded-lg bg-[#343434] py-4 md:min-w-[300px]",
				].join(" ")}
			>
				<div className="flex w-full items-center justify-between px-4">
					<button onClick={() => setChatPanelFull(!chatPanelFull)}>
						{chatPanelFull ? <CollapseIcon /> : <ExpandIcon />}
					</button>
					<button onClick={closeChatPanel}>
						<img className="w-6" src={closeImage} alt="" />
					</button>
				</div>
				<div className="w-full flex-1 overflow-auto" ref={scrollBoxRef}>
					<div className="flex min-h-full w-full flex-col items-center justify-end overflow-auto p-4 text-sm">
						{items.map((item, index) => {
							if (item.descriptor.type === ConversationService.Descriptor.Type.OBJECT_DESCRIPTOR) {
								const messageDescriptor = item.descriptor as ConversationService.MessageDescriptor;
								return (
									<div
										key={index}
										className={[
											"max-w-[80%]",
											item.participant ? "place-self-start" : "place-self-end",
										].join(" ")}
									>
										{item.displayName && item.participant && (
											<div className="mb-1 mt-3 text-xs font-light">
												{item.participant.getName()}
											</div>
										)}
										<div
											className={[
												" mt-1 overflow-hidden whitespace-pre-line break-words rounded-3xl px-3 py-2",
												item.participant
													? "place-self-start bg-white text-black"
													: "place-self-end bg-blue text-white",
												item.corners.tl,
												item.corners.bl,
												item.corners.tr,
												item.corners.br,
											].join(" ")}
										>
											{messageDescriptor.message}
										</div>
									</div>
								);
							}
							if (item.descriptor.type === ConversationService.Descriptor.Type.TWINCODE_DESCRIPTOR) {
								const twincodeDescriptor = item.descriptor as ConversationService.TwincodeDescriptor;
								return (
									<InvitationItem
										key={index}
										item={item}
										twincodeDescriptor={twincodeDescriptor}
										openInvitation={openInvitation}
									/>
								);
							}
							return null;
						})}
					</div>
				</div>
				<form
					className="flex w-full items-center justify-center pl-4 pr-3"
					onSubmit={(e) => {
						e.preventDefault();
						sendMessage();
					}}
				>
					<ChatBoxInput
						value={message}
						onChange={(e) => setMessage(e.currentTarget.value)}
						onSubmit={sendMessage}
					/>

					<button type="submit">
						<img className="ml-1 w-6" src={sendImage} alt="" />
					</button>
				</form>
			</div>
			<InvitationDialog open={invitationDialogOpen} handleClose={closeInvitation} invitationUI={invitationUI} />
		</div>
	);
}
