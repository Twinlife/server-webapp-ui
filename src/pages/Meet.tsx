/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
import clsx from "clsx";
import i18n from "i18next";
import "react-confirm-alert/src/react-confirm-alert.css";
import { subscribe } from "valtio/index";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { CallStatusOps } from "../calls/CallStatus";
import Alert from "../components/Alert";
import Header from "../components/Header";
import Thanks from "../components/Thanks";
import { CallButtons } from "../components/CallButtons";
import { Call } from "./Call.tsx";
import JoinMeeting from "../components/JoinMeeting.tsx";
import { LocalParticipant } from "../components/LocalParticipant";
import { ParticipantsGrid } from "../components/ParticipantsGrid";
import { VirtualBackground } from "../effects/VirtualBackground";
import { VideoTrack } from "../utils/VideoTrack";
import { Notifications } from "../notifications/Notifications";
import { backgroundStore } from "../stores/backgrounds";
import { ContactService } from "../services/ContactService";
import { isMobile } from "../utils/BrowserCapabilities";
import { mediaStreams } from "../utils/MediaStreams.ts";

export class Meet extends Call {
	private videoBackground: VirtualBackground | null = null;

	public init = () => {
		super.init();

		// If the virtual background setting was changed, update the effect.
		subscribe(backgroundStore, () => {
			const background = backgroundStore.background;
			const video: VideoTrack | null = mediaStreams.video;
			if (this.videoBackground && (video == null || video.hasEffect())) {
				if (background < 0) {
					// The current media video has the virtual background effect,
					// we must stop the effect without stopping the camera.
					// In the media stream, we only switch the track from the effect-track
					// to the camera track.
					console.info("Remove video background track changed in the media stream");
					mediaStreams.setVideoTrackNoStop(this.videoBackground.removeEffect());
					if (mediaStreams.video) {
						this.callService.updateVideoTrack(mediaStreams.video, true);
					}
				} else {
					// Simple case: we only change the background effect on the same track.
					// No need to switch track, we only change the background image.
					const backgroundPath = background > 0 ? "/backgrounds/" + background + ".webp" : "";
					console.info("Change video background to", backgroundPath);
					this.videoBackground.setBackground(backgroundPath);
				}
			} else if (background >= 0 && video) {
				// Last case, the current video has no effect and we want to turn it on.
				// Again, we have to update the media stream with a new track without
				// stopping the camera.
				const backgroundPath = background > 0 ? "/backgrounds/" + background + ".webp" : "";
				console.info("Create video background", backgroundPath);
				if (this.videoBackground == null) {
					const videoBackground = new VirtualBackground();
					this.videoBackground = videoBackground;
					videoBackground.init().then(() => {
						const stream = videoBackground.startEffect(video.track, backgroundPath);
						mediaStreams.setVideoTrackNoStop(stream);
						this.callService.updateVideoTrack(stream, true);
					});
				} else {
					mediaStreams.setVideoTrackNoStop(this.videoBackground.startEffect(video.track, backgroundPath));
					if (mediaStreams.video) {
						this.callService.updateVideoTrack(mediaStreams.video, true);
					}
				}
			}
		});
	};

	setVideoTrack = (mediaStream: MediaStreamTrack, isScreenSharing: boolean) => {
		const background = backgroundStore.background;
		if (isMobile || isScreenSharing || background == null || background < 0) {
			this.callService.setVideoTrack(new VideoTrack(mediaStream, null), isScreenSharing);
			if (this.videoBackground) {
				this.videoBackground.stopEffect();
			}
			return;
		}
		if (this.videoBackground == null) {
			this.videoBackground = new VirtualBackground();
			this.videoBackground.init().then(() => {
				this.setVideoTrack(mediaStream, isScreenSharing);
			});
		} else {
			const backgroundPath = background > 0 ? "/backgrounds/" + background + ".webp" : "";
			const stream = this.videoBackground.startEffect(mediaStream as MediaStreamTrack, backgroundPath);
			this.callService.setVideoTrack(stream, isScreenSharing);
		}
	};

	onReadyCall(): void {
		if (!this.state.videoMute && !this.callService.hasVideoTrack()) {
			this.askForMediaPermission("video");
		}
	}

	render() {
		const { id, t } = this.props;
		const {
			initializing,
			guestNameError,
			twincode,
			videoMute,
			audioMute,
			status,
			participants,
			displayMode,
			terminateReason,
			displayThanks,
			isSharingScreen,
			items,
			alertOpen,
			alertTitle,
			alertContent,
		} = this.state;

		if (displayThanks) {
			return <Thanks onCallBackClick={this.init} />;
		}

		document.title = i18n.t("title", {
			appName: import.meta.env.VITE_APP_NAME,
			callType: i18n.t("call"),
			linkName: twincode.name,
		});
		const isActive = CallStatusOps.isActive(status);
		const style = "p-1 md:p-2 landscape:lg:p-4";
		console.log("status", status, "participants", participants.length, "active", isActive);

		return (
			<div className={clsx("relative flex flex-col h-full w-screen overflow-hidden bg-black", style)}>
				<Header className={isActive ? "absolute z-10 top-5 left-5 md:top-8 md:left-8" : ""} />
				<Notifications />

				{!isActive && (
					<JoinMeeting
						className="w-full h-screen flex flex-col md:flex-row landscape:flex-row"
						initializing={initializing}
						twincodeId={id}
						twincode={twincode}
						status={status}
						title={twincode.name ? twincode.name : "?"}
						buttons={
							<CallButtons
								className=""
								status={status}
								callbacks={this}
								audioMute={audioMute}
								hasVideo={twincode.video}
								videoMute={videoMute}
								isSharingScreen={isSharingScreen}
								transfer={false}
							/>
						}
						onStartClick={this.onCallClick}
						onCancelClick={this.onTerminateClick}
						onGetTwincode={(twincode) => {
							this.onGetTwincode(twincode);
						}}
					>
						<div className="flex-1 h-auto md:h-full md:w-full rounded-lg max-h-[80vh] overflow-hidden">
							<LocalParticipant
								localVideoRef={this.localVideoRef}
								localAbsolute={true}
								videoMute={videoMute && !isSharingScreen}
								isLocalAudioMute={false}
								isIdle={true}
								isScreenSharing={isSharingScreen}
								enableVideo={true}
								guestNameError={guestNameError}
								muteVideoClick={this.onMuteVideoClick}
							></LocalParticipant>
						</div>
					</JoinMeeting>
				)}
				{isActive && (
					<>
						<ParticipantsGrid
							localVideoRef={this.localVideoRef}
							videoMute={videoMute}
							isSharingScreen={isSharingScreen}
							isLocalAudioMute={audioMute}
							twincode={twincode}
							participants={participants}
							isIdle={CallStatusOps.isIdle(status)}
							guestNameError={guestNameError}
							muteVideoClick={this.onMuteVideoClick}
							videoClick={this.onVideoClick}
							mode={displayMode}
							pushMessage={this.pushMessage}
							items={items}
						/>
						<CallButtons
							className={"absolute-button-list"}
							status={status}
							callbacks={this}
							audioMute={audioMute}
							hasVideo={twincode.video}
							videoMute={videoMute}
							isSharingScreen={isSharingScreen}
							transfer={false}
						/>
					</>
				)}
				{!initializing && CallStatusOps.isTerminated(status) && terminateReason && (
					<div className="flex w-full flex-1 items-center justify-center text-center">
						<span>
							<Trans
								i18nKey={this.getTerminateReasonMessage(terminateReason)}
								values={{
									contactName: twincode?.name,
									...ContactService.getScheduleLabels(twincode?.schedule),
								}}
								t={t}
							/>
						</span>
					</div>
				)}

				<Alert
					title={alertTitle}
					isOpen={alertOpen}
					content={alertContent}
					onClose={() => this.setState({ alertOpen: false })}
				/>
			</div>
		);
	}
}
const MeetWithParams = () => {
	const { t } = useTranslation();
	const { id } = useParams();
	const navigate = useNavigate();
	return <Meet id={id!} t={t} navigate={navigate} />;
};

export default MeetWithParams;
