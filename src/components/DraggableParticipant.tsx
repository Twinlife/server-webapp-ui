import { RefObject, useRef } from "react";
import DraggableCore from "react-draggable";
import { LocalParticipant } from "./LocalParticipant";

export const DraggableParticipant: React.FC<{
	className: string;
	localVideoRef: RefObject<HTMLVideoElement>;
	localMediaStream: MediaStream;
	localAbsolute: boolean;
	videoMute: boolean;
	isLocalAudioMute: boolean;
	enableVideo: boolean;
	isIddle: boolean;
	guestName: string;
	guestNameError: boolean;
	setGuestName: (value: string) => void;
	updateGuestName: (value: string) => void;
	muteVideoClick: (ev: React.MouseEvent<HTMLDivElement>) => void;
	videoClick: (ev: React.MouseEvent<HTMLDivElement>, participantId: number | undefined) => void;
}> = ({
	className,
	localVideoRef,
	localMediaStream,
	localAbsolute,
	videoMute,
	isLocalAudioMute,
	enableVideo,
	isIddle,
	guestName,
	guestNameError,
	setGuestName,
	updateGuestName,
	muteVideoClick,
	videoClick,
}) => {
	const dragStartPositionXYRef = useRef<{ x: number; y: number }>();
	const cl = [
		localAbsolute ? "absolute left-10 top-10 z-30 ring-2 ring-black w-16 h-16" : isIddle ? "relative" : "relative",
		"overflow-hidden rounded-md",
		videoMute && localAbsolute ? "hidden" : "",
		className,
	].join(" ");
	if (!localAbsolute) {
		// 				"relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[#202020]",
		const cl = [
			"relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[#202020]",
			className,
		].join(" ");
		return (
			<div
				className={cl}
				onClick={(e) => {
					if (!isIddle && !videoMute) {
						videoClick(e, 0);
					}
				}}
			>
				<LocalParticipant
					localVideoRef={localVideoRef}
					localMediaStream={localMediaStream}
					localAbsolute={localAbsolute}
					videoMute={videoMute}
					isLocalAudioMute={isLocalAudioMute}
					isIddle={isIddle}
					enableVideo={enableVideo}
					guestName={guestName}
					guestNameError={guestNameError}
					setGuestName={setGuestName}
					updateGuestName={updateGuestName}
					muteVideoClick={muteVideoClick}
				></LocalParticipant>
			</div>
		);
	}
	return (
		<DraggableCore
			grid={[1, 1]}
			bounds="parent"
			axis="both"
			onStart={(event, data) => {
				// Record the starting position of the drag, so we can detect later if
				// the user actually dragged the popup or just clicked on it
				dragStartPositionXYRef.current = { x: data.x, y: data.y };
			}}
			onStop={(event, data) => {
				// Only treat the drag as a real one if the popup moved at least a
				// threshold number of pixels in any direction
				const THRESHOLD = 2;
				const { x, y } = dragStartPositionXYRef.current ?? { x: 0, y: 0 };
				const wasDragged = Math.abs(data.x - x) > THRESHOLD && Math.abs(data.y - y) > THRESHOLD;

				if (!wasDragged) {
					(event?.target as HTMLDivElement)?.click?.();
				}
			}}
		>
			<div
				className={cl}
				onClick={(e) => {
					videoClick(e, 0);
				}}
			>
				<LocalParticipant
					localVideoRef={localVideoRef}
					localMediaStream={localMediaStream}
					localAbsolute={true}
					videoMute={videoMute}
					isLocalAudioMute={isLocalAudioMute}
					isIddle={isIddle}
					enableVideo={enableVideo}
					guestName={guestName}
					guestNameError={guestNameError}
					setGuestName={setGuestName}
					updateGuestName={updateGuestName}
					muteVideoClick={muteVideoClick}
				></LocalParticipant>
			</div>
		</DraggableCore>
	);
};
