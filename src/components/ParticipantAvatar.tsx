/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import clsx from "clsx";
import { DefaultAvatar } from "./DefaultAvatar";

export const ParticipantAvatar: React.FC<{ name: string | null; avatarUrl: string | null; isSpeaking: boolean }> = ({
	name,
	avatarUrl,
	isSpeaking,
}) => {
	return (
		<>
			{!avatarUrl && (
				<DefaultAvatar
					name={name ? name : "?"}
					className={clsx("md:h-24 md:w-24 border-4", isSpeaking && "border-blue border-solid")}
				/>
			)}
			{avatarUrl && (
				<>
					<img
						src={avatarUrl}
						alt=""
						className="pointer-events-none z-10 object-cover h-24 w-24 rounded-full shadow-lg landscape:lg:w-48 landscape:lg:h-48"
					/>
					<img
						src={avatarUrl}
						alt=""
						className="pointer-events-none absolute left-0 top-0 h-full w-full object-cover blur block"
					/>
				</>
			)}
		</>
	);
};
