import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, Globe, History, Settings, Sparkles } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { speechManager, CommentaryLang } from "@/lib/speech";
import { CricketBallIcon } from "./Stickers";

interface NavbarProps {
  roomCode?: string;
  spectatorCount?: number;
  userRole?: string;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomCode,
  spectatorCount = 0,
  userRole,
  onOpenHistory,
  onOpenSettings,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [currentLang, setCurrentLang] = useState<CommentaryLang>("en");

  const toggleSound = () => {
    soundEngine.playClick();
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value as CommentaryLang;
    setCurrentLang(lang);
    speechManager.setLanguage(lang);
    soundEngine.playClick();
  };

  return (
    <header className="w-full bg-[#6500C8] border-b-4 border-[#111111] px-4 py-3 sticky top-0 z-50 shadow-brutal">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD900] border-3 border-[#111111] flex items-center justify-center shadow-brutal-sm">
            <CricketBallIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-[#FFD900] font-display tracking-tight leading-none drop-shadow-[2px_2px_0px_#111111]">
                SIX FINGERS
              </span>
              <span className="hidden sm:inline-block bg-[#9BE52E] text-[#111111] text-[10px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-[#111111]">
                LIVE MP
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[#FFF9E8] font-bold tracking-wide">
              Hand Cricket with Live Webcam & AI Commentary
            </p>
          </div>
        </div>

        {/* Room Code Indicator & Live Spectators if in a room */}
        {roomCode && (
          <div className="flex items-center gap-2">
            <div className="bg-[#FFF9E8] border-3 border-[#111111] px-3 py-1 rounded-xl shadow-brutal-sm flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-600 uppercase">ROOM:</span>
              <span className="text-sm font-black font-mono text-[#6500C8] tracking-wider">{roomCode}</span>
            </div>

            {spectatorCount > 0 && (
              <div className="bg-[#FFD900] text-[#111111] border-3 border-[#111111] px-2.5 py-1 rounded-xl shadow-brutal-sm flex items-center gap-1.5 font-mono font-black text-xs">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                <span>👁️ {spectatorCount}</span>
                <span className="hidden md:inline text-[10px] font-bold uppercase">WATCHING</span>
              </div>
            )}

            {userRole && (
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border-2 border-[#111111] shadow-brutal-sm ${
                userRole === "spectator" ? "bg-[#FFF9E8] text-purple-950" : "bg-[#9BE52E] text-black"
              }`}>
                {userRole === "spectator" ? "SPECTATOR 👁️" : "PLAYER 🏏"}
              </span>
            )}
          </div>
        )}

        {/* Controls: Audio, Language, History, Settings */}
        <div className="flex items-center gap-2">
          {/* Commentary Language Selector */}
          <div className="flex items-center bg-[#FFF9E8] border-3 border-[#111111] rounded-xl px-2 py-1 shadow-brutal-sm">
            <Globe className="w-4 h-4 text-[#6500C8] mr-1.5" />
            <select
              value={currentLang}
              onChange={handleLangChange}
              className="bg-transparent text-xs font-black text-[#111111] outline-none cursor-pointer"
              title="Commentary Language"
            >
              <option value="en">English (EN)</option>
              <option value="hi">हिन्दी (HI)</option>
              <option value="mr">मराठी (MR)</option>
              <option value="gu">ગુજરાતી (GU)</option>
            </select>
          </div>

          {/* Mute Button */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl border-3 border-[#111111] shadow-brutal-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
              isMuted ? "bg-red-400 text-white" : "bg-[#9BE52E] text-[#111111]"
            }`}
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Match History Modal Trigger */}
          {onOpenHistory && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenHistory();
              }}
              className="btn-brutal-white px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1"
              title="Match History"
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">HISTORY</span>
            </button>
          )}

          {/* Settings Modal Trigger */}
          {onOpenSettings && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenSettings();
              }}
              className="btn-brutal-yellow p-2 rounded-xl text-xs flex items-center"
              title="Settings & Calibration"
            >
              <Settings className="w-4 h-4 text-[#111111]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
