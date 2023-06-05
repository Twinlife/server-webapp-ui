import appStoreBadge from "../assets/store-badges/appstore-badge.svg";
import androidPlayBadge from "../assets/store-badges/google-play-badge.png";
import macStoreBadge from "../assets/store-badges/macStore.svg";
import microsoftBadge from "../assets/store-badges/microsoft.svg";

const StoresBadges = () => {
	let isMobile = window.matchMedia("(any-pointer:coarse)").matches;

	if (isMobile) {
		return (
			<div className="mx-auto grid max-w-md grid-cols-2">
				<a href={import.meta.env.VITE_STORE_IOS} target="_blank">
					<img className="mx-auto" src={appStoreBadge} alt="Download on the App Store" />
				</a>
				<a href={import.meta.env.VITE_STORE_ANDROID} target="_blank">
					<img
						className="mx-auto"
						style={{ width: 154, marginTop: -10 }}
						src={androidPlayBadge}
						alt="Get it on Google Play"
					/>
				</a>
			</div>
		);
	}

	return (
		<div className="mx-auto grid max-w-md grid-cols-2 gap-4">
			<a href={import.meta.env.VITE_STORE_MAC} target="_blank">
				<img className="mx-auto" src={macStoreBadge} alt="Download on the App Store" />
			</a>
			<a href={import.meta.env.VITE_STORE_WINDOWS} target="_blank">
				<img className="mx-auto h-[39px]" src={microsoftBadge} alt="Get it on Google Play" />
			</a>
		</div>
	);
};

export default StoresBadges;
