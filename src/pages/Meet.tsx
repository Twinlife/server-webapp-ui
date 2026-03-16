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
import { Notifications } from "../notifications/Notifications";
import { ContactService } from "../services/ContactService";

export class Meet extends Call {
	private videoBackground: VirtualBackground | null = null;

	public init = () => {
		super.init();

		this.videoBackground = new VirtualBackground(this.callService);
	};

	setVideoTrack = (mediaStream: MediaStreamTrack, isScreenSharing: boolean) => {
		this.videoBackground?.setVideoTrack(mediaStream, isScreenSharing);
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
								allowCall={true}
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
							allowCall={true}
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
