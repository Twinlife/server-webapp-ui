/*
 *  Copyright (c) 2021-2026 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Olivier Dupont (olivier.dupont@twin.life)
 *   Romain Kolb (romain.kolb@skyrock.com)
 */
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
import { chatStore } from "../stores/chat";
import { Notifications } from "../notifications/Notifications";
import { backgroundStore } from "../stores/backgrounds";

export class Meet extends Call {
	private videoBackground: VirtualBackground | null = null;

	public init = () => {
		super.init();

		// If the virtual background setting was changed, update the effect.
		subscribe(backgroundStore, () => {
			if (this.videoBackground) {
				const background = backgroundStore.background;
				const backgroundPath = background > 0 ? "/backgrounds/" + background + ".webp" : "";
				this.videoBackground.setBackground(backgroundPath);
			}
		});
	}

	setVideoTrack = (mediaStream: MediaStreamTrack, isScreenSharing: boolean) => {
		const background = backgroundStore.background;
		if (isScreenSharing || background == null || background < 0) {
			this.callService.setVideoTrack(new VideoTrack(mediaStream, null), isScreenSharing);
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
			atLeastOneParticipantSupportsMessages,
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

		return (
			<div className="flex flex-col h-full w-screen overflow-hidden bg-black portrait:p-4 landscape:p-2 landscape:lg:p-4">
				<Header
					openChatButtonDisplayed={
						!initializing && CallStatusOps.isActive(status) && atLeastOneParticipantSupportsMessages
					}
					openChatPanel={() => {
						chatStore.chatPanelOpened = !chatStore.chatPanelOpened;
					}}
				/>
				<Notifications />

				{!CallStatusOps.isActive(status) && (
					<JoinMeeting
						className="flex flex-row"
						initializing={initializing}
						twincodeId={id}
						twincode={twincode}
						status={status}
						title={twincode.name ? twincode.name : "?"}
						buttons={
							<CallButtons
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
							this.setState({ twincode, initializing: false });
						}}
					>
						<div className="flex-1 h-full w-full overflow-hidden">
							<LocalParticipant
								localVideoRef={this.localVideoRef}
								localMediaStream={this.callService.getMediaStream()}
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
				{CallStatusOps.isActive(status) && (
					<>
						<ParticipantsGrid
							localVideoRef={this.localVideoRef}
							localMediaStream={this.callService.getMediaStream()}
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
									...this.getScheduleLabels(twincode?.schedule),
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
