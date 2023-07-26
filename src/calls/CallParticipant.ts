/*
 *  Copyright (c) 2022-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twinlife-systems.com)
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 *   Fabrice Trescartes (Fabrice.Trescartes@twin.life)
 */
import { CallConnection } from "./CallConnection";

/**
 * A participant in an Audio or Video call.
 *
 * To support group calls in different architectures, a CallParticipant is separated from the CallConnection.
 *
 * We have to be careful that a participant can be one of our contact (in which case we know it) but it
 * can be a user that is not part of our contact list.  In that case, the name and avatar are not directly
 * known and they are provided by other means.
 *
 * The participant has:
 *
 * - a name, a description, an avatar,
 * - a SurfaceViewRenderer when the video is active and we receive the participant video stream,
 * - a set of audio/video status information
 * @class
 */
export class CallParticipant {
	static readonly LOG_TAG: string = "CallParticipant";

	static readonly DEBUG: boolean = false;

	private mParticipantId: number = 0;
	private mConnection: CallConnection | null;
	private mAvatarUrl: string | null = null;
	private mName: string | null;
	private mDescription: string | null;
	private mTransfer: boolean;
	private mRemoteRenderer: HTMLVideoElement | null = null;
	private mAudioMute: boolean = false;
	private mCameraMute: boolean = false;
	private mVideoWidth: number = 0;
	private mVideoHeight: number = 0;
	private mediaStream: MediaStream = new MediaStream();

	/**
	 * Get the call connection associated with this participant.
	 *
	 * @return {CallConnection} the call connection.
	 */
	public getCallConnection(): CallConnection | null {
		return this.mConnection;
	}

	/**
	 * Check if this participant supports P2P group calls.
	 *
	 * @return {boolean} NULL if we don't know, TRUE if P2P group calls are supported.
	 */
	public isGroupSupported(): boolean | null {
		return this.mConnection ? this.mConnection.isGroupSupported() : null;
	}

	/**
	 * Get the remote renderer for this peer connection.
	 *
	 * @return {*} the remote renderer or null if this peer connection has no video.
	 */
	public getRemoteRenderer(): HTMLVideoElement | null {
		return this.mRemoteRenderer;
	}

	/**
	 * Returns true if the peer has the audio muted.
	 *
	 * @return {boolean} true if the peer has the audio muted.
	 */
	public isAudioMute(): boolean {
		return this.mAudioMute;
	}

	/**
	 * Returns true if the peer has the video muted.
	 *
	 * @return {boolean} true if the peer has the video muted.
	 */
	public isCameraMute(): boolean {
		return this.mCameraMute;
	}

	/**
	 * Get the participant name (it could come from the Contact but also provided by other means for group calls).
	 *
	 * @return {string} the participant name.
	 */
	public getName(): string | null {
		return this.mName;
	}

	/**
	 * Get the participant description (it could come from the Contact but also provided by other means for group calls).
	 *
	 * @return {string} the participant description.
	 */
	public getDescription(): string | null {
		return this.mDescription;
	}

	/**
	 * Get the participant avatar (it could come from the Contact but also provided by other means for group calls).
	 *
	 * When not null, it can be assigned to an image.src
	 *
	 * @return {string} the participant avatar.
	 */
	public getAvatarUrl(): string | null {
		return this.mAvatarUrl;
	}

	/**
	 * Get a unique id that identifies this participant for the duration of the call.
	 *
	 * @return {number} the participant id.
	 */
	public getParticipantId(): number {
		return this.mParticipantId;
	}

	/**
	 * Get remote video width
	 *
	 * @return {number} video width
	 */
	public getVideoWidth(): number {
		return this.mVideoWidth;
	}

	/**
	 * Get remote video height
	 *
	 * @return {number} video height
	 */
	public getVideoHeight(): number {
		return this.mVideoHeight;
	}

	/**
	 * Get the peer connection id associated with this participant.
	 *
	 * @return {UUID} the peer connection id or null.
	 */
	public getPeerConnectionId(): string | null {
		return this.mConnection ? this.mConnection.getPeerConnectionId() : null;
	}

	/**
	 * Set the video and audio renderer (HTMLVideoElement) for this participant.
	 * Then affect the participant mediaStream to its srcObject
	 */
	public setRemoteRenderer(remoteRenderer: HTMLVideoElement) {
		this.mRemoteRenderer = remoteRenderer;
		this.mRemoteRenderer.srcObject = this.mediaStream;
		console.log("Set remote renderer for participant");
	}

	public addTrack(track: MediaStreamTrack) {
		this.mediaStream.addTrack(track);
	}

	constructor(callConnection: CallConnection | null, participantId: number) {
		this.mConnection = callConnection;
		this.mAvatarUrl = null;
		this.mName = null;
		this.mDescription = null;
		this.mAudioMute = true;
		this.mCameraMute = true;
		this.mVideoWidth = 0;
		this.mVideoHeight = 0;
		this.mParticipantId = participantId;
		this.mTransfer = false;
	}

	setMicrophoneMute(mute: boolean): void {
		this.mAudioMute = mute;
	}

	setCameraMute(mute: boolean): void {
		this.mCameraMute = mute;
	}

	setInformation(name: string, description: string | null, avatarUrl: string | null, transfer: boolean | undefined = undefined): void {
		this.mName = name;
		this.mDescription = description;
		this.mAvatarUrl = avatarUrl;
		if (transfer) {
			this.mTransfer = transfer;
		}
	}

	isTransfer(): boolean {
		return this.mTransfer;
	}

	/* setupVideo(localRenderer: any): boolean {

		if (this.mRemoteRenderer == null) {
			this.mConnection.getCall().setLocalRenderer(localRenderer);
		}
		return true;
	}*/

	/**
	 * Release the remote renderer when the connexion is destroyed.
	 */
	release(): void {
		let remoteRenderer: any = this.mRemoteRenderer;
		if (remoteRenderer != null) {
			this.mRemoteRenderer = null;
		}
	}

	public onFirstFrameRendered(): void {}

	public onFrameResolutionChanged(videoWidth: number, videoHeight: number, rotation: number): void {
		if (rotation === 90 || rotation === 270) {
			this.mVideoWidth = videoHeight;
			this.mVideoHeight = videoWidth;
		} else {
			this.mVideoWidth = videoWidth;
			this.mVideoHeight = videoHeight;
		}
	}
}
