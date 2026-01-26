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
import { Trans, useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { CallStatusOps } from "../calls/CallStatus";
import Alert from "../components/Alert";
import Header from "../components/Header";
import InitializationPanel from "../components/InitializationPanel";
import Thanks from "../components/Thanks";
import { CallButtons } from "../components/CallButtons";
import { Call } from "./Call.tsx";
import JoinMeeting from "../components/JoinMeeting.tsx";
import { LocalParticipant } from "../components/LocalParticipant";
import { ParticipantsGrid } from "../components/ParticipantsGrid";

const DEBUG = import.meta.env.VITE_APP_DEBUG === "true";
const TRANSFER = import.meta.env.VITE_APP_TRANSFER === "true";

class Meet extends Call {
	render() {
		const { id, t } = this.props;
		const {
			initializing,
			guestName,
			guestNameError,
			twincode,
			videoMute,
			audioMute,
			status,
			participants,
			displayMode,
			terminateReason,
			displayThanks,
			audioDevices,
			videoDevices,
			usedAudioDevice,
			usedVideoDevice,
			isSharingScreen,
			chatPanelOpened,
			items,
			atLeastOneParticipantSupportsMessages,
			messageNotificationDisplayed,
			alertOpen,
			alertTitle,
			alertContent,
		} = this.state;

		if (displayThanks) {
			return <Thanks onCallBackClick={this.init} />;
		}

		const callType = twincode.transfer ? i18n.t("transfer") : i18n.t("call");

		document.title = i18n.t("title", {
			appName: import.meta.env.VITE_APP_NAME,
			callType: callType,
			linkName: twincode.name,
		});

		return (
			<div className="flex flex-col h-full w-screen bg-black portrait:p-4 landscape:p-2 landscape:lg:p-4">
				<Header
					messageNotificationDisplayed={messageNotificationDisplayed}
					openChatButtonDisplayed={
						!initializing && CallStatusOps.isActive(status) && atLeastOneParticipantSupportsMessages
					}
					openChatPanel={() =>
						this.setState({ chatPanelOpened: !chatPanelOpened, messageNotificationDisplayed: false })
					}
				/>

				{!CallStatusOps.isActive(status) && (
					<JoinMeeting
						className="flex flex-row"
						twincode={twincode}
						status={status}
						title={twincode.name ? twincode.name : "?"}
						guestName={guestName}
						setGuestName={this.updateGuestName}
						buttons={
							<CallButtons
								status={status}
								callbacks={this}
								audioMute={audioMute}
								hasVideo={twincode.video}
								videoMute={videoMute}
								audioDevices={audioDevices}
								videoDevices={videoDevices}
								usedAudioDevice={usedAudioDevice}
								usedVideoDevice={usedVideoDevice}
								isSharingScreen={isSharingScreen}
								selectAudioDevice={this.selectAudioDevice}
								selectVideoDevice={this.selectVideoDevice}
								transfer={TRANSFER || twincode.transfer}
								hasCallButton={false}
							/>
						}
						onStartClick={this.onCallClick}
						onCancelClick={this.onTerminateClick}
					>
						<div className="flex-1 h-full w-full overflow-hidden">
							{initializing && (
								<InitializationPanel
									twincodeId={id}
									twincode={twincode}
									onComplete={(twincode) => {
										this.setState({ twincode, initializing: false });
									}}
								/>
							)}

							<LocalParticipant
								localVideoRef={this.localVideoRef}
								localMediaStream={this.callService.getMediaStream()}
								localAbsolute={true}
								videoMute={videoMute && !isSharingScreen}
								isLocalAudioMute={false}
								isIdle={true}
								isScreenSharing={isSharingScreen}
								enableVideo={true}
								guestName={guestName}
								guestNameError={guestNameError}
								setGuestName={this.updateGuestName}
								updateGuestName={this.updateGuestName}
								muteVideoClick={this.onMuteVideoClick}
							></LocalParticipant>
						</div>
					</JoinMeeting>
				)}
				{CallStatusOps.isActive(status) && (
					<>
						<ParticipantsGrid
							chatPanelOpened={chatPanelOpened}
							closeChatPanel={() => this.setState({ chatPanelOpened: false })}
							localVideoRef={this.localVideoRef}
							localMediaStream={this.callService.getMediaStream()}
							videoMute={videoMute}
							isSharingScreen={isSharingScreen}
							isLocalAudioMute={audioMute}
							twincode={twincode}
							participants={participants}
							isIdle={CallStatusOps.isIdle(status)}
							guestName={guestName}
							guestNameError={guestNameError}
							setGuestName={this.updateGuestName}
							updateGuestName={this.updateGuestName}
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
							audioDevices={audioDevices}
							videoDevices={videoDevices}
							usedAudioDevice={usedAudioDevice}
							usedVideoDevice={usedVideoDevice}
							isSharingScreen={isSharingScreen}
							selectAudioDevice={this.selectAudioDevice}
							selectVideoDevice={this.selectVideoDevice}
							transfer={TRANSFER || twincode.transfer}
							hasCallButton={true}
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
