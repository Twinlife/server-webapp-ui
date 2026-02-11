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
					{Array.from({ length: 8 }, (_, index) => {
						const thumbnailPath = "/backgrounds/thumbnails/" + (index + 1) + ".jpg";
						return (
							<div
								key={index}
								className="cursor-pointer p-1"
								onClick={() => {
									selectBackground(index);
								}}
							>
								<img
									src={thumbnailPath}
									className={`p-1 ${config.background === index ? "bg-white" : ""}`}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</TabPanel>
	);
};
