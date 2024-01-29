import React from "react";
import { Trans, useTranslation } from "react-i18next";
import closeImage from "../../assets/close.png";

interface InvitationDialogProps {
	open: boolean;
	handleClose: () => void;
}

const InvitationDialog: React.FC<InvitationDialogProps> = ({ open, handleClose }) => {
	const { t } = useTranslation();
	if (!open) return null;

	return (
		<div className="absolute left-0 top-0 h-full w-full py-4">
			<div
				className={[
					"flex h-full w-full flex-col items-center justify-start overflow-auto rounded-lg bg-[#343434] py-4 md:min-w-[300px]",
				].join(" ")}
			>
				<div className="flex w-full items-center justify-end px-4">
					<button onClick={handleClose}>
						<img className="w-6" src={closeImage} alt="" />
					</button>
				</div>

				<div className="flex flex-1 flex-col items-center px-4">
					<img
						src="https://picsum.photos/200/300"
						className=" h-20 w-20 rounded-full object-cover md:mt-10 md:h-28 md:w-28"
						alt=""
					/>
					<p className=" mt-2 text-center">Jimmy</p>
					<p className=" mt-2 text-center font-light md:mt-6">
						<Trans
							i18nKey={"accept_invitation_activity_message"}
							values={{
								contactName: "Jimmy",
							}}
							t={t}
						/>
					</p>

					<img
						src="https://picsum.photos/200/300?random=2"
						className=" hidden h-24 w-24 object-cover md:mt-10 md:block md:h-32 md:w-32"
						alt=""
					/>
					<p className=" mt-2 hidden max-w-[200px] text-center text-xs font-light md:block">
						{t("fullscreen_qrcode_activity_save_message")}
					</p>
				</div>
				<div className="flex w-full items-center justify-between gap-x-4 px-4 text-sm font-light">
					<button className=" h-10 flex-1 rounded bg-red transition hover:bg-red/70">Annuler</button>
					<button className=" h-10 flex-1 rounded bg-blue transition hover:bg-blue/70">Afficher</button>
				</div>
			</div>
		</div>
	);
};

export default InvitationDialog;
