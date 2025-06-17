/*
 *  Copyright (c) 2024 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { FC, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ConversationService } from "../../calls/ConversationService";
import { Item } from "../../pages/Call";
import { ContactService } from "../../services/ContactService";

export interface InvitationUI {
	name: string;
	avatarId: string;
	twincode: string;
}

interface InvitationItemProps {
	item: Item;
	twincodeDescriptor: ConversationService.TwincodeDescriptor;
	openInvitation: (invitationUI: InvitationUI) => void;
}

const InvitationItem: FC<InvitationItemProps> = ({ item, twincodeDescriptor, openInvitation }) => {
	const { t } = useTranslation();
	const [contactName, setContactName] = useState<string>("");
	const [avatarId, setAvatarId] = useState<string>("");

	useEffect(() => {
		ContactService.getTwincode(twincodeDescriptor.twincodeId.toString())
			.then((response) => {
				const twincode = response.data;
				setContactName(twincode.name ?? "");
				setAvatarId(twincode.avatarId ?? "");
			})
			.catch((e) => {
				console.error("retrieveInformation for Invitation", e);
			});
	}, [twincodeDescriptor]);

	if (contactName === "" || avatarId === "") return null;

	return (
		<div className="w-[80%] max-w-lg place-self-start">
			{item.displayName && item.participant && (
				<div className="mb-1 mt-3 text-xs font-light">{item.participant.getName()}</div>
			)}
			<div
				className={[
					"mt-1 flex items-center justify-start gap-x-2 overflow-hidden whitespace-pre-line break-words rounded-3xl px-3 py-3 hover:cursor-pointer",
					item.participant ? "place-self-start bg-white text-black" : "place-self-end bg-blue text-white",
					item.corners.tl,
					item.corners.bl,
					item.corners.tr,
					item.corners.br,
				].join(" ")}
				onClick={() =>
					openInvitation({
						name: contactName,
						avatarId: avatarId,
						twincode: twincodeDescriptor.twincodeId.toString(),
					})
				}
			>
				<div className=" w-20">
					<img
						className="rounded-full"
						src={`${import.meta.env.VITE_REST_URL}/images/${avatarId}`}
						alt={contactName}
					/>
				</div>
				<div>
					<Trans i18nKey={"accept_invitation_activity_message"} values={{ contactName }} t={t} />
				</div>
			</div>
		</div>
	);
};

export default InvitationItem;
