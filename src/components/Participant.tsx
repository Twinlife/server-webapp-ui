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
            videoMute: false
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

    render() {
        // const audioMuted = this.state.audioMute;
        // const videoMuted = this.state.videoMute;

        let className = "call-active";
        return <div className={className}>
                <video className="remote-video-stream" ref={this.remoteVideo}
                       autoPlay={true} muted={false} playsInline>
                </video>
            </div>
    }
};
