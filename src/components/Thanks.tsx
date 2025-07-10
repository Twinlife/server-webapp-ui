/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { Trans, useTranslation } from "react-i18next";
import PhoneCallIcon from "../assets/phone-call.svg";
import Header from "./Header";
import StoresBadges from "./StoresBadges";

interface ThanksProps {
	onCallBackClick: () => void;
}

const TRANSFER = import.meta.env.VITE_APP_TRANSFER === "true";

export default function Thanks({ onCallBackClick }: ThanksProps) {
	const { t } = useTranslation();

	return (
		<div className=" flex h-full w-screen flex-col items-center bg-black p-4 ">
			<Header messageNotificationDisplayed={false} openChatButtonDisplayed={false} />

			<div className="grid w-full flex-1 grid-cols-1 landscape:grid-cols-2 md:grid-cols-2">
				<div className="flex justify-center landscape:items-center landscape:justify-end">
					<img
						src={"/thanks/" + import.meta.env.VITE_APP_THANKS_IMAGE}
						alt=""
						className="object-contain py-3 landscape:mr-10 md:mr-10 landscape:max-w-md md:max-w-md thanks-image"
					/>
				</div>

				<div className="flex w-full flex-col items-center landscape:items-start md:items-start landscape:justify-center md:justify-center">
					<div className="portrait:my-4 landscape:my-2 landscape:lg:my-4 text-center portrait:text-2xl landscape:lg:text-2xl text-white">
						<Trans i18nKey="thanks_choosing" values={{ appName: import.meta.env.VITE_APP_NAME }} t={t} />
					</div>
					{!TRANSFER && (
						<>
							<div className="mb-3 landscape:lg:mb-6 w-60 text-center font-light landscape:text-left md:text-left">
								{t("next_time_app")}
							</div>

							<div className="landscape:lg:-ml-4">
								<StoresBadges />
							</div>
						</>
					)}

					<div className="portrait:py-6 landscape:lg:py-6 text-center font-light">
						{t("more_information")}{" "}
						<strong>
							<a href={import.meta.env.VITE_APP_WEBSITE} target="_blank" className="text-white">
								{import.meta.env.VITE_APP_NAME}
							</a>
						</strong>
					</div>

					<button
						className="mt-1 px-6 py-3 flex items-center justify-center rounded-full text-white transition bg-blue hover:bg-blue/90 active:bg-blue/80"
						onClick={onCallBackClick}
					>
						<span className="mr-3"><PhoneCallIcon /></span>

						<span className="font-light">{t("calls_fragment_call_again_title")}</span>
					</button>

					<div className="py-2 lg:py-6 text-center font-light">{t("call_back")}</div>
				</div>
			</div>
		</div>
	);
}
