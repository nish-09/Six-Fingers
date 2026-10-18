// WebRTC Peer-to-Peer Manager for Live Player Webcam and Audio

export interface WebRTCCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onSendSignal?: (type: string, payload: any) => void;
  onError?: (err: Error) => void;
}

export function getIceServers(): RTCConfiguration {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
    const turnConfig: RTCIceServer = {
      urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
    };
    if (process.env.NEXT_PUBLIC_TURN_USERNAME) {
      turnConfig.username = process.env.NEXT_PUBLIC_TURN_USERNAME;
    }
    if (process.env.NEXT_PUBLIC_TURN_CREDENTIAL) {
      turnConfig.credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
    }
    servers.push(turnConfig);
  }

  return { iceServers: servers };
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks = {};
  private isCaller: boolean = false;

  constructor(callbacks: WebRTCCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: WebRTCCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public async startLocalMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream | null> {
    try {
      if (this.localStream) {
        return this.localStream;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      });
      this.localStream = stream;
      return stream;
    } catch (err: any) {
      console.warn("Could not acquire media stream:", err);
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      return null;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public initializePeerConnection(isCaller: boolean) {
    this.isCaller = isCaller;
    if (this.pc) {
      this.pc.close();
    }

    this.pc = new RTCPeerConnection(getIceServers());

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.callbacks.onSendSignal) {
        this.callbacks.onSendSignal("RTC_ICE_CANDIDATE", event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.callbacks.onConnectionStateChange) {
        this.callbacks.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.callbacks.onRemoteStream) {
          this.callbacks.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Attach local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!);
      });
    }
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (err: any) {
      console.error("Error creating WebRTC offer:", err);
      return null;
    }
  }

  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) {
      this.initializePeerConnection(false);
    }
    if (!this.pc) return null;

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (err: any) {
      console.error("Error handling WebRTC offer:", err);
      return null;
    }
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err: any) {
      console.error("Error handling WebRTC answer:", err);
    }
  }

  public async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err: any) {
      console.error("Error adding ICE candidate:", err);
    }
  }

  public toggleAudio(enable?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enable !== undefined ? enable : !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  public toggleVideo(enable?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enable !== undefined ? enable : !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  public cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
  }
}
