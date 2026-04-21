/*
 *  Copyright (c) 2023-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import { useEffect, useRef } from "react";
import { CallParticipant } from "../calls/CallParticipant";
import { mediaStreams } from "../utils/MediaStreams";

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";

interface ParticipantGridCellProps {
	participant: CallParticipant | null;
	videoClick: (ev: React.MouseEvent<HTMLDivElement>, participantId: number | undefined) => void;
}

const ParticipantScreen: React.FC<ParticipantGridCellProps> = ({ participant, videoClick }) => {
	const refVideo = useRef<HTMLVideoElement>(null);
	const participantId = participant ? participant.getParticipantId() : 0;

	useEffect(() => {
		if (refVideo.current) {
			if (participant) {
				participant.setRemoteRenderer(refVideo.current, null);
			} else {
				refVideo.current.srcObject = mediaStreams.stream;
			}
		}
		if (DEBUG) {
			console.log("set video participant", participant);
		}
	}, [refVideo, participantId, participant]);

	if (DEBUG) {
		console.log("Show participant screen", participantId);
	}
	return (
		<div
			className="relative flex w-3/4 pr-2 h-full items-center justify-center overflow-hidden rounded-lg bg-gray-900"
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
				muted={true}
			></video>
		</div>
	);
};

export default ParticipantScreen;
