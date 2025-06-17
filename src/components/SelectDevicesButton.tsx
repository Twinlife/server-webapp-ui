/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { Menu, Transition } from "@headlessui/react";
import { CheckIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";

const SelectDevicesButton: React.FC<{
	audioDevices: MediaDeviceInfo[];
	videoDevices: MediaDeviceInfo[];
	usedAudioDevice: string;
	usedVideoDevice: string;
	selectAudioDevice: (deviceId: string) => void;
	selectVideoDevice: (deviceId: string) => void;
}> = ({ audioDevices, videoDevices, usedAudioDevice, usedVideoDevice, selectAudioDevice, selectVideoDevice }) => {
	return (
		<Menu as="div" className="relative inline-block text-left">
			<div>
				<Menu.Button className="btn-white ml-3 h-[45px] w-[45px]">
					<Cog6ToothIcon className="m-auto w-[29px] text-black" aria-hidden="true" />
				</Menu.Button>
			</div>

			<Transition
				as={Fragment}
				enter="transition ease-out duration-100"
				enterFrom="transform opacity-0 scale-95"
				enterTo="transform opacity-100 scale-100"
				leave="transition ease-in duration-75"
				leaveFrom="transform opacity-100 scale-100"
				leaveTo="transform opacity-0 scale-95"
			>
				<Menu.Items className="max-w-screen absolute -top-2 right-0 z-20 mb-2 origin-bottom-right -translate-y-full transform divide-y divide-gray-100 overflow-hidden rounded-md bg-zinc-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
					{audioDevices.length > 0 && (
						<>
							<div className="flex items-center">
								<svg xmlns="http://www.w3.org/2000/svg" width="27" height="28" viewBox="0 0 37 38">
									<g fill="none" fillRule="evenodd" strokeLinecap="round" strokeLinejoin="round">
										<g stroke="#fff" strokeWidth="2">
											<g>
												<path
													d="M7 0C5.343 0 4 1.343 4 3v8c0 1.657 1.343 3 3 3s3-1.343 3-3V3c0-1.657-1.343-3-3-3z"
													transform="translate(12 8)"
												/>
												<path
													d="M14 9v2c0 3.866-3.134 7-7 7s-7-3.134-7-7V9M7 18L7 22M3 22L11 22"
													transform="translate(12 8)"
												/>
											</g>
										</g>
									</g>
								</svg>

								<div className="ml-1 mr-2  h-[1px] flex-1 bg-slate-700"></div>
							</div>
							{audioDevices.map((audioDevice) => {
								const used = audioDevice.deviceId === usedAudioDevice;
								return (
									<MenuItem
										key={audioDevice.deviceId}
										device={audioDevice}
										used={used}
										onClick={() => selectAudioDevice(audioDevice.deviceId)}
									/>
								);
							})}
						</>
					)}
					{videoDevices.length > 0 && (
						<>
							<div className="flex items-center">
								<svg width="27" height="27" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg">
									<g
										transform="translate(8 12)"
										stroke="#fff"
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

								<div className="ml-1 mr-2  h-[1px] flex-1 bg-slate-700"></div>
							</div>
							{videoDevices.map((videoDevice) => {
								const used = videoDevice.deviceId === usedVideoDevice;
								return (
									<MenuItem
										key={videoDevice.deviceId}
										device={videoDevice}
										used={used}
										onClick={() => selectVideoDevice(videoDevice.deviceId)}
									/>
								);
							})}
						</>
					)}
				</Menu.Items>
			</Transition>
		</Menu>
	);
};

const MenuItem: React.FC<{ device: MediaDeviceInfo; used: boolean; onClick: () => void }> = ({
	device,
	used,
	onClick,
}) => {
	return (
		<Menu.Item>
			{({ active }) => (
				<div
					className={[
						active && !used ? "bg-slate-700 text-white" : "text-gray-700",
						"flex items-center px-4 py-2 text-sm transition",
						used ? "text-white" : "cursor-pointer",
					].join(" ")}
					onClick={() => {
						if (!used) {
							onClick();
						}
					}}
				>
					<CheckIcon className={["mr-3 h-3 w-3", used ? "" : "opacity-0"].join(" ")} />
					<span className="truncate">{device.label}</span>
				</div>
			)}
		</Menu.Item>
	);
};

export default SelectDevicesButton;
