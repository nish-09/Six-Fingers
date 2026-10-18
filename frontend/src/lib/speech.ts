// Multilingual Browser Speech Synthesis commentary manager

export type CommentaryLang = "en" | "hi" | "mr" | "gu";

class SpeechCommentaryManager {
  private isEnabled: boolean = true;
  private currentLang: CommentaryLang = "en";
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  public setLanguage(lang: CommentaryLang) {
    this.currentLang = lang;
  }

  public getLanguage(): CommentaryLang {
    return this.currentLang;
  }

  public toggleSpeech(): boolean {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    return this.isEnabled;
  }

  public isSpeechEnabled(): boolean {
    return this.isEnabled;
  }

  public speak(textMap: { [key: string]: string } | string) {
    if (!this.isEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const textToSpeak = typeof textMap === "string" ? textMap : (textMap[this.currentLang] || textMap["en"] || "");
    if (!textToSpeak) return;

    // Cancel any previous queued speech to keep commentary fresh and responsive
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.05; // Energetic cricket commentator cadence
    utterance.pitch = 1.1;

    // Pick suitable voice
    const langPrefix = this.currentLang === "en" ? "en" : this.currentLang;
    const matchingVoice = this.voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
  }
}

export const speechManager = new SpeechCommentaryManager();
