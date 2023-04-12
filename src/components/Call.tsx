/*
 *  Copyright (c) 2021-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import React, { Component } from "react";
import { ContactService, TwincodeInfo } from '../services/ContactService';
import { PeerCallService } from '../services/PeerCallService';
import { CallParticipant } from '../calls/CallParticipant';
import { CallParticipantEvent } from '../calls/CallParticipantEvent';
import { CallParticipantObserver } from '../calls/CallParticipantObserver';
import { CallService } from "../calls/CallService";
import { CallStatus, CallStatusOps } from "../calls/CallStatus";
import { CallObserver } from "../calls/CallObserver";
import Participant from "./Participant";
import { RouteComponentProps, withRouter } from "react-router";
import 'react-confirm-alert/src/react-confirm-alert.css';
import config from "../config.json";

interface RouteParams {
    id: string
}

interface Props extends RouteComponentProps<RouteParams> {
}

type State = {
    twincode: TwincodeInfo;
    status: CallStatus;
    audioMute: boolean;
    videoMute: boolean;
    terminateReason: string | null;
    participants: Array<CallParticipant>;
};

class Call extends Component<Props, State> implements CallParticipantObserver, CallObserver {
    private contactService: ContactService;
    private peerCallService: PeerCallService;
    private callService: CallService;
    private localVideoElement : HTMLVideoElement | null;
    private twincodeId: string | null;

    constructor(props: Props) {
        super(props);
        this.contactService = new ContactService();
        this.peerCallService = new PeerCallService();
        this.callService = new CallService(this.peerCallService, this, this);
        this.localVideoElement = null;
        this.twincodeId = null;
        this.state = {
            status: CallStatus.TERMINATED,
            twincode: {
                name: null,
                description: null,
                avatarId: null,
                capabilities: null
            },
            audioMute: false,
            videoMute: false,
            terminateReason: null,
            participants: []
        };
    }
	/**
	 * The call status was changed.
	 *
	 * @param {CallStatus} status the new call status.
	 */
	onUpdateCallStatus(status: CallStatus): void {

        console.log("New call status " + status);

        this.setState({status: status});
    }

    /**
     * Called when the call is terminated.
     *
     * @param reason the call termination reason.
     */
    onTerminateCall(reason: string): void {

        console.log("Call terminated " + reason);

        this.setState({terminateReason: reason, status: CallStatus.TERMINATED});
    }

    /**
	 * A new participant is added to the call group.
	 *
	 * @param {CallParticipant} participant the participant.
	 */
	onAddParticipant(participant: CallParticipant): void {

        console.log("Add new participant " + participant);

        let participants : Array<CallParticipant> = this.callService.getParticipants();
        this.setState({participants: participants});
    }

	/**
	 * One or several participants are removed from the call.
	 *
	 * @param {CallParticipant[]} participants the list of participants being removed.
	 */
	onRemoveParticipants(participants: Array<CallParticipant>): void {

        console.log("Remove participants ");
        let list : Array<CallParticipant> = this.callService.getParticipants();
        this.setState({participants: list});
    }

	/**
	 * An event occurred for the participant and its state was changed.
	 *
	 * @param {CallParticipant} participant the participant.
	 * @param {CallParticipantEvent} event the event that occurred.
	 */
	onEventParticipant(participant: CallParticipant, event: CallParticipantEvent): void {

        console.log("Participant event: " + event);

        let participants : Array<CallParticipant> = this.callService.getParticipants();
        this.setState({participants: participants});
    }

    reverseDisplay : React.MouseEventHandler<HTMLVideoElement> = (ev: React.MouseEvent<HTMLVideoElement>) => {
        /* if (this.remoteVideoElement && this.localVideoElement) {
            this.remoteVideoElement.pause();
            this.localVideoElement.pause();

            const stream = this.remoteVideoElement.srcObject;
            this.remoteVideoElement.srcObject = this.localVideoElement.srcObject;
            this.localVideoElement.srcObject = stream;
        }*/

        this.tryPlay();
    }

    retrieveInformation() {
        const id = this.props.match.params.id;

        this.twincodeId = id;
        this.contactService.getTwincode(id).then(response => {
            this.setState({ twincode: response.data })

        }).catch(e => {
            console.log(e);
        });

        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        }).then((mediaStream: MediaStream) => {
            console.log("Media stream " + mediaStream);
            if (this.localVideoElement) {
                this.localVideoElement.srcObject = mediaStream;
            }
            this.callService.setMediaStream(mediaStream);

        }).catch(error => {
            console.log(error);
        });
    }

    componentDidMount = () => {
        console.log("componentDidMount");

        this.localVideoElement = document.getElementById("local-video") as HTMLVideoElement;
        this.retrieveInformation();
    };

    tryPlay = () => {
        /* if (this.remoteVideoElement && this.localVideoElement) {
            this.remoteVideoElement.play().catch(() => setTimeout(this.tryPlay, 250));
            this.localVideoElement.play().catch(() => setTimeout(this.tryPlay, 250));
        }*/
    };

    handleTerminateClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {

        ev.preventDefault();

        this.callService.actionTerminateCall("success");
        // this.setState({sessionId: null, signalingState: "closed", connectionState: "closed", terminateReason: null });
    }

    muteAudioClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {

        ev.preventDefault();
        let audioMute = !this.state.audioMute;
        this.setState({ audioMute: audioMute });

        this.callService.actionAudioMute(audioMute);
    }

    muteVideoClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {

        ev.preventDefault();
        let videoMute = !this.state.videoMute;
        this.setState({ videoMute: videoMute });

        this.callService.actionCameraMute(videoMute);
    }

    handleCallClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
        const id = this.props.match.params.id;

        if (!this.twincodeId || !id) {
            return;
        }

        let video : boolean = !this.state.videoMute;
        let identityName = "Joe";
        let fakeImage = new ArrayBuffer(0);
        this.callService.actionOutgoingCall(this.twincodeId, video, identityName, fakeImage);
        ev.preventDefault();
    };

    renderParticipant(participant: CallParticipant) {

        return <Participant key={participant.getParticipantId()} participant={participant} />
    }

    render() {
        const twincode = this.state.twincode;
        const status = this.state.status;
        const audioMuted = this.state.audioMute;
        const videoMuted = this.state.videoMute;
        const terminateReason = this.state.terminateReason;
        const participants = this.state.participants;

        let invitation;
        let className;

        let defActions = <ul>
                <li>
                    <div onClick={this.muteAudioClick} className='call-mute-audio'></div>
                </li>
                <li>
                    <div onClick={this.muteVideoClick} className='call-mute-video'></div>
                </li>
                <li>
                    <div onClick={this.handleTerminateClick} className='call-terminate'></div>
                </li>
            </ul>
        if (CallStatusOps.isTerminated(status)) {
            className = "call call-inactive call-terminated";
        } else if (CallStatusOps.isActive(status)) {
            className = "call call-active";
        } else {
            className = "call call-active";
        }
        if (audioMuted) {
            className = className + " call-audio-muted";
        }
        if (videoMuted) {
            className = className + " call-video-muted";
        }

        if (twincode && twincode.name) {
            let callAction;

            if (!CallStatusOps.isTerminated(status)) {
                callAction = '';
            } else {
                callAction = <div onClick={this.handleCallClick} className='call-button'>Call</div>
            }
            invitation = <div className='invitation'>
                <div className='invitation-contact'>
                    <div className='invitation-image'>
                        <img alt='Contact avatar' src={`${config.rest_url}/images/${twincode.avatarId}`} />
                    </div>
                    <h2>{twincode.name}</h2>
                </div>
                <div className=''>
                    {terminateReason}
                </div>
                <div className='call-actions'>
                    {defActions}
                </div>
                {callAction}
            </div>
        } else {
            invitation = <div className='invitation'>No invitation</div>
        }

        /*                 {participants.map((participant) => this.renderParticipant(participant))} */
        let participantVideo;
        if (participants.length === 1) {
            let participant = participants[0];
            participantVideo = <Participant key={participant.getParticipantId()} participant={participant} />
        } else {
            participantVideo = '';
        }
        return <div className={className}>
            {invitation}
            <div id='video-container'>
                {participantVideo}
                <video id="local-video" className="local-video-stream" onClick={this.reverseDisplay} autoPlay muted={false} playsInline></video>
            </div>
            </div>
    }
};

export default withRouter(Call);