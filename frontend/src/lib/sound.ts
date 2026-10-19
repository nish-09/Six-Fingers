// Synthesized Web Audio Cricket Sound Effects & Stadium Atmosphere Engine
// Completely offline, zero-latency, realistic arcade and Indian cricket stadium sound design.
// Zero external copyright/broadcast audio, 100% original procedural synthesis.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;

  private isMuted: boolean = false;
  private masterVolume: number = 0.8;
  private sfxVolume: number = 0.85;
  private ambienceVolume: number = 0.35;

  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceFilter: BiquadFilterNode | null = null;
  private isAmbiencePlaying: boolean = false;
  private isDucked: boolean = false;

  constructor() {
    this.loadPreferences();
  }

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.ambienceGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.ambienceGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.applyVolumes();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  private loadPreferences() {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("sixfingers_sound_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.masterVolume === "number") this.masterVolume = parsed.masterVolume;
        if (typeof parsed.sfxVolume === "number") this.sfxVolume = parsed.sfxVolume;
        if (typeof parsed.ambienceVolume === "number") this.ambienceVolume = parsed.ambienceVolume;
        if (typeof parsed.isMuted === "boolean") this.isMuted = parsed.isMuted;
      }
    } catch (_) {}
  }

  private savePreferences() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "sixfingers_sound_settings",
        JSON.stringify({
          masterVolume: this.masterVolume,
          sfxVolume: this.sfxVolume,
          ambienceVolume: this.ambienceVolume,
          isMuted: this.isMuted,
        })
      );
    } catch (_) {}
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.applyVolumes();
    this.savePreferences();
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.applyVolumes();
    this.savePreferences();
  }

  public setAmbienceVolume(vol: number) {
    this.ambienceVolume = Math.max(0, Math.min(1, vol));
    this.applyVolumes();
    this.savePreferences();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.applyVolumes();
    this.savePreferences();
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public getAmbienceVolume(): number {
    return this.ambienceVolume;
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.masterGain) {
      const targetMaster = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setValueAtTime(targetMaster, now);
    }

    if (this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, now);
    }

    if (this.ambienceGain) {
      const targetAmb = this.isDucked ? this.ambienceVolume * 0.2 : this.ambienceVolume;
      this.ambienceGain.gain.setValueAtTime(targetAmb, now);
    }
  }

  /**
   * Smoothly ducks background stadium crowd audio while commentary speaks.
   */
  public duckAmbience(isDucked: boolean) {
    this.isDucked = isDucked;
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const target = isDucked ? this.ambienceVolume * 0.2 : this.ambienceVolume;
    this.ambienceGain.gain.cancelScheduledValues(now);
    this.ambienceGain.gain.linearRampToValueAtTime(target, now + 0.2);
  }

  // 1. Button Click / UI Pop
  public playClick() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 2. Countdown Tick (3... 2... 1...)
  public playTick(isLast: boolean = false) {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "triangle";
    const freq = isLast ? 880 : 440;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 3. Bat-hit (Wood crack)
  public playBatHit() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;

    // High transient snap
    const snap = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snap.type = "square";
    snap.frequency.setValueAtTime(1200, now);
    snap.frequency.exponentialRampToValueAtTime(180, now + 0.04);
    snapGain.gain.setValueAtTime(0.6, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    snap.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snap.start(now);
    snap.stop(now + 0.05);

    // Resonant wooden body tone
    const wood = this.ctx.createOscillator();
    const woodGain = this.ctx.createGain();
    wood.type = "triangle";
    wood.frequency.setValueAtTime(320, now);
    wood.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    woodGain.gain.setValueAtTime(0.8, now);
    woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    wood.connect(woodGain);
    woodGain.connect(this.sfxGain);
    wood.start(now);
    wood.stop(now + 0.13);
  }

  // 4. Dot Ball (Defensive block thud + whoosh)
  public playDotBall() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;

    // Air whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);

    // Solid defensive block thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = "triangle";
    thud.frequency.setValueAtTime(220, now);
    thud.frequency.exponentialRampToValueAtTime(70, now + 0.1);
    thudGain.gain.setValueAtTime(0.5, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    thud.connect(thudGain);
    thudGain.connect(this.sfxGain);
    thud.start(now);
    thud.stop(now + 0.11);
  }

  // 5. Single / 2 / 3 Runs (Crisp wood tap + running footsteps chime)
  public playSingleRun() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    this.playBatHit();

    // Two quick footsteps / running chimes (C5, G5)
    [523.25, 783.99].forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.13);
      }, (idx + 1) * 110);
    });
  }

  // 6. Four Fanfare (Boundary celebration + crowd applause)
  public playFourFanfare() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    this.playBatHit();
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.26);
      }, idx * 80);
    });
    this.playCrowdCheer(1.2);
  }

  // 7. Six Fanfare (Maximum fanfare + stadium cheer)
  public playSixFanfare() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    this.playBatHit();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.36);
      }, idx * 75);
    });
    this.playCrowdCheer(1.8);
  }

  // 8. Wicket Crash (Timber stumps impact + sub thud + crowd reaction)
  public playWicket() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;

    // Timber crash noise buffer
    const bufferSize = this.ctx.sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(750, now);
    filter.Q.setValueAtTime(2.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);

    // Deep sub impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.28);
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.29);

    // Crowd shock & cheer
    this.playCrowdCheer(1.6);
  }

  // 9. Appeal (Rising stadium swell / "HOWZAT" atmosphere)
  public playAppeal() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.4);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(2000, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  // 10. Coin Toss Chime
  public playTossCoin() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(2600, now + 0.3);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.51);
  }

  // 11. Innings Transition (Ceremonial gong & ascending harmonics)
  public playInningsTransition() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Deep resonant gong
    const gong = this.ctx.createOscillator();
    const gongGain = this.ctx.createGain();
    gong.type = "sine";
    gong.frequency.setValueAtTime(185, now);
    gong.frequency.exponentialRampToValueAtTime(140, now + 1.2);

    gongGain.gain.setValueAtTime(0.6, now);
    gongGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    gong.connect(gongGain);
    gongGain.connect(this.sfxGain);
    gong.start(now);
    gong.stop(now + 1.25);

    // Harmonious chime
    [440, 659.25, 880].forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const chime = this.ctx.createOscillator();
        const cg = this.ctx.createGain();
        chime.type = "sine";
        chime.frequency.setValueAtTime(freq, t);
        cg.gain.setValueAtTime(0.2, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        chime.connect(cg);
        cg.connect(this.sfxGain);
        chime.start(t);
        chime.stop(t + 0.65);
      }, idx * 100);
    });
  }

  // 12. Crowd Cheer (Stadium atmosphere)
  public playCrowdCheer(durationSec: number = 2.0) {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastVal = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastVal = (lastVal + (0.02 * white)) / 1.02;
      data[i] = lastVal * 3.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.01, now + durationSec);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  // 13. Match Victory Fanfare
  public playVictory() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const melody = [
      { note: 523.25, duration: 0.15 }, // C5
      { note: 659.25, duration: 0.15 }, // E5
      { note: 783.99, duration: 0.15 }, // G5
      { note: 1046.50, duration: 0.4 }, // C6
      { note: 880.00, duration: 0.15 }, // A5
      { note: 1046.50, duration: 0.6 }  // C6
    ];

    let delay = 0;
    melody.forEach(({ note, duration }) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(note, now);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      }, delay * 1000);
      delay += duration + 0.04;
    });

    this.playCrowdCheer(3.0);
  }
}

export const soundEngine = new SoundEngine();
