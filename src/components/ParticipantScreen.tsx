/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect, useRef } from "react";

interface ParticipantGridCellProps {
	setRemoteRenderer?: (remoteRenderer: HTMLVideoElement) => void;
	participantId?: number;
	videoClick: (ev: React.MouseEvent<HTMLDivElement>, participantId: number | undefined) => void;
}

const ParticipantScreen: React.FC<ParticipantGridCellProps> = ({ setRemoteRenderer, participantId, videoClick }) => {
	const refVideo = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (refVideo.current && setRemoteRenderer) setRemoteRenderer(refVideo.current);
	}, [setRemoteRenderer, refVideo]);

	console.error("Showing participant screen ", participantId);
	return (
		<div
			className="relative flex w-3/4 pr-2 h-full w-full items-center justify-center overflow-hidden rounded-lg bg-gray-900"
			onClick={(e) => {
				videoClick(e, participantId);
			}}
		>
			<video
				ref={refVideo}
				autoPlay={true}
				playsInline={true}
				id={"screenElement-" + participantId}
				className="h-full w-full"
			></video>
		</div>
	);
};

export default ParticipantScreen;
