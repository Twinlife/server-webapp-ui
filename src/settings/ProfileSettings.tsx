/*
 *  Copyright (c) 2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { FC } from "react";
import { TabPanel } from "@headlessui/react";
import { DefaultAvatar } from "../components/DefaultAvatar";

export interface ProfileConfig {
	name: string;
}
interface SettingsProps {
	config: ProfileConfig;
	onChange: (value: ProfileConfig) => void;
}

export const ProfileSettings: FC<SettingsProps> = ({ config, onChange }) => {
	return (
		<TabPanel className="w-full">
			<div className="p-4 w-full">
				<h3 className="font-semibold mb-2">Name</h3>
				<div className="pl-10 pb-5">
					<DefaultAvatar name={config.name} className="md:h-24 md:w-24 p-4" />
				</div>
				<input
					type="text"
					value={config.name}
					className=" bg-gray-700 placeholder:font-light placeholder:text-[#656565] focus:outline-none "
					placeholder="Entrez un pseudo"
					onChange={(e) => onChange({ name: e.target.value })}
				/>
			</div>
		</TabPanel>
	);
};
