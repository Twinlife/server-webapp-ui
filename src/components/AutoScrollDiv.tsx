/*
 *  Copyright (c) 2024-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect, useRef } from "react";

export interface AutoScrollDivProps {
	children: React.ReactNode;
}

export const AutoScrollDiv: React.FC<AutoScrollDivProps> = ({ children }) => {
	const divRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom whenever children change
	useEffect(() => {
		const timer = setTimeout(() => {
			if (divRef.current) {
				divRef.current.scrollTop = divRef.current.scrollHeight;
			}
		}, 0);
		return () => clearTimeout(timer);
	}, [children]);

	return (
		<div className="h-full w-full overflow-y-scroll" ref={divRef}>
			<div className="flex w-full flex-col items-center justify-end p-4 text-sm">{children}</div>
		</div>
	);
};
