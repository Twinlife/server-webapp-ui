import { RefObject, useEffect } from "react";
import { useTranslation } from "react-i18next";
import GuestNameForms from "./GuestNameForms";

export const LocalParticipant: React.FC<{
	localVideoRef: RefObject<HTMLVideoElement>;
	localMediaStream: MediaStream;
	localAbsolute: boolean;
	videoMute: boolean;
	isLocalAudioMute: boolean;
	enableVideo: boolean;
	isIdle: boolean;
	guestName: string;
	guestNameError: boolean;
	setGuestName: (value: string) => void;
	updateGuestName: (value: string) => void;
	muteVideoClick: (ev: React.MouseEvent<HTMLDivElement>) => void;
}> = ({
	localVideoRef,
	localMediaStream,
	localAbsolute,
	videoMute,
	isLocalAudioMute,
	enableVideo,
	isIdle,
	guestName,
	guestNameError,
	setGuestName,
	updateGuestName,
	muteVideoClick,
}) => {
	const { t } = useTranslation();

	useEffect(() => {
		console.log("Update local " + localVideoRef.current);
		console.log("Stream=" + localMediaStream + " mute=" + videoMute);
		if (localVideoRef.current) {
			localVideoRef.current.srcObject = localMediaStream;
		} else {
			console.log("There is no local video element");
		}
	}, [localMediaStream, localVideoRef, videoMute, localAbsolute]);

	const muteSize: string = localAbsolute ? "0.5em" : "1em";
	const muteClass: string = localAbsolute
		? "absolute right-1 top-1 z-20 text-2xl md:left-auto md:right-2"
		: "absolute right-2 top-2 z-20 text-2xl md:left-auto md:right-2";
	return (
		<>
			{isLocalAudioMute && (
				<div className={muteClass}>
					<svg width={muteSize} height={muteSize} viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
						<g fill="none" fillRule="evenodd">
							<circle fill="#FD605D" cx={13} cy={13} r={13} />
							<path
								d="m8.825 18.486.809-.795c.77.577 1.72.933 2.763.933h1.145c2.528 0 4.578-2.014 4.578-4.5V13h1.144v1.125c0 3.106-2.562 5.625-5.722 5.625v1.124h.572c.316 0 .572.252.572.563 0 .311-.256.563-.572.563h-2.289a.568.568 0 0 1-.572-.563c0-.311.256-.563.572-.563h.572V19.75a5.726 5.726 0 0 1-3.572-1.264zm8.15-8.012v3.088c0 2.175-1.793 3.937-4.006 3.937a4.017 4.017 0 0 1-2.358-.769l6.364-6.256zm-10.3 3.65V13h1.144v1.125c0 .423.079.825.19 1.213l-.91.895a5.507 5.507 0 0 1-.425-2.108zm2.367.199c-.05-.246-.078-.5-.078-.76V7.936C8.964 5.763 10.757 4 12.969 4a3.986 3.986 0 0 1 3.795 2.733l-7.722 7.59zM6.5 19.5l-.5-.607L19.197 5.921l.303.579-13 13z"
								fill="#FFF"
							/>
						</g>
					</svg>
				</div>
			)}

			<video
				ref={localVideoRef}
				className={["h-full w-full object-cover", videoMute ? "hidden" : ""].join(" ")}
				autoPlay={true}
				playsInline={true}
				muted={true}
			></video>

			<div
				className={[
					"flex h-full w-full flex-col items-center justify-center bg-[#202020] p-1",
					videoMute ? "" : "hidden",
				].join(" ")}
			>
				{enableVideo && (
					<span
						className={[isIdle ? "" : "hidden md:block", "absolute top-2 mt-2 text-sm md:text-base"].join(
							" ",
						)}
					>
						{t("activate_camera")}
					</span>
				)}
				<div
					className={[
						"flex items-center justify-center rounded-full bg-[#2f2f2f] text-5xl ring-slate-600 transition duration-200 ease-in-out w-24 h-24 landscape:lg:w-48 landscape:lg:h-48",
						videoMute ? "" : "hidden",
						enableVideo ? "cursor-pointer hover:ring" : "",
					].join(" ")}
					onClick={(e) => {
						if (enableVideo) {
							muteVideoClick(e);
						}
					}}
				>
					{enableVideo ? (
						<svg width="100%" height="100%" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg">
							<g
								transform="translate(8 12)"
								stroke="#808080"
								strokeWidth="2"
								fill="none"
								fillRule="evenodd"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m22 2-7 5 7 5z" />
								<rect width="15" height="14" rx="2" />
							</g>
						</svg>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<img
								src={"/logo/" + import.meta.env.VITE_APP_LOGO_BIG}
								alt=""
								className="w-[70px] md:w-[80px]"
							/>
						</div>
					)}
				</div>
			</div>
			{!localAbsolute && (
				<div className={["absolute bottom-2 right-2 text-sm"].join(" ")}>
					<GuestNameForms
						update={!isIdle}
						guestName={guestName}
						guestNameError={guestNameError}
						setGuestName={setGuestName}
						updateGuestName={updateGuestName}
					/>
				</div>
			)}
		</>
	);
};
