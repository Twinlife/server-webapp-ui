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
import { CallService, CallServiceObserver, TransportCandidate } from '../services/CallService';
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
    sessionId: string | null;
    signalingState: RTCSignalingState | null;
    connectionState: RTCIceConnectionState | null;
    gatheringState: RTCIceGatheringState | null;
    audioMute: boolean;
    videoMute: boolean;
    terminateReason: string | null;
};

class Call extends Component<Props, State> implements CallServiceObserver {
    private contactService: ContactService;
    private callService: CallService;
    private pc : RTCPeerConnection | null;
    private localMediaStream : MediaStream | null;
    private localVideoElement : HTMLVideoElement | null;
    private remoteVideoElement : HTMLVideoElement | null;
    private sessionId: string | null;
    private twincodeId: string | null;
    private icePending : Array<RTCIceCandidate> | null;
    private renegotiationNeeded : Boolean;
    private makingOffer : Boolean;
    private audioTrack : MediaStreamTrack | null;
    private videoTrack : MediaStreamTrack | null;

    constructor(props: Props) {
        super(props);
        this.contactService = new ContactService();
        this.callService = new CallService();
        this.pc = null;
        this.localMediaStream = null;
        this.remoteVideoElement = null;
        this.localVideoElement = null;
        this.sessionId = null;
        this.twincodeId = null;
        this.icePending = null;
        this.renegotiationNeeded = false;
        this.makingOffer = false;
        this.audioTrack = null;
        this.videoTrack = null;
        this.callService.setObserver(this);
        this.state = {
            twincode: {
                name: null,
                description: null,
                avatarId: null,
                capabilities: null
            },
            sessionId: null,
            signalingState: "closed",
            connectionState: "closed",
            gatheringState: null,
            audioMute: false,
            videoMute: false,
            terminateReason: null
        };
    }

    onSessionInitiate(to: string, sessionId: string) : void {

        console.log("session-initiate created " + sessionId);
        this.sessionId = sessionId;
        this.setState({ sessionId: sessionId });
        if (this.icePending && this.icePending.length > 0) {

            for (var candidate of this.icePending) {
                if (candidate.candidate && candidate.sdpMid != null && candidate.sdpMLineIndex != null) {
                    this.callService.transportInfo(this.sessionId, candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex);
                }
            }
        }
        this.icePending = null;
    }

    onSessionAccept(sessionId: string, sdp: string, offer: string, offerToReceive: string) : void {

        console.log("P2P " + sessionId + " is accepted for " + offer);
        if (!this.pc) {
            this.callService.sessionTerminate(sessionId, "gone");
            return;
        }

        this.pc.setRemoteDescription({
             sdp: sdp,
             type: "answer"
        }).then(() => {
            console.log("Set remote is done");

        }).catch((error : any) => {
            console.log("Set remote failed: " + error);

        });
    }

    onSessionUpdate(sessionId: string, updateType: string, sdp: string) : void {

        console.log("P2P " + sessionId + "update " + updateType);
        if (!this.pc) {
            this.callService.sessionTerminate(sessionId, "gone");
            return;
        }

        const type : RTCSdpType = updateType === "offer" ? "offer" : "answer";
        this.pc.setRemoteDescription({
            sdp: sdp,
            type: type
        });
    }

    onTransportInfo(sessionId: string, candidates: TransportCandidate[]) : void {

        console.log("transport-info " + sessionId + " candidates: " + candidates);
        if (!this.pc) {
            this.callService.sessionTerminate(sessionId, "gone");
            return;
        }

        for (var candidate of candidates) {
            if (!candidate.removed) {
                let startPos : number = candidate.candidate.indexOf(" ufrag ") + 7;
                let endPos : number = candidate.candidate.indexOf(" ", startPos);
                let ufrag : string = candidate.candidate.substring(startPos, endPos);
                let c : RTCIceCandidateInit = {
                    candidate: candidate.candidate,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: candidate.sdpMLineIndex,
                    usernameFragment: ufrag
                };

                let ice : RTCIceCandidate = new RTCIceCandidate(c);
                console.log("Adding candidate " + c.candidate + " label=" + c.sdpMid + " id=" + c.sdpMLineIndex
                 + " ufrag=" + ice.usernameFragment);
                this.pc.addIceCandidate(ice).then(() => {
                    console.log("Add ice candidate ok " + JSON.stringify(ice.toJSON()));
                }, err => {
                    console.log("Add ice candidate error: " + err);
                }
                );
            }
        }
    }

    onSessionTerminate(sessionId: string, reason: string): void {

        console.log("session " + sessionId + " terminated with " + reason);
        if (this.pc) {
            this.pc.close();
            this.pc = null;
            this.setState({sessionId: null, signalingState: "closed", connectionState: "closed", terminateReason: reason });
        }
    }

    reverseDisplay : React.MouseEventHandler<HTMLVideoElement> = (ev: React.MouseEvent<HTMLVideoElement>) => {
        if (this.remoteVideoElement && this.localVideoElement) {
            this.remoteVideoElement.pause();
            this.localVideoElement.pause();

            const stream = this.remoteVideoElement.srcObject;
            this.remoteVideoElement.srcObject = this.localVideoElement.srcObject;
            this.localVideoElement.srcObject = stream;
        }

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
            this.localMediaStream = mediaStream;
            console.log("Media stream " + mediaStream);
            if (this.localVideoElement) {
                this.localVideoElement.srcObject = mediaStream;
            }
            mediaStream.getTracks().forEach(track => {
                console.log("Found track " + track.id);
            });

        }).catch(error => {
            console.log(error);
        });
    }

    componentDidMount = () => {
        console.log("componentDidMount");

        this.localVideoElement = document.getElementById("local-video") as HTMLVideoElement;
        this.remoteVideoElement = document.getElementById("remote-video") as HTMLVideoElement;
        this.retrieveInformation();
    };

    tryPlay = () => {
        if (this.remoteVideoElement && this.localVideoElement) {
            this.remoteVideoElement.play().catch(() => setTimeout(this.tryPlay, 250));
            this.localVideoElement.play().catch(() => setTimeout(this.tryPlay, 250));
        }
    };

    handleTerminateClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {

        ev.preventDefault();

        if (this.sessionId) {
            this.callService.sessionTerminate(this.sessionId, "success");
            this.sessionId = null;
        }
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        this.setState({sessionId: null, signalingState: "closed", connectionState: "closed", terminateReason: null });
    }

    muteAudioClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {

        ev.preventDefault();
        let audioMute = !this.state.audioMute;
        this.setState({ audioMute: audioMute });

        if (this.pc) {
            let transceivers : RTCRtpTransceiver[] = this.pc.getTransceivers();
            for (var transceiver of transceivers) {
                let sender : RTCRtpSender = transceiver.sender;
                if (sender.track && sender.track.kind === "audio") {
                    this.renegotiationNeeded = true;
                    transceiver.direction = audioMute ? "recvonly" : "sendrecv";
                }
            }
        }
    }

    muteVideoClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {

        ev.preventDefault();
        let videoMute = !this.state.videoMute;
        this.setState({ videoMute: videoMute });

        if (this.pc) {
            let transceivers : RTCRtpTransceiver[] = this.pc.getTransceivers();
            for (var transceiver of transceivers) {
                let sender : RTCRtpSender = transceiver.sender;
                if (sender.track && sender.track.kind === "video") {
                    this.renegotiationNeeded = true;
                    transceiver.direction = videoMute ? "recvonly" : "sendrecv";
                }
            }
        }
    }

    handleCallClick : React.MouseEventHandler<HTMLDivElement> = (ev: React.MouseEvent<HTMLDivElement>) => {
        const id = this.props.match.params.id;

        if (this.pc || !this.twincodeId || !id) {
            return;
        }

        let config : RTCConfiguration = this.callService.getConfiguration();
        const pc : RTCPeerConnection = new RTCPeerConnection(config);
        this.pc = pc;
        this.sessionId = null;
        this.icePending = [];
        this.setState({terminateReason: null});

        pc.oniceconnectionstatechange = (event: Event) => {
            console.log("oniceconnectionstatechange change " + event);
            this.setState({connectionState: pc.iceConnectionState});
        };
        pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            const candidate : RTCIceCandidate | null = event.candidate;
            if (!candidate || !this.pc || !candidate.candidate) {
                return;
            }
            console.log("Local ICE='" + candidate?.candidate + "' label=" + candidate?.sdpMid + " id=" + candidate?.sdpMLineIndex);
            if (!this.sessionId) {
                this.icePending?.push(candidate);
                return;
            }

            if (candidate.candidate && candidate.sdpMid != null && candidate.sdpMLineIndex != null) {
                this.callService.transportInfo(this.sessionId, candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex);
            }
        };
        pc.onicecandidateerror = (event: Event) => {
            console.log("ice candidate error: " + event);
        };
        pc.onicegatheringstatechange = (event: Event) => {
            console.log("ice gathering change " + event.target);
            this.setState({
                signalingState: pc.signalingState,
                gatheringState: pc.iceGatheringState,
                connectionState: pc.iceConnectionState
            });
        };
        pc.onnegotiationneeded = (event: Event) => {
            console.log("on negotiation needed");
            if (!this.renegotiationNeeded || !this.pc) {
                return;
            }
            this.renegotiationNeeded = false;
            this.makingOffer = true;
            this.pc.setLocalDescription().then(() => {
                this.makingOffer = false;
                if (this.pc && this.sessionId) {
                    let description : RTCSessionDescription | null = this.pc.localDescription;
                    if (description) {
                        this.callService.sessionUpdate(this.sessionId, description.sdp, "offer");
                    }
                }
            }).catch();
        };
        pc.ontrack = (event : RTCTrackEvent) => {
            console.log("Received on track event");
            if (this.remoteVideoElement) {
                this.remoteVideoElement.srcObject = event.streams[0];
            }
        };
        const localStream : MediaStream | null = this.localMediaStream;
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log("Adding local stream track id=" + track.id + " kind=" + track.kind);
                if (track.kind === "audio") {
                    this.audioTrack = track;
                    if (!this.state.audioMute) {
                        pc.addTrack(track, localStream);
                    }
                } else if (track.kind == "video") {
                    this.videoTrack = track;
                    if (!this.state.videoMute) {
                        pc.addTrack(track, localStream)
                    }
                }
            });
        }
        const offerOptions : RTCOfferOptions = {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        };
        const offer = this.state.videoMute ? "audio" : "video";
        // let dataChannel : RTCDataChannel = pc.createDataChannel("MyApp Channel");
        pc.createOffer(offerOptions).then((description: RTCSessionDescriptionInit) => {
            console.log("SDP " + description.sdp);
            pc.setLocalDescription(description).then(() => {
                if (this.twincodeId && description.sdp) {
                    console.log("sending session-initiate with " + offer);
                    this.callService.sessionInitiate(this.twincodeId, description.sdp, offer);
                }
            }).catch((reason: any) => {
                console.log("setLocalDescription failed: " + reason);
            });
            console.log("setLocalDescription is done");
        }).catch((reason: any) => {
            console.error("createOffer failed: " + reason);
        });
        //dataChannel.onopen = (channel : RTCDataChannel, event : Event) => {
        //    console.error("Data chanel opened");
        //};
        console.log("createOffer is done");
        ev.preventDefault();
    };

    render() {
        const twincode = this.state.twincode;
        const sessionId = this.state.sessionId;
        const signalingState = this.state.signalingState;
        const connectionState = this.state.connectionState;
        const iceGatheringState = this.state.gatheringState;
        const audioMuted = this.state.audioMute;
        const videoMuted = this.state.videoMute;
        const terminateReason = this.state.terminateReason;

        let invitation;
        let className;
        let callActions;

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
        if (!this.pc) {
            callActions = <div onClick={this.handleCallClick} className='call-button'>Call</div>
        } else if (connectionState === "completed") {
            callActions = <div onClick={this.handleTerminateClick} className='call-button'>Hangup</div>
        } else {
            callActions = <div onClick={this.handleTerminateClick} className='call-button'>Cancel</div>
        }
        if (this.pc) {
            className = "call call-active";
        } else if (terminateReason) {
            className = "call call-inactive call-terminated";
        } else {
            className = "call call-inactive";
        }
        if (audioMuted) {
            className = className + " call-audio-muted";
        }
        if (videoMuted) {
            className = className + " call-video-muted";
        }

        if (twincode && twincode.name) {
            let callAction;

            if (this.pc) {
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

        let status;
        if (sessionId) {
            status = <div className='status'>
                <dl>
                    <dt>Session</dt>
                    <dd>{sessionId}</dd>
                    <dt>Signaling</dt>
                    <dd>{signalingState}</dd>
                    <dt>Connection</dt>
                    <dd>{connectionState}</dd>
                    <dt>Ice gathering</dt>
                    <dd>{iceGatheringState}</dd>
                </dl>
            </div>
        } else {
            status = <div className='status'>
                    <dt>Session</dt>
                    <dd>None</dd>
                    <dt>Signaling</dt>
                    <dd>-</dd>
                    <dt>Connection</dt>
                    <dd>-</dd>
                    <dt>Ice gathering</dt>
                    <dd>-</dd>
            </div>
        }

        return <div className={className}>
            {invitation}
            <div id='video-container'>
                <video id="remote-video" className="remote-video-stream" autoPlay muted={false} playsInline></video>
                <video id="local-video" className="local-video-stream" onClick={this.reverseDisplay} autoPlay muted={false} playsInline></video>
            </div>
            {status}
            </div>
    }
};

export default withRouter(Call);