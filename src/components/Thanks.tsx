import { useTranslation } from "react-i18next";
import phoneCallIcon from "../assets/phone-call.svg";
import thanksImg from "../assets/thanks.png";
import Header from "./Header";
import StoresBadges from "./StoresBadges";

interface ThanksProps {
	onCallBackClick: () => void;
}

export default function Thanks({ onCallBackClick }: ThanksProps) {
	const { t } = useTranslation();

	return (
		<div className=" flex h-full w-screen flex-col items-center bg-black p-4 ">
			<Header />

			<div className="flex w-full flex-1 flex-col items-center justify-center lg:w-auto lg:flex-row">
				<img src={thanksImg} alt="" />

				<div className="flex w-full flex-col items-center lg:items-start">
					<div className="my-4 text-center text-2xl text-white">{t("thanks_choosing")}</div>
					<div className="mb-12 w-60 text-center font-light lg:text-left">{t("next_time_app")}</div>

					<StoresBadges />

					<div className="py-6 text-center font-light">
						{t("more_information")}{" "}
						<strong>
							<a href={import.meta.env.VITE_APP_WEBSITE} target="_blank" className="text-white">
								{import.meta.env.VITE_APP_NAME}
							</a>
						</strong>
					</div>

					<button
						className={[
							"mt-6 flex items-center justify-center rounded-full px-6 py-3 text-white transition ",
							"bg-blue hover:bg-blue/90 active:bg-blue/80",
						].join(" ")}
						onClick={onCallBackClick}
					>
						<img src={phoneCallIcon} alt="" className="mr-3" />

						<span className="font-light">{t("calls_fragment_call_again_title")}</span>
					</button>

					<div className="py-2 text-center font-light">{t("call_back")}</div>
				</div>
			</div>
		</div>
	);
}
