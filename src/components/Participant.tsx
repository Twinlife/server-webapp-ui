/*
 *  Copyright (c) 2021-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */
import React, { Component, RefObject } from "react";
import { CallParticipant } from "../calls/CallParticipant";

interface Props {
    participant: CallParticipant;
}

type State = {
    audioMute: boolean;
    videoMute: boolean;
    label: string;
};

export default class Participant extends Component<Props, State> {
    private remoteVideo: RefObject<HTMLVideoElement>;
    private participant: CallParticipant;
    private mounted: boolean;

    constructor(props: Props) {
        super(props);
        this.remoteVideo = React.createRef();
        this.participant = props.participant;
        this.mounted = false;
        this.state = {
            audioMute: false,
            videoMute: false,
            label: "unkown"
        };
    }

    componentDidMount = () => {
        console.log("componentDidMount");

        this.mounted = true;
        if (this.remoteVideo.current) {
            this.participant.setRemoteRenderer(this.remoteVideo.current);
        }
    };

    componentWillUmount = () => {

        this.mounted = false;
    }

    updateParticipant = () => {

        const audioMuted = this.participant.isAudioMute();
        const videoMuted = this.participant.isCameraMute();
        const label = this.participant.getName();
        this.setState({ audioMute: audioMuted, videoMute: videoMuted, label: label ? label : "No name" });
    }

    render() {
        const audioMuted = this.participant.isAudioMute();
        const videoMuted = this.participant.isCameraMute();
        const label = this.participant.getName();
        let avatarUrl = this.participant.getAvatarUrl();
        console.log("Participant " + this.participant.getParticipantId() + " is " + label + " with " + avatarUrl);
        // const audioMuted = this.state.audioMute;
        // const videoMuted = this.state.videoMute;
        // const label = this.state.label;

        let className = "call-active";
        if (audioMuted) {
            className = className + " call-audio-muted";
        }
        let img;
        if (videoMuted) {
            className = className + " call-video-muted";
            if (!avatarUrl) {
                avatarUrl = '/icons/twinme/drawable/anonymous_avatar.png';
            }
            img = <div className='call-participant-avatar'><img alt='Contact avatar' src={avatarUrl} /></div>;
        }
        return <div className={className}>
                {img}
                <video className="remote-video-stream" ref={this.remoteVideo}
                       autoPlay={true} muted={false} playsInline>
                </video>
                <div className='call-participant-info'>
                    <div className='call-participant-name'><span>{label}</span><span className='call-participant-status' /></div>
                </div>
            </div>
    }
};
