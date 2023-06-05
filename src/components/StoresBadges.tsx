import appStoreBadge from "../assets/store-badges/appstore-badge.svg";
import androidPlayBadge from "../assets/store-badges/google-play-badge.png";
import macStoreBadge from "../assets/store-badges/macStore.svg";
import microsoftBadge from "../assets/store-badges/microsoft.svg";

const StoresBadges = () => {
	let isMobile = window.matchMedia("(any-pointer:coarse)").matches;

	if (isMobile) {
		return (
			<div className="mx-auto grid max-w-md grid-cols-2">
				<a href="https://apps.apple.com/app/twinme-private-messenger/id889904498" target="_blank">
					<img className="mx-auto" src={appStoreBadge} alt="Download on the App Store" />
				</a>
				<a
					href="https://play.google.com/store/apps/details?id=org.twinlife.device.android.twinme"
					target="_blank"
				>
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
			<a href="https://apps.apple.com/app/twinme-messenger-desktop/id1621522049" target="_blank">
				<img className="mx-auto" src={macStoreBadge} alt="Download on the App Store" />
			</a>
			<a href="https://apps.microsoft.com/store/detail/twinme-private-messenger/9MX5M684NHG4" target="_blank">
				<img className="mx-auto h-[39px]" src={microsoftBadge} alt="Get it on Google Play" />
			</a>
		</div>
	);
};

export default StoresBadges;
