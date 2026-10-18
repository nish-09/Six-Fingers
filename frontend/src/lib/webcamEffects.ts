// Real-Time Canvas Webcam Effects & Video Processing Pipeline
// Renders 30 FPS filter animations onto an offscreen canvas and exposes a MediaStreamTrack for WebRTC transmission

export type WebcamEffectId =
  | "none"
  | "alien"
  | "robot"
  | "sunglasses"
  | "crown"
  | "cat_ears"
  | "devil_horns"
  | "angel_halo"
  | "neon_glow"
  | "glitch"
  | "cricket_helmet"
  | "ball_orbit"
  | "six_frame"
  | "fire_frame"
  | "stars"
  | "confetti"
  | "lightning"
  | "bg_blur"
  | "neon_arena";

export interface EffectCategory {
  id: string;
  name: string;
  effects: {
    id: WebcamEffectId;
    name: string;
    description: string;
    icon: string;
    badge?: string;
  }[];
}

export const EFFECT_CATEGORIES: EffectCategory[] = [
  {
    id: "face",
    name: "Face & Characters",
    effects: [
      { id: "alien", name: "Alien & UFO", description: "Radioactive alien tint & hovering UFO beam", icon: "👽", badge: "POPULAR" },
      { id: "robot", name: "Cyber Robot", description: "High-tech targeting visor & HUD telemetry", icon: "🤖" },
      { id: "sunglasses", name: "Pixel Shades", description: "8-bit thug life sunglasses & gold chain", icon: "🕶️" },
      { id: "crown", name: "Royal Crown", description: "Golden jeweled champion crown with sparkles", icon: "👑" },
      { id: "cat_ears", name: "Neon Cat Ears", description: "Glowing cyberpunk feline ears", icon: "🐱" },
      { id: "devil_horns", name: "Devil Horns", description: "Fiery red horns with smoke embers", icon: "😈" },
      { id: "angel_halo", name: "Angel Halo", description: "Luminous radiant golden halo", icon: "😇" },
    ],
  },
  {
    id: "cricket",
    name: "Cricket Specials",
    effects: [
      { id: "cricket_helmet", name: "Batting Helmet", description: "Tournament pro batting helmet with grill", icon: "🏏", badge: "EXCLUSIVE" },
      { id: "ball_orbit", name: "Orbiting Ball", description: "Spinning red cricket ball orbiting your head", icon: "🔴" },
      { id: "six_frame", name: "6-Hitter Frame", description: "Pulsing neon six-hitter marquee border", icon: "💥" },
    ],
  },
  {
    id: "fun",
    name: "Fun & Ambient",
    effects: [
      { id: "neon_glow", name: "Neon Matrix", description: "Electric cyan & magenta edge glow", icon: "✨" },
      { id: "glitch", name: "RGB Glitch", description: "Cyberpunk chromatic aberration & scanlines", icon: "⚡" },
      { id: "fire_frame", name: "Inferno Flames", description: "Animated burning fire borders", icon: "🔥" },
      { id: "stars", name: "Floating Stars", description: "Twinkling golden star particles", icon: "⭐" },
      { id: "confetti", name: "Party Confetti", description: "Celebratory shower of colorful confetti", icon: "🎉" },
      { id: "lightning", name: "Thunderbolts", description: "Crackling electric lightning arcs", icon: "⚡" },
    ],
  },
  {
    id: "background",
    name: "Atmosphere",
    effects: [
      { id: "neon_arena", name: "Neon Stadium", description: "Cyber floodlights & arena perimeter", icon: "🏟️" },
      { id: "bg_blur", name: "Soft Cinema", description: "Cinematic focal vignette spotlight", icon: "🎬" },
    ],
  },
];

export class WebcamEffectsPipeline {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private videoEl: HTMLVideoElement | null = null;
  private activeEffect: WebcamEffectId = "none";
  private animId: number | null = null;
  private processedStream: MediaStream | null = null;
  private startTime: number = Date.now();
  private particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; color: string; life: number }> = [];

  constructor(width: number = 640, height: number = 480) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.initParticles();
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        size: Math.random() * 6 + 3,
        color: ["#FFD900", "#F000A8", "#9BE52E", "#6500C8", "#00FFFF"][Math.floor(Math.random() * 5)],
        life: Math.random(),
      });
    }
  }

  public setVideoSource(videoElement: HTMLVideoElement) {
    this.videoEl = videoElement;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getProcessedTrack(): MediaStreamTrack | null {
    if (!this.processedStream) {
      try {
        this.processedStream = this.canvas.captureStream(30);
      } catch (err) {
        console.warn("captureStream not supported:", err);
        return null;
      }
    }
    const tracks = this.processedStream.getVideoTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  public setEffect(effect: WebcamEffectId) {
    this.activeEffect = effect;
  }

  public getActiveEffect(): WebcamEffectId {
    return this.activeEffect;
  }

  public start() {
    if (this.animId !== null) return;
    const render = () => {
      this.drawFrame();
      this.animId = requestAnimationFrame(render);
    };
    this.animId = requestAnimationFrame(render);
  }

  public stop() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private drawFrame() {
    if (!this.ctx || !this.videoEl || this.videoEl.readyState < 2) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = (Date.now() - this.startTime) / 1000;

    // Draw base video frame
    this.ctx.save();
    // Horizontal mirror for webcam self-view
    this.ctx.translate(w, 0);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(this.videoEl, 0, 0, w, h);
    this.ctx.restore();

    if (this.activeEffect === "none") return;

    // Render active filter overlay
    switch (this.activeEffect) {
      case "alien":
        this.renderAlienEffect(w, h, t);
        break;
      case "robot":
        this.renderRobotEffect(w, h, t);
        break;
      case "sunglasses":
        this.renderSunglassesEffect(w, h, t);
        break;
      case "crown":
        this.renderCrownEffect(w, h, t);
        break;
      case "cat_ears":
        this.renderCatEarsEffect(w, h, t);
        break;
      case "devil_horns":
        this.renderDevilHornsEffect(w, h, t);
        break;
      case "angel_halo":
        this.renderAngelHaloEffect(w, h, t);
        break;
      case "neon_glow":
        this.renderNeonGlowEffect(w, h, t);
        break;
      case "glitch":
        this.renderGlitchEffect(w, h, t);
        break;
      case "cricket_helmet":
        this.renderCricketHelmetEffect(w, h, t);
        break;
      case "ball_orbit":
        this.renderBallOrbitEffect(w, h, t);
        break;
      case "six_frame":
        this.renderSixFrameEffect(w, h, t);
        break;
      case "fire_frame":
        this.renderFireFrameEffect(w, h, t);
        break;
      case "stars":
        this.renderStarsEffect(w, h, t);
        break;
      case "confetti":
        this.renderConfettiEffect(w, h, t);
        break;
      case "lightning":
        this.renderLightningEffect(w, h, t);
        break;
      case "bg_blur":
        this.renderBgBlurEffect(w, h, t);
        break;
      case "neon_arena":
        this.renderNeonArenaEffect(w, h, t);
        break;
    }
  }

  // --- FILTER IMPLEMENTATIONS ---

  private renderAlienEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Subtle green alien tint
    ctx.fillStyle = "rgba(40, 255, 100, 0.12)";
    ctx.fillRect(0, 0, w, h);

    // Hovering UFO with beam
    const ufoX = w / 2 + Math.sin(t * 1.5) * 40;
    const ufoY = 50 + Math.cos(t * 2) * 8;

    // Tractor beam cone
    const grad = ctx.createLinearGradient(ufoX, ufoY + 15, ufoX, h);
    grad.addColorStop(0, "rgba(50, 255, 120, 0.4)");
    grad.addColorStop(1, "rgba(50, 255, 120, 0.0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ufoX - 15, ufoY + 15);
    ctx.lineTo(ufoX + 15, ufoY + 15);
    ctx.lineTo(w * 0.75, h);
    ctx.lineTo(w * 0.25, h);
    ctx.closePath();
    ctx.fill();

    // UFO Saucer
    ctx.fillStyle = "#16161F";
    ctx.strokeStyle = "#9BE52E";
    ctx.lineWidth = 3;
    // Dome
    ctx.beginPath();
    ctx.arc(ufoX, ufoY - 2, 18, Math.PI, 0);
    ctx.fillStyle = "#9BE52E";
    ctx.fill();
    ctx.stroke();

    // Saucer Body
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.ellipse(ufoX, ufoY + 8, 45, 12, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Saucer Lights
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = (Math.floor(t * 6) + i) % 2 === 0 ? "#FFD900" : "#F000A8";
      ctx.beginPath();
      ctx.arc(ufoX + i * 11, ufoY + 8, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  private renderRobotEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Cyan Cyber Grid & Reticle
    ctx.strokeStyle = "rgba(0, 255, 255, 0.6)";
    ctx.lineWidth = 2;

    const cx = w / 2;
    const cy = h * 0.42;

    // Visor crosshairs
    ctx.strokeRect(cx - 90, cy - 25, 180, 50);

    // Reticle brackets
    const bLen = 20;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(cx - 100, cy - 35 + bLen);
    ctx.lineTo(cx - 100, cy - 35);
    ctx.lineTo(cx - 100 + bLen, cy - 35);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(cx + 100 - bLen, cy - 35);
    ctx.lineTo(cx + 100, cy - 35);
    ctx.lineTo(cx + 100, cy - 35 + bLen);
    ctx.stroke();

    // Laser scanline
    const scanY = (t * 180) % h;
    ctx.fillStyle = "rgba(0, 255, 255, 0.25)";
    ctx.fillRect(0, scanY, w, 3);

    // HUD Text
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#00FFFF";
    ctx.fillText("CYBER_CRIC // SYNC: 99.4%", 25, 35);
    ctx.fillText("TARGET: BATSMAN LOCKED", 25, 52);
    ctx.fillText("STRIKE_PROB: 88.2%", w - 170, 35);
  }

  private renderSunglassesEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const cx = w / 2;
    const cy = h * 0.38 + Math.sin(t * 3) * 2;

    // Black 8-bit shades
    ctx.fillStyle = "#000000";
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;

    // Left lens
    ctx.fillRect(cx - 75, cy - 18, 65, 36);
    ctx.strokeRect(cx - 75, cy - 18, 65, 36);

    // Right lens
    ctx.fillRect(cx + 10, cy - 18, 65, 36);
    ctx.strokeRect(cx + 10, cy - 18, 65, 36);

    // Bridge
    ctx.fillRect(cx - 12, cy - 10, 24, 10);

    // White glare pixels
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(cx - 65, cy - 10, 16, 6);
    ctx.fillRect(cx - 50, cy - 2, 8, 6);
    ctx.fillRect(cx + 20, cy - 10, 16, 6);
    ctx.fillRect(cx + 35, cy - 2, 8, 6);

    // Gold chain badge
    ctx.fillStyle = "#FFD900";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("THUG SIX ⚡", cx - 45, cy + 50);
  }

  private renderCrownEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const cx = w / 2;
    const cy = h * 0.16 + Math.sin(t * 2.5) * 6;

    ctx.save();
    ctx.translate(cx, cy);

    // Crown Base
    ctx.fillStyle = "#FFD900";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(-70, 20);
    ctx.lineTo(-65, -30); // Left peak
    ctx.lineTo(-30, -5);
    ctx.lineTo(0, -50); // Center peak
    ctx.lineTo(30, -5);
    ctx.lineTo(65, -30); // Right peak
    ctx.lineTo(70, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Base band
    ctx.fillStyle = "#6500C8";
    ctx.fillRect(-68, 12, 136, 12);
    ctx.strokeRect(-68, 12, 136, 12);

    // Jewels
    ctx.fillStyle = "#F000A8";
    ctx.beginPath();
    ctx.arc(0, -32, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#9BE52E";
    ctx.beginPath();
    ctx.arc(-45, -18, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(45, -18, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Sparkles
    for (let i = 0; i < 4; i++) {
      const angle = t * 3 + i * (Math.PI / 2);
      const dist = 65 + Math.sin(t * 4 + i) * 15;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * (dist * 0.4);

      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(sx, sy, 3 + Math.sin(t * 5 + i) * 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderCatEarsEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h * 0.18 + Math.sin(t * 2) * 3;

    // Left Ear
    ctx.fillStyle = "#111111";
    ctx.strokeStyle = "#F000A8";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(cx - 95, cy + 20);
    ctx.lineTo(cx - 75, cy - 45);
    ctx.lineTo(cx - 25, cy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Left Inner Pink
    ctx.fillStyle = "#F000A8";
    ctx.beginPath();
    ctx.moveTo(cx - 85, cy + 15);
    ctx.lineTo(cx - 72, cy - 32);
    ctx.lineTo(cx - 40, cy + 8);
    ctx.closePath();
    ctx.fill();

    // Right Ear
    ctx.fillStyle = "#111111";
    ctx.strokeStyle = "#F000A8";
    ctx.beginPath();
    ctx.moveTo(cx + 95, cy + 20);
    ctx.lineTo(cx + 75, cy - 45);
    ctx.lineTo(cx + 25, cy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Inner Pink
    ctx.fillStyle = "#F000A8";
    ctx.beginPath();
    ctx.moveTo(cx + 85, cy + 15);
    ctx.lineTo(cx + 72, cy - 32);
    ctx.lineTo(cx + 40, cy + 8);
    ctx.closePath();
    ctx.fill();
  }

  private renderDevilHornsEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h * 0.2;

    ctx.fillStyle = "#E50020";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 3;

    // Left Horn
    ctx.beginPath();
    ctx.moveTo(cx - 80, cy);
    ctx.quadraticCurveTo(cx - 95, cy - 60, cx - 110, cy - 70 + Math.sin(t * 4) * 4);
    ctx.quadraticCurveTo(cx - 65, cy - 35, cx - 45, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Horn
    ctx.beginPath();
    ctx.moveTo(cx + 80, cy);
    ctx.quadraticCurveTo(cx + 95, cy - 60, cx + 110, cy - 70 + Math.sin(t * 4) * 4);
    ctx.quadraticCurveTo(cx + 65, cy - 35, cx + 45, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private renderAngelHaloEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h * 0.12 + Math.sin(t * 2) * 5;

    ctx.save();
    ctx.shadowColor = "#FFD900";
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "#FFFEAA";
    ctx.lineWidth = 10;

    ctx.beginPath();
    ctx.ellipse(cx, cy, 70, 18, 0, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  private renderNeonGlowEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Glowing border frame
    ctx.save();
    ctx.shadowColor = (Math.floor(t * 2) % 2 === 0) ? "#00FFFF" : "#F000A8";
    ctx.shadowBlur = 25;
    ctx.strokeStyle = "#00FFFF";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.restore();
  }

  private renderGlitchEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Horizontal chromatic slice
    if (Math.sin(t * 10) > 0.4) {
      const sliceY = (Math.sin(t * 7) * 0.5 + 0.5) * h;
      const sliceH = 20 + Math.random() * 25;
      const shiftX = (Math.random() - 0.5) * 20;

      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 100, 0.35)";
      ctx.fillRect(0, sliceY, w, sliceH);
      ctx.fillStyle = "rgba(0, 255, 255, 0.35)";
      ctx.fillRect(shiftX, sliceY + 3, w, sliceH);
      ctx.restore();
    }

    // Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2);
    }
  }

  private renderCricketHelmetEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h * 0.22;

    ctx.save();
    ctx.translate(cx, cy);

    // Blue Helmet Shell
    ctx.fillStyle = "#0A255C";
    ctx.strokeStyle = "#FFD900";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.arc(0, 0, 95, Math.PI * 0.85, Math.PI * 0.15, false);
    ctx.lineTo(60, 40);
    ctx.lineTo(-60, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Visor Grill Bars
    ctx.strokeStyle = "#C0C0C0";
    ctx.lineWidth = 3;
    for (let y = 35; y <= 85; y += 15) {
      ctx.beginPath();
      ctx.moveTo(-50, y);
      ctx.lineTo(50, y);
      ctx.stroke();
    }

    // Helmet Logo
    ctx.fillStyle = "#FFD900";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("SIX 🏏", -22, -20);

    ctx.restore();
  }

  private renderBallOrbitEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const cx = w / 2;
    const cy = h * 0.38;
    const rx = w * 0.4;
    const ry = h * 0.18;

    const angle = t * 2.8;
    const bx = cx + Math.cos(angle) * rx;
    const by = cy + Math.sin(angle) * ry;
    const ballScale = (Math.sin(angle) * 0.3 + 1.0) * 16;

    // Ball shadow trail
    ctx.fillStyle = "rgba(255, 50, 50, 0.3)";
    ctx.beginPath();
    ctx.arc(bx - Math.cos(angle) * 8, by - Math.sin(angle) * 4, ballScale * 0.8, 0, 2 * Math.PI);
    ctx.fill();

    // Red Cricket Ball
    ctx.fillStyle = "#D61A2A";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(bx, by, ballScale, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // White Seam
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, ballScale * 0.7, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  }

  private renderSixFrameEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.strokeStyle = "#FFD900";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = "#111111";
    ctx.fillRect(w / 2 - 80, 0, 160, 26);
    ctx.strokeStyle = "#FFD900";
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - 80, 0, 160, 26);

    ctx.fillStyle = (Math.floor(t * 4) % 2 === 0) ? "#FFD900" : "#F000A8";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("⚡ 6-HITTER ARENA ⚡", w / 2 - 72, 18);
  }

  private renderFireFrameEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Blazing bottom fire tongues
    ctx.save();
    for (let x = 0; x < w; x += 30) {
      const fh = 40 + Math.sin(t * 8 + x * 0.2) * 20;
      const grad = ctx.createLinearGradient(x, h, x, h - fh);
      grad.addColorStop(0, "rgba(255, 30, 0, 0.8)");
      grad.addColorStop(0.6, "rgba(255, 180, 0, 0.7)");
      grad.addColorStop(1, "rgba(255, 240, 0, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - 15, h);
      ctx.lineTo(x + 15, h);
      ctx.lineTo(x, h - fh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderStarsEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.fillStyle = "#FFD900";
    this.particles.forEach((p) => {
      p.y += p.vy;
      p.x += p.vx;
      if (p.y < 0) {
        p.y = h;
        p.x = Math.random() * w;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 2);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
  }

  private renderConfettiEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.particles.forEach((p) => {
      p.y -= p.vy * 1.5; // fall down
      p.x += Math.sin(t * 3 + p.y * 0.05) * 1.5;
      if (p.y > h) {
        p.y = 0;
        p.x = Math.random() * w;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size * 1.5, p.size);
    });
  }

  private renderLightningEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    if (Math.sin(t * 9) > 0.6) {
      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(60, 80);
      ctx.lineTo(40, 90);
      ctx.lineTo(90, 170);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w - 20, 0);
      ctx.lineTo(w - 70, 70);
      ctx.lineTo(w - 50, 85);
      ctx.lineTo(w - 110, 180);
      ctx.stroke();
    }
  }

  private renderBgBlurEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Cinematic spotlight vignette
    const radGrad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.65);
    radGrad.addColorStop(0, "rgba(0,0,0,0)");
    radGrad.addColorStop(1, "rgba(0,0,0,0.65)");

    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, w, h);
  }

  private renderNeonArenaEffect(w: number, h: number, t: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.strokeStyle = "#6500C8";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Corner floodlights
    ctx.fillStyle = "#9BE52E";
    ctx.beginPath();
    ctx.arc(20, 20, 12, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(w - 20, 20, 12, 0, 2 * Math.PI);
    ctx.fill();
  }
}
