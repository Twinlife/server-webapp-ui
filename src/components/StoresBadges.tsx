/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import appStoreBadge from "../assets/store-badges/appstore-badge.svg";
import androidPlayBadge from "../assets/store-badges/google-play-badge.png";
import { AgentType, getAgent } from "../utils/DetectAgent";

const agent: AgentType = getAgent();

const StoresBadges = () => {
	const count: number = agent === "Android" || agent === "iOS" ? 1 : 2;
	return (
		<div className={"grid max-w-md grid-cols-" + count}>
			{agent !== "Android" && (
				<a href={import.meta.env.VITE_STORE_IOS} target="_blank">
					<img className="mx-auto" src={appStoreBadge} alt="Download on the App Store" />
				</a>
			)}
			{agent !== "iOS" && (
				<a href={import.meta.env.VITE_STORE_ANDROID} target="_blank">
					<img
						className="mx-auto"
						style={{ width: 154, marginTop: -10 }}
						src={androidPlayBadge}
						alt="Get it on Google Play"
					/>
				</a>
			)}
		</div>
	);

	// return (
	// 	<div className="mx-auto grid max-w-md grid-cols-2 gap-4">
	// 		<a href={import.meta.env.VITE_STORE_MAC} target="_blank">
	// 			<img className="mx-auto" src={macStoreBadge} alt="Download on the App Store" />
	// 		</a>
	// 		<a href={import.meta.env.VITE_STORE_WINDOWS} target="_blank">
	// 			<img className="mx-auto h-[39px]" src={microsoftBadge} alt="Get it on Google Play" />
	// 		</a>
	// 	</div>
	// );
};

export default StoresBadges;
