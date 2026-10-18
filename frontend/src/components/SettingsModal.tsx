import React, { useState } from "react";
import { X, Volume2, Sliders, Hand, Video, Mic, Check } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { speechManager, CommentaryLang } from "@/lib/speech";

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [vol, setVol] = useState<number>(soundEngine.getVolume() * 100);
  const [isSpeechOn, setIsSpeechOn] = useState<boolean>(speechManager.isSpeechEnabled());
  const [lang, setLang] = useState<CommentaryLang>(speechManager.getLanguage());

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVol(newVol);
    soundEngine.setVolume(newVol / 100);
  };

  const handleSpeechToggle = () => {
    const on = speechManager.toggleSpeech();
    setIsSpeechOn(on);
    soundEngine.playClick();
  };

  const handleLangChange = (l: CommentaryLang) => {
    setLang(l);
    speechManager.setLanguage(l);
    soundEngine.playClick();
    speechManager.speak({
      en: "Commentary language set to English",
      hi: "कॉमेंट्री भाषा हिन्दी चुनी गई है",
      mr: "कॉमेंट्री भाषा मराठी निवडली आहे",
      gu: "કોમેન્ટ્રી ભાષા ગુજરાતી પસંદ કરવામાં આવી છે",
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="panel-brutal-white max-w-xl w-full p-5 sm:p-6 my-auto border-4 border-[#111111] shadow-brutal-xl relative max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-[#6500C8]" />
            <h2 className="text-2xl font-black font-display text-[#111111] uppercase tracking-wide">
              SETTINGS & CALIBRATION
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

        <div className="space-y-5">
          {/* Audio & SFX Controls */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <h3 className="font-display font-black text-sm uppercase text-[#111111] mb-2 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#F000A8]" />
              AUDIO & SOUND EFFECTS
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Master Volume:</span>
                  <span className="font-mono">{Math.round(vol)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={vol}
                  onChange={handleVolumeChange}
                  className="w-full accent-[#6500C8] cursor-pointer"
                />
              </div>

              {/* Sound Test Buttons */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-gray-700 block mb-1.5">
                  Test Stadium Sounds:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => soundEngine.playBatHit()}
                    className="btn-brutal-white text-xs px-2.5 py-1 rounded-lg"
                  >
                    🏏 Bat Hit
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
                    onClick={() => soundEngine.playTossCoin()}
                    className="btn-brutal-yellow text-xs px-2.5 py-1 rounded-lg"
                  >
                    🪙 Coin Toss
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Commentary Settings */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <h3 className="font-display font-black text-sm uppercase text-[#111111] mb-2">
              COMMENTARY VOICE & LANGUAGE
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">
                  Spoken Commentary (Speech Synthesis):
                </span>
                <button
                  onClick={handleSpeechToggle}
                  className={`text-xs font-black px-3 py-1 rounded-lg border-2 border-black ${
                    isSpeechOn ? "bg-[#9BE52E] text-black" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {isSpeechOn ? "ENABLED" : "MUTED"}
                </button>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-700 block mb-1">
                  Select Commentary Language:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { code: "en", name: "English" },
                    { code: "hi", name: "हिन्दी" },
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

          {/* Gesture Calibration Reference */}
          <div className="bg-[#FFF9E8] border-3 border-black rounded-xl p-4 shadow-brutal-sm">
            <h3 className="font-display font-black text-sm uppercase text-[#111111] mb-2 flex items-center gap-1.5">
              <Hand className="w-4 h-4 text-[#6500C8]" />
              HAND CRICKET FINGER RULES:
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold">
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">1:</span> Index finger extended
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">2:</span> Index + Middle (V)
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">3:</span> Three fingers up
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">4:</span> 4 fingers, thumb folded
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#6500C8] font-mono">5:</span> Open palm (5 fingers)
              </div>
              <div className="bg-white p-2 rounded-lg border border-black">
                <span className="text-base font-black text-[#F000A8] font-mono">6:</span> Thumb out (Classic 6)
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-bold mt-2">
              Note: You can always use the private manual keypad on-screen if lighting is low!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
