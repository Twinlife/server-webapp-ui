/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { FC } from "react";
import { TabPanel } from "@headlessui/react";

export interface BackgroundConfig {
	background: number;
}

export interface SettingsProps {
	isOpen: boolean;
	config: BackgroundConfig;
	onChange: (value: BackgroundConfig) => void;
}

export const BackgroundSettings: FC<SettingsProps> = ({ config, onChange }) => {
	const selectBackground = (idx: number) => {
		console.error("Item ", idx, "selected");
		onChange({ background: idx });
	};
	return (
		<TabPanel className="w-full">
			<div className="p-4">
				<h3 className="font-semibold mb-2">Virtual background</h3>
				<div className="w-full h-full grid grid-rows-3 grid-cols-3 gap-4">
					<div
						className="cursor-pointer p-1"
						onClick={() => {
							selectBackground(-1);
						}}
					>
						<div className={`p-1`}>
							<div
								className={`w-[107px] h-[60px] border-2 border-solid ${config.background == null || config.background < 0 ? "border-white" : "border-transparent"} text-center`}
							>
								None
							</div>
						</div>
					</div>
					<div
						className="cursor-pointer p-1"
						onClick={() => {
							selectBackground(0);
						}}
					>
						<div className={`p-1`}>
							<div
								className={`w-[107px] h-[60px] border-2 border-solid ${config.background === 0 ? "border-white" : "border-transparent"} text-center`}
							>
								Blur
							</div>
						</div>
					</div>
					{Array.from({ length: 8 }, (_, index) => {
						const thumbnailPath = "/backgrounds/thumbnails/" + (index + 1) + ".jpg";
						return (
							<div
								key={index}
								className="cursor-pointer p-1"
								onClick={() => {
									selectBackground(index + 1);
								}}
							>
								<img
									src={thumbnailPath}
									className={`p-1 ${config.background === index + 1 ? "bg-white" : ""}`}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</TabPanel>
	);
};
