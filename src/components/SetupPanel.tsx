import { AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ContactService, TwincodeInfo } from "../services/ContactService";
import CheckIcon from "./icons/CheckIcon";
import SpinnerIcon from "./icons/SpinnerIcon";
import WarningIcon from "./icons/WarningIcon";

type GrantState = "pending" | "granted" | "denied" | "notfound" | "error";

interface InitializationModalProps {
	twincodeId: string;
	twincode: TwincodeInfo;
	audioDevices: MediaDeviceInfo[];
	// videoDevices: MediaDeviceInfo[];
	usedAudioDevice: string;
	// usedVideoDevice: string;
	setTwincode: (twincode: TwincodeInfo) => void;
	setEnumeratedDevices: (devices: { audioDevices: MediaDeviceInfo[]; videoDevices: MediaDeviceInfo[] }) => void;
	setUsedAudioDevice: (deviceId: string) => void;
	// setUsedVideoDevice: (deviceId: string) => void;
	onAddOrReplaceAudioTrack: (audioTrack: MediaStreamTrack) => void;
	onComplete: () => void;
}

const SetupPanel: React.FC<InitializationModalProps> = ({
	twincodeId,
	twincode,
	audioDevices,
	// videoDevices,
	usedAudioDevice,
	// usedVideoDevice,
	setTwincode,
	setEnumeratedDevices,
	setUsedAudioDevice,
	// setUsedVideoDevice,
	onAddOrReplaceAudioTrack,
	onComplete,
}) => {
	const { t } = useTranslation();
	const [twincodeError, setTwincodeError] = useState<boolean>(false);
	const [audioGranted, setAudioGranted] = useState<GrantState>("pending");
	// const [videoGranted, setVideoGranted] = useState<GrantState>("pending");

	useEffect(() => {
		if (twincodeId) {
			setTwincodeError(false);
			ContactService.getTwincode(twincodeId)
				.then(async (response: AxiosResponse<TwincodeInfo, any>) => {
					let twincode = response.data;
					if (twincode.audio) {
						setTwincode(twincode);
					} else {
						setTwincodeError(true);
					}
				})
				.catch((e) => {
					console.error("retrieveInformation", e);
					setTwincodeError(true);
				});
		}
	}, [twincodeId]);

	useEffect(() => {
		if (twincode && twincode.name) {
			askForMediaPermission("audio");
		}
	}, [twincode]);

	useEffect(() => {
		if (twincode) {
			// if (!twincode.video && audioGranted === "granted") {
			// 	setTimeout(() => {
			// 		onComplete();
			// 	}, 2000);
			// }
			// if (twincode.video && audioGranted === "granted" && videoGranted === "granted") {
			// 	setTimeout(() => {
			// 		onComplete();
			// 	}, 2000);
			// }
			if (audioGranted === "granted") {
				onComplete();
			}
		}
	}, [twincode, audioGranted]);

	const askForMediaPermission = (kind: "audio" | "video") => {
		navigator.mediaDevices
			// We need to ask for devices access this way first to be able to fetch devices labels with enumerateDevices
			// (https://developer.mozilla.org/en-US/docs/Web/API/MediaDeviceInfo/label)
			.getUserMedia({ audio: kind === "audio", video: kind === "video" ? { facingMode: "user" } : false })
			.then((mediaStream) => {
				for (const track of mediaStream.getTracks()) {
					if (track.kind === "audio" && kind === "audio") {
						setAudioGranted("granted");
						setUsedAudioDevice(track.getSettings().deviceId ?? "");
						onAddOrReplaceAudioTrack(track);
						mediaStream.removeTrack(track);
					}
					// if (track.kind === "video" && kind === "video") {
					// 	setVideoGranted("granted");
					// 	setUsedVideoDevice(track.getSettings().deviceId ?? "");
					// }
				}

				navigator.mediaDevices
					.enumerateDevices()
					.then((devices) => {
						const enumeratedDevices = {
							audioDevices: devices.filter((device) => device.kind === "audioinput").slice(),
							// videoDevices: devices.filter((device) => device.kind === "videoinput").slice(),
							videoDevices: [],
						};
						setEnumeratedDevices(enumeratedDevices);

						for (const track of mediaStream.getTracks()) {
							track.stop();
						}
					})
					.catch((error: DOMException) => {
						console.error("Error during enumerateDevices", error);
					});
			})
			.catch((error: DOMException) => {
				console.error("Error during permissions granting", kind, error.name);
				let grantErrorType: GrantState = "error";
				switch (error.name) {
					case "NotAllowedError":
						grantErrorType = "denied";
						break;
					case "NotFoundError":
						grantErrorType = "notfound";
						break;
				}
				kind === "audio" ? setAudioGranted(grantErrorType) : null /* setVideoGranted(grantErrorType) */;
			});
		// .finally(() => {
		// 	if (kind === "audio" && twincode.video) {
		// 		askForMediaPermission("video");
		// 	}
		// });
	};

	return (
		<div className="flex flex-1 items-center justify-center">
			{twincode && twincode.avatarId ? (
				<div>
					<div className="text-center">
						{twincode.avatarId && (
							<img
								className="mx-auto h-24 w-24 rounded-full bg-black"
								src={`${import.meta.env.VITE_REST_URL}/images/${twincode.avatarId}`}
								alt=""
							/>
						)}
						<h3 className="mt-6 text-base font-semibold leading-7 tracking-tight">{twincode.name}</h3>
					</div>

					<ul role="list" className="w-72 divide-y divide-white py-8">
						{twincode.audio && (
							<li className="py-5">
								<div className="flex justify-between border-b-8 border-white">
									<div>{t("audio")}</div>
									<div>
										{audioGranted === "pending" ? (
											<SpinnerIcon />
										) : audioGranted === "granted" ? (
											<CheckIcon className="text-emerald-400" />
										) : (
											<WarningIcon className="text-red" />
										)}
									</div>
								</div>
								<div className="mt-2 max-w-full  text-sm font-light text-grey">
									{audioGranted === "granted" && (
										<div className="truncate">
											{
												audioDevices.filter(
													(audioDevice) => audioDevice.deviceId === usedAudioDevice
												)[0]?.label
											}
										</div>
									)}
									{(audioGranted === "pending" || audioGranted === "denied") && (
										<div className="mb-2">{t("microphone_access")}</div>
									)}
									{audioGranted === "denied" && <div>{t("microphone_access_denied")}</div>}
									{audioGranted === "notfound" && <div>{t("microphone_access_not_found")}</div>}

									{audioGranted === "error" && <div>{t("microphone_access_error")}</div>}
								</div>
							</li>
						)}
						{/* {twincode.video && (
							<li className="py-5">
								<div className="flex justify-between border-b-8 border-white">
									<div>Video</div>
									<div>
										{videoGranted === "pending" ? (
											<SpinnerIcon />
										) : videoGranted === "granted" ? (
											<CheckIcon className="text-emerald-400" />
										) : (
											<WarningIcon className="text-orange-400" />
										)}
									</div>
								</div>
								<div className="mt-2 text-sm font-light text-grey">
									{videoGranted === "granted" && (
										<div className="truncate">
											{
												videoDevices.filter(
													(videoDevice) => videoDevice.deviceId === usedVideoDevice
												)[0]?.label
											}
										</div>
									)}
									{(videoGranted === "pending" || videoGranted === "denied") && (
										<div>Please grant access to your camera.</div>
									)}
									{videoGranted == "denied" && (
										<div>Update your permissions, then refresh the page.</div>
									)}
									{videoGranted === "notfound" && <div>No camera were found.</div>}
									{videoGranted === "error" && (
										<div>
											An error occured, ensure sure the camera is not being used by another
											application and try refreshing the page.
										</div>
									)}
								</div>
							</li>
						)} */}
					</ul>

					<div className="flex h-6 w-full justify-center">
						{/* {twincode.video &&
							audioGranted === "granted" &&
							videoGranted !== "pending" &&
							videoGranted !== "granted" && (
								<div className="w-full cursor-pointer text-center" onClick={onComplete}>
									Continue withtout camera
								</div>
							)} */}
						{/* {!twincode.video && audioGranted === "granted" && <SpinnerIcon />} */}
						{/* {twincode.video && audioGranted === "granted" && videoGranted === "granted" && <SpinnerIcon />} */}
						{audioGranted === "granted" && <SpinnerIcon />}
					</div>
				</div>
			) : twincodeError ? (
				<div className="p-4 text-center">{t("twincode_error")}</div>
			) : (
				<SpinnerIcon />
			)}
		</div>
	);
};

export default SetupPanel;
