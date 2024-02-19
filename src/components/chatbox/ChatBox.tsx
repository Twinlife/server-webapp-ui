import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import closeImage from "../../assets/close.png";
import collapseIcon from "../../assets/collapse.svg";
import expandIcon from "../../assets/expand.svg";
import sendImage from "../../assets/send.png";
import { CallService } from "../../calls/CallService";
import { ConversationService } from "../../calls/ConversationService";
import { Item } from "../../pages/Call";
import ChatBoxInput from "./ChatBoxInput";
import InvitationDialog from "./InvitationDialog";

interface ChatBoxInterface {
	chatPanelOpened: boolean;
	items: Item[];
	closeChatPanel: () => void;
	pushMessage: typeof CallService.prototype.pushMessage;
}

export default function ChatBox({ chatPanelOpened, items, closeChatPanel, pushMessage }: ChatBoxInterface) {
	const { t } = useTranslation();
	const [chatPanelFull, setChatPanelFull] = useState(false);
	const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
	const [invitationItem, setInvitationItem] = useState<Item | null>(null);
	const [message, setMessage] = useState("");

	const openInvitation = (item: Item) => {
		setInvitationItem(item);
		setInvitationDialogOpen(true);
	};

	const closeInvitation = () => {
		setInvitationItem(null);
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
						<img src={chatPanelFull ? collapseIcon : expandIcon} alt="" />
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
									<div
										key={index}
										className={[
											"w-[80%] max-w-lg",
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
												"mt-1 flex items-center justify-start gap-x-2 overflow-hidden whitespace-pre-line break-words rounded-3xl px-3 py-3 hover:cursor-pointer",
												item.participant
													? "place-self-start bg-white text-black"
													: "place-self-end bg-blue text-white",
												item.corners.tl,
												item.corners.bl,
												item.corners.tr,
												item.corners.br,
											].join(" ")}
											onClick={() => openInvitation(item)}
										>
											<div className=" w-20">
												<img
													className=" rounded-full"
													src={item.participant?.getAvatarUrl() ?? ""}
													alt=""
												/>
											</div>
											<div>
												<Trans
													i18nKey={"accept_invitation_activity_message"}
													values={{
														contactName: item.participant?.getName() ?? "",
													}}
													t={t}
												/>
											</div>
										</div>
									</div>
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
			<InvitationDialog
				open={invitationDialogOpen}
				handleClose={closeInvitation}
				invitationItem={invitationItem}
			/>
		</div>
	);
}
