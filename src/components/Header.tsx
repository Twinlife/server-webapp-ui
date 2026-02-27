/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import clsx from "clsx";

interface HeaderProps {
	className: string;
}
export default function Header({ className }: HeaderProps) {
	return (
		<div className={clsx("flex w-full items-center justify-between", className)}>
			<a href={import.meta.env.VITE_APP_WEBSITE} target="_blank" className="flex items-center justify-start">
				<img src={"/logo/" + import.meta.env.VITE_APP_LOGO} alt="" className="w-8" />
				<div className="ml-2 font-light text-grey">{import.meta.env.VITE_APP_NAME}</div>
			</a>
		</div>
	);
}
