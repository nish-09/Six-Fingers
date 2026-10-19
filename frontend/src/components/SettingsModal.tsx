import React, { useState, useEffect } from "react";
import { X, Volume2, Sliders, Hand, MessageSquare, Zap, Eye, Check } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { speechManager, CommentaryLang } from "@/lib/speech";

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [masterVol, setMasterVol] = useState<number>(soundEngine.getVolume() * 100);
  const [sfxVol, setSfxVol] = useState<number>(soundEngine.getSfxVolume() * 100);
  const [commVol, setCommVol] = useState<number>(speechManager.getVolume() * 100);
  const [isSpeechOn, setIsSpeechOn] = useState<boolean>(speechManager.isSpeechEnabled());
  const [lang, setLang] = useState<CommentaryLang>(speechManager.getLanguage());

  // Bot Banter and Reduced Motion state
  const [isBotBanterOn, setIsBotBanterOn] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sixfingers_bot_banter_enabled");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sixfingers_reduced_motion");
      if (saved !== null) return saved === "true";
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  const handleMasterVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setMasterVol(newVol);
    soundEngine.setVolume(newVol / 100);
  };

  const handleSfxVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setSfxVol(newVol);
    soundEngine.setSfxVolume(newVol / 100);
  };

  const handleCommVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setCommVol(newVol);
    speechManager.setVolume(newVol / 100);
  };

  const handleSpeechToggle = () => {
    const on = speechManager.toggleSpeech();
    setIsSpeechOn(on);
    soundEngine.playClick();
  };

  const handleBotBanterToggle = () => {
    const nextVal = !isBotBanterOn;
    setIsBotBanterOn(nextVal);
    soundEngine.playClick();
    if (typeof window !== "undefined") {
      localStorage.setItem("sixfingers_bot_banter_enabled", String(nextVal));
    }
  };

  const handleReducedMotionToggle = () => {
    const nextVal = !isReducedMotion;
    setIsReducedMotion(nextVal);
    soundEngine.playClick();
    if (typeof window !== "undefined") {
      localStorage.setItem("sixfingers_reduced_motion", String(nextVal));
    }
  };

  const handleLangChange = (l: CommentaryLang) => {
    setLang(l);
    speechManager.setLanguage(l);
    soundEngine.playClick();
    speechManager.speak({
      en: "Commentary language set to Indian English broadcast!",
      hi: "कॉमेंट्री भाषा हिन्दी चुनी गई है! स्वागत है!",
      mr: "कॉमेंट्री भाषा मराठी निवडली आहे!",
      gu: "કોમેન્ટ્રી ભાષા ગુજરાતી પસંદ કરવામાં આવી છે!",
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="panel-brutal-white max-w-xl w-full p-5 sm:p-6 my-auto border-4 border-[#111111] shadow-brutal-xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-[#6500C8]" />
            <h2 className="text-2xl font-black font-display text-[#111111] uppercase tracking-wide">
              SETTINGS & ACCESSIBILITY
            </h2>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg border-2 border-black hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 1. Audio & SFX Controls */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <h3 className="font-display font-black text-sm uppercase text-[#111111] mb-2 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#F000A8]" />
              AUDIO & STADIUM SOUND DESIGN
            </h3>

            <div className="space-y-2.5">
              {/* Master Volume */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Master Volume:</span>
                  <span className="font-mono">{Math.round(masterVol)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={masterVol}
                  onChange={handleMasterVolChange}
                  className="w-full accent-[#6500C8] cursor-pointer"
                />
              </div>

              {/* SFX Volume */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Sound Effects Volume:</span>
                  <span className="font-mono">{Math.round(sfxVol)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sfxVol}
                  onChange={handleSfxVolChange}
                  className="w-full accent-[#9BE52E] cursor-pointer"
                />
              </div>

              {/* Sound Test Buttons */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-gray-700 block mb-1.5">
                  Test Procedural Stadium Sounds:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => soundEngine.playBatHit()}
                    className="btn-brutal-white text-xs px-2.5 py-1 rounded-lg"
                  >
                    🏏 Bat Hit
                  </button>
                  <button
                    onClick={() => soundEngine.playDotBall()}
                    className="btn-brutal-white text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800"
                  >
                    🛑 Dot Ball
                  </button>
                  <button
                    onClick={() => soundEngine.playSingleRun()}
                    className="btn-brutal-white text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900"
                  >
                    🏃 Single Run
                  </button>
                  <button
                    onClick={() => soundEngine.playFourFanfare()}
                    className="btn-brutal-green text-xs px-2.5 py-1 rounded-lg"
                  >
                    ⚡ Four (4)
                  </button>
                  <button
                    onClick={() => soundEngine.playSixFanfare()}
                    className="btn-brutal-pink text-xs px-2.5 py-1 rounded-lg"
                  >
                    🚀 Six (6)
                  </button>
                  <button
                    onClick={() => soundEngine.playWicket()}
                    className="btn-brutal-white text-xs px-2.5 py-1 rounded-lg bg-red-100 text-red-800"
                  >
                    ☝️ Wicket
                  </button>
                  <button
                    onClick={() => soundEngine.playAppeal()}
                    className="btn-brutal-white text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900"
                  >
                    🗣️ Howzat!
                  </button>
                  <button
                    onClick={() => soundEngine.playTossCoin()}
                    className="btn-brutal-yellow text-xs px-2.5 py-1 rounded-lg"
                  >
                    🪙 Coin Toss
                  </button>
                  <button
                    onClick={() => soundEngine.playInningsTransition()}
                    className="btn-brutal-purple text-xs px-2.5 py-1 rounded-lg"
                  >
                    🔔 Innings Gong
                  </button>
                  <button
                    onClick={() => soundEngine.playVictory()}
                    className="btn-brutal-yellow text-xs px-2.5 py-1 rounded-lg font-black"
                  >
                    🏆 Victory
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Indian AI Commentary Settings */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <h3 className="font-display font-black text-sm uppercase text-[#111111] mb-2 flex items-center justify-between">
              <span>INDIAN-STYLE CRICKET COMMENTARY</span>
              <button
                onClick={handleSpeechToggle}
                className={`text-xs font-black px-2.5 py-0.5 rounded-lg border-2 border-black ${
                  isSpeechOn ? "bg-[#9BE52E] text-black" : "bg-gray-200 text-gray-600"
                }`}
              >
                {isSpeechOn ? "ENABLED" : "MUTED"}
              </button>
            </h3>

            <div className="space-y-2.5">
              {/* Commentary Volume */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Commentary Speech Volume:</span>
                  <span className="font-mono">{Math.round(commVol)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={commVol}
                  onChange={handleCommVolChange}
                  className="w-full accent-[#F000A8] cursor-pointer"
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-700 block mb-1">
                  Select Commentary Language & Accent:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { code: "en", name: "Indian English" },
                    { code: "hi", name: "हिन्दी / Hinglish" },
                    { code: "mr", name: "मराठी" },
                    { code: "gu", name: "ગુજરાતી" },
                  ].map((l) => (
                    <button
                      key={l.code}
                      onClick={() => handleLangChange(l.code as CommentaryLang)}
                      className={`p-2 rounded-xl border-2 border-black text-xs font-black text-center ${
                        lang === l.code ? "bg-[#6500C8] text-white shadow-brutal-sm" : "bg-white text-black"
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Bot Personality & Live-Chat Sledging */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#6500C8]" />
                <div>
                  <h4 className="font-display font-black text-sm uppercase text-[#111111]">
                    BOT PERSONALITY & LIVE-CHAT SLEDGING
                  </h4>
                  <p className="text-[11px] text-gray-600 font-medium">
                    Playful cricket banter, reactions, and sledging in live match chat.
                  </p>
                </div>
              </div>
              <button
                onClick={handleBotBanterToggle}
                className={`text-xs font-black px-3 py-1.5 rounded-lg border-2 border-black uppercase ${
                  isBotBanterOn ? "bg-[#9BE52E] text-black" : "bg-gray-200 text-gray-600"
                }`}
              >
                {isBotBanterOn ? "ACTIVE ✓" : "MUTED ✕"}
              </button>
            </div>
          </div>

          {/* 4. Motion & Accessibility */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#FFD900]" />
                <div>
                  <h4 className="font-display font-black text-sm uppercase text-[#111111]">
                    REDUCED MOTION MODE
                  </h4>
                  <p className="text-[11px] text-gray-600 font-medium">
                    Minimizes camera shakes, screen pops, and celebration bursts.
                  </p>
                </div>
              </div>
              <button
                onClick={handleReducedMotionToggle}
                className={`text-xs font-black px-3 py-1.5 rounded-lg border-2 border-black uppercase ${
                  isReducedMotion ? "bg-[#FFD900] text-black" : "bg-gray-200 text-gray-600"
                }`}
              >
                {isReducedMotion ? "ENABLED ✓" : "DISABLED"}
              </button>
            </div>
          </div>

          {/* 5. Gesture Calibration Reference */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <h3 className="font-display font-black text-sm uppercase text-[#111111] mb-2 flex items-center gap-1.5">
              <Hand className="w-4 h-4 text-[#6500C8]" />
              HAND CRICKET GESTURE REFERENCE:
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold">
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">1:</span> Index extended
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">2:</span> Index + Middle (V)
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">3:</span> Three fingers
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">4:</span> 4 fingers, thumb in
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">5:</span> Full open palm
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#F000A8] font-mono">6:</span> Thumb out (Classic 6)
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-bold mt-2">
              Tip: You can always use the on-screen keypad if camera lighting is dim!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
