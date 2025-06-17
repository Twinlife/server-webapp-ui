/*
 *  Copyright (c) 2023-2025 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import { MouseEventHandler, PropsWithChildren } from "react";

interface WhiteButtonProps extends PropsWithChildren {
	className?: string;
	onClick: MouseEventHandler<HTMLButtonElement>;
}

const WhiteButton: React.FC<WhiteButtonProps> = ({ className, onClick, children }) => {
	return (
		<button className={["btn-white", className].join(" ")} onClick={onClick}>
			{children}
		</button>
	);
};

export default WhiteButton;
