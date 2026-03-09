/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
const stringToColour = (str: string) => {
	let hash = 0;
	str.split("").forEach((char) => {
		hash = char.charCodeAt(0) + ((hash << 5) - hash);
	});
	let colour = "#";
	for (let i = 0; i < 3; i++) {
		const value = (hash >> (i * 8)) & 0xff;
		colour += value.toString(16).padStart(2, "0");
	}
	return colour;
};

export const DefaultAvatar: React.FC<{ className: string; name: string }> = ({ className, name }) => {
	return (
		<>
			<div
				style={{ backgroundColor: stringToColour(name) }}
				className={`pointer-events-none relative z-10 flex h-full w-full md:w-48 md:h-48 items-center justify-center object-cover rounded-full md:shadow-lg ${className}`}
			></div>
			<div className="pointer-events-none absolute left-0 top-0 hidden h-full w-full object-cover blur md:block"></div>
		</>
	);
};
