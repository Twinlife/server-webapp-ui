import QRCode from "qrcode";
import React, { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import closeImage from "../../assets/close.png";
import { InvitationUI } from "./InvitationItem";

const VITE_INVITE_URL = import.meta.env.VITE_INVITE_URL;

interface InvitationDialogProps {
	open: boolean;
	invitationUI: InvitationUI | null;
	handleClose: () => void;
}

const InvitationDialog: React.FC<InvitationDialogProps> = ({ open, invitationUI, handleClose }) => {
	const { t } = useTranslation();
	const [urlString, setUrlString] = useState("");
	const [qrcodeImgSrc, setQrcodeImgSrc] = useState("");

	useEffect(() => {
		if (invitationUI) {
			const inviteURL = VITE_INVITE_URL + invitationUI.twincode;
			setUrlString(inviteURL);
			QRCode.toDataURL(inviteURL)
				.then((url) => {
					setQrcodeImgSrc(url);
				})
				.catch((err: Error) => {
					console.error("Can't generate QRCode image.", err);
				});
		} else {
			setUrlString("");
			setQrcodeImgSrc("");
		}
	}, [invitationUI]);

	if (!open) return null;

	return (
		<div className=" absolute left-0 top-0  h-full w-full  py-4">
			<div className="h-full w-full rounded-lg bg-[#343434]">
				<div
					className={[
						"mx-auto flex h-full w-full max-w-sm flex-col items-center justify-start overflow-auto  py-4 md:min-w-[300px]",
					].join(" ")}
				>
					<div className="flex w-full items-center justify-end px-4">
						<button onClick={handleClose}>
							<img className="w-6" src={closeImage} alt="" />
						</button>
					</div>

					<div className="flex flex-1 flex-col items-center px-4">
						<img
							src={`${import.meta.env.VITE_REST_URL}/images/${invitationUI?.avatarId}`}
							className=" h-20 w-20 rounded-full object-cover md:mt-10 md:h-28 md:w-28"
							alt=""
						/>
						<p className=" mt-2 text-center">{invitationUI?.name}</p>
						<p className=" mt-2 text-center font-light md:mt-6">
							<Trans
								i18nKey={"accept_invitation_activity_message"}
								values={{
									contactName: invitationUI?.name,
								}}
								t={t}
							/>
						</p>

						<img
							src={qrcodeImgSrc}
							className=" hidden h-24 w-24 object-cover md:mt-10 md:block md:h-32 md:w-32"
							alt=""
						/>
						<p className=" mt-2 hidden max-w-[200px] text-center text-xs font-light md:block">
							{t("fullscreen_qrcode_activity_save_message")}
						</p>
					</div>
					<div className="flex w-full items-center justify-between gap-x-4 px-4 text-sm font-light">
						<a
							href={urlString}
							target="_blank"
							className="flex h-10 flex-1 items-center justify-center rounded bg-blue transition hover:bg-blue/70"
						>
							{t("open_invitation")}
						</a>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InvitationDialog;
