// Web Audio API Real-Time Voice Processing & DSP Pipeline
// Modulates microphone stream and routes to WebRTC for remote multiplayer broadcast

export type VoicePresetId =
  | "normal"
  | "deep"
  | "high_pitch"
  | "robot"
  | "alien"
  | "radio"
  | "telephone"
  | "echo"
  | "monster";

export interface VoicePreset {
  id: VoicePresetId;
  name: string;
  description: string;
  icon: string;
  badge?: string;
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "normal", name: "Natural Voice", description: "Original unmodified voice (clean bypass)", icon: "🎙️" },
  { id: "deep", name: "Deep Strikemaster", description: "Heavy bass boost & baritone resonance", icon: "🦁", badge: "POPULAR" },
  { id: "high_pitch", name: "Helium / Cartoon", description: "High-frequency formant peaking", icon: "🎈" },
  { id: "robot", name: "Cyber Dalek", description: "55Hz carrier ring modulation synth", icon: "🤖", badge: "CLASSIC" },
  { id: "alien", name: "Xenon Alien", description: "Dual-carrier frequency modulation & vibrato", icon: "👽" },
  { id: "radio", name: "Stadium Announcer", description: "Punchy broadcast bandpass & compression", icon: "📻" },
  { id: "telephone", name: "Vintage Telephone", description: "Narrow bandpass filter & analog crunch", icon: "☎️" },
  { id: "echo", name: "Colosseum Echo", description: "240ms stadium echo & feedback delay", icon: "🏟️" },
  { id: "monster", name: "Pitch Monster", description: "Dark sub-bass distortion & growl", icon: "👹" },
];

export class AudioEffectsManager {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private monitorGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private currentPreset: VoicePresetId = "normal";
  private intensity: number = 0.8;
  private isMonitoring: boolean = false;
  private activeNodes: AudioNode[] = [];
  private activeOscillators: OscillatorNode[] = [];

  constructor() {}

  public async init(rawMicStream: MediaStream): Promise<MediaStreamTrack | null> {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn("Web Audio API not supported in this browser");
        return rawMicStream.getAudioTracks()[0] || null;
      }

      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(rawMicStream);
      this.destinationNode = this.audioCtx.createMediaStreamDestination();

      // Analyser for real-time mic volume level
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 64;

      // Monitor Gain for local preview (player listening to their own voice)
      this.monitorGain = this.audioCtx.createGain();
      this.monitorGain.gain.value = 0.0; // muted by default to prevent feedback!
      this.monitorGain.connect(this.audioCtx.destination);

      this.applyPreset(this.currentPreset);

      const tracks = this.destinationNode.stream.getAudioTracks();
      return tracks.length > 0 ? tracks[0] : null;
    } catch (err) {
      console.error("Error initializing AudioEffectsManager:", err);
      return rawMicStream.getAudioTracks()[0] || null;
    }
  }

  public setPreset(preset: VoicePresetId) {
    this.currentPreset = preset;
    this.applyPreset(preset);
  }

  public getPreset(): VoicePresetId {
    return this.currentPreset;
  }

  public setIntensity(val: number) {
    this.intensity = Math.max(0, Math.min(1, val));
    this.applyPreset(this.currentPreset);
  }

  public getIntensity(): number {
    return this.intensity;
  }

  public setMonitoring(enable: boolean) {
    this.isMonitoring = enable;
    if (this.monitorGain && this.audioCtx) {
      this.monitorGain.gain.setValueAtTime(enable ? 0.75 : 0.0, this.audioCtx.currentTime);
    }
  }

  public getMonitoring(): boolean {
    return this.isMonitoring;
  }

  public getMicLevel(): number {
    if (!this.analyserNode) return 0;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return Math.min(100, Math.round((sum / dataArray.length / 255) * 100));
  }

  public getProcessedTrack(): MediaStreamTrack | null {
    if (!this.destinationNode) return null;
    const tracks = this.destinationNode.stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  private cleanupActiveChain() {
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (_) {}
    });
    this.activeOscillators = [];

    this.activeNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch (_) {}
    });
    this.activeNodes = [];

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
    }
  }

  private applyPreset(preset: VoicePresetId) {
    if (!this.audioCtx || !this.sourceNode || !this.destinationNode) return;

    this.cleanupActiveChain();
    const ctx = this.audioCtx;

    // Connect source to analyser for volume meter
    if (this.analyserNode) {
      this.sourceNode.connect(this.analyserNode);
    }

    const connectToOutput = (lastNode: AudioNode) => {
      lastNode.connect(this.destinationNode!);
      if (this.monitorGain) {
        lastNode.connect(this.monitorGain);
      }
    };

    switch (preset) {
      case "normal": {
        connectToOutput(this.sourceNode);
        break;
      }

      case "deep": {
        // Deep Baritone: Low-shelf bass boost + high-cut
        const lowShelf = ctx.createBiquadFilter();
        lowShelf.type = "lowshelf";
        lowShelf.frequency.value = 220;
        lowShelf.gain.value = 14 * this.intensity;

        const lowPass = ctx.createBiquadFilter();
        lowPass.type = "lowpass";
        lowPass.frequency.value = 2000;

        this.sourceNode.connect(lowShelf);
        lowShelf.connect(lowPass);
        connectToOutput(lowPass);

        this.activeNodes = [lowShelf, lowPass];
        break;
      }

      case "high_pitch": {
        // Helium Formant Peaking
        const highPass = ctx.createBiquadFilter();
        highPass.type = "highpass";
        highPass.frequency.value = 900;

        const highShelf = ctx.createBiquadFilter();
        highShelf.type = "highshelf";
        highShelf.frequency.value = 2800;
        highShelf.gain.value = 15 * this.intensity;

        this.sourceNode.connect(highPass);
        highPass.connect(highShelf);
        connectToOutput(highShelf);

        this.activeNodes = [highPass, highShelf];
        break;
      }

      case "robot": {
        // Authentic Ring Modulation using OscillatorNode
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 52; // 52Hz classic metallic carrier
        osc.start();

        const modGain = ctx.createGain();
        modGain.gain.value = 1.0;

        osc.connect(modGain.gain);
        this.sourceNode.connect(modGain);
        connectToOutput(modGain);

        this.activeOscillators = [osc];
        this.activeNodes = [modGain];
        break;
      }

      case "alien": {
        // Dual-carrier frequency modulation & vibrato
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = 110;
        osc.start();

        const modGain = ctx.createGain();
        modGain.gain.value = 0.85;

        // LFO for extraterrestrial vibrato
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 7;
        lfo.start();

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 25;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(modGain.gain);
        this.sourceNode.connect(modGain);
        connectToOutput(modGain);

        this.activeOscillators = [osc, lfo];
        this.activeNodes = [modGain, lfoGain];
        break;
      }

      case "radio": {
        // Stadium Announcer Broadcast: Bandpass + Compression
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.frequency.value = 1600;
        bandpass.Q.value = 0.9;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 12;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        this.sourceNode.connect(bandpass);
        bandpass.connect(compressor);
        connectToOutput(compressor);

        this.activeNodes = [bandpass, compressor];
        break;
      }

      case "telephone": {
        // Narrowband vintage telephone filter
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1200;
        bp.Q.value = 3.2;

        const dist = ctx.createWaveShaper();
        dist.curve = this.createDistortionCurve(15) as any;

        this.sourceNode.connect(bp);
        bp.connect(dist);
        connectToOutput(dist);

        this.activeNodes = [bp, dist];
        break;
      }

      case "echo": {
        // Stadium delay & feedback
        const delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.24;

        const feedback = ctx.createGain();
        feedback.gain.value = 0.42 * this.intensity;

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.7;

        this.sourceNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wetGain);

        const merger = ctx.createGain();
        this.sourceNode.connect(merger);
        wetGain.connect(merger);
        connectToOutput(merger);

        this.activeNodes = [delay, feedback, wetGain, merger];
        break;
      }

      case "monster": {
        // Low growl + heavy distortion
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 750;

        const shaper = ctx.createWaveShaper();
        shaper.curve = this.createDistortionCurve(45) as any;

        this.sourceNode.connect(shaper);
        shaper.connect(lowpass);
        connectToOutput(lowpass);

        this.activeNodes = [shaper, lowpass];
        break;
      }
    }
  }

  private createDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === "number" ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public cleanup() {
    this.cleanupActiveChain();
    if (this.monitorGain) {
      try {
        this.monitorGain.disconnect();
      } catch (_) {}
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
  }
}

export const globalAudioEffects = new AudioEffectsManager();
