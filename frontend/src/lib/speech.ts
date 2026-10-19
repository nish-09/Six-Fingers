// Indian-Style Speech Synthesis Commentary Manager
// Features authentic voice prioritization (en-IN, hi-IN), expressive modulation,
// volume ducking of stadium ambience, and local persistence.

import { soundEngine } from "./sound";

export type CommentaryLang = "en" | "hi" | "mr" | "gu";

class SpeechCommentaryManager {
  private isEnabled: boolean = true;
  private currentLang: CommentaryLang = "en";
  private volume: number = 0.9;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.loadPreferences();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  private loadPreferences() {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("sixfingers_speech_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.isEnabled === "boolean") this.isEnabled = parsed.isEnabled;
        if (typeof parsed.volume === "number") this.volume = parsed.volume;
        if (parsed.currentLang) this.currentLang = parsed.currentLang;
      }
    } catch (_) {}
  }

  private savePreferences() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "sixfingers_speech_settings",
        JSON.stringify({
          isEnabled: this.isEnabled,
          volume: this.volume,
          currentLang: this.currentLang,
        })
      );
    } catch (_) {}
  }

  public setLanguage(lang: CommentaryLang) {
    this.currentLang = lang;
    this.savePreferences();
  }

  public getLanguage(): CommentaryLang {
    return this.currentLang;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.savePreferences();
  }

  public getVolume(): number {
    return this.volume;
  }

  public toggleSpeech(): boolean {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      soundEngine.duckAmbience(false);
    }
    this.savePreferences();
    return this.isEnabled;
  }

  public isSpeechEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Selects an authentic Indian accent voice when available.
   * Prioritizes en-IN / hi-IN and known Indian TTS voices.
   */
  private getBestVoice(targetLang: CommentaryLang): SpeechSynthesisVoice | null {
    if (!this.voices || this.voices.length === 0) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        this.voices = window.speechSynthesis.getVoices();
      }
    }
    if (!this.voices || this.voices.length === 0) return null;

    const indianKeywords = [
      "en-in", "en_in", "hi-in", "hi_in", "india", "hindi",
      "neerja", "prabhat", "heera", "ravi", "veena", "kalpana", "geeta"
    ];

    if (targetLang === "en") {
      // 1. Look for English (India) voices specifically
      const indianEnVoice = this.voices.find(v => {
        const langLower = v.lang.toLowerCase();
        const nameLower = v.name.toLowerCase();
        return (
          langLower.includes("en-in") ||
          langLower.includes("en_in") ||
          (langLower.startsWith("en") && indianKeywords.some(k => nameLower.includes(k)))
        );
      });
      if (indianEnVoice) return indianEnVoice;

      // Fallback to any English voice
      return this.voices.find(v => v.lang.toLowerCase().startsWith("en")) || null;
    }

    if (targetLang === "hi") {
      // Look for Hindi voice
      const hindiVoice = this.voices.find(v => {
        const langLower = v.lang.toLowerCase();
        const nameLower = v.name.toLowerCase();
        return (
          langLower.startsWith("hi") ||
          langLower.includes("hi-in") ||
          nameLower.includes("hindi") ||
          nameLower.includes("हिन्दी")
        );
      });
      if (hindiVoice) return hindiVoice;
    }

    // Generic match for other regional languages (mr, gu) or fallback
    return (
      this.voices.find(v => v.lang.toLowerCase().startsWith(targetLang)) ||
      this.voices.find(v => v.lang.toLowerCase().startsWith("en")) ||
      null
    );
  }

  public speak(textMap: { [key: string]: string } | string) {
    if (!this.isEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const textToSpeak = typeof textMap === "string" ? textMap : (textMap[this.currentLang] || textMap["en"] || "");
    if (!textToSpeak.trim()) return;

    try {
      // Cancel any previous queued speech to keep commentary fresh and responsive
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.volume = this.volume;

      // Dynamic rate and pitch modulation for cricket commentary excitement
      const upper = textToSpeak.toUpperCase();
      if (upper.includes("OUT") || upper.includes("WICKET") || upper.includes("SIX") || upper.includes("MAXIMUM")) {
        // Peak stadium moment: High energy, punchy delivery
        utterance.rate = 1.12;
        utterance.pitch = 1.25;
      } else if (upper.includes("FOUR") || upper.includes("BOUNDARY") || upper.includes("CHAUKA")) {
        // Boundary moment: brisk, energetic cadence
        utterance.rate = 1.08;
        utterance.pitch = 1.15;
      } else {
        // Standard delivery (single, dot ball, defense)
        utterance.rate = 1.04;
        utterance.pitch = 1.08;
      }

      // Pick Indian voice
      const voice = this.getBestVoice(this.currentLang);
      if (voice) {
        utterance.voice = voice;
      }

      // Ambience ducking
      utterance.onstart = () => {
        soundEngine.duckAmbience(true);
      };
      utterance.onend = () => {
        soundEngine.duckAmbience(false);
      };
      utterance.onerror = () => {
        soundEngine.duckAmbience(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      soundEngine.duckAmbience(false);
    }
  }
}

export const speechManager = new SpeechCommentaryManager();
