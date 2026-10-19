import React, { useState, useEffect } from "react";
import { Zap, Shield, Swords, FastForward } from "lucide-react";
import { soundEngine } from "@/lib/sound";

interface MatchIntroOverlayProps {
  player1Name: string;
  player2Name: string;
  player1GamerTag?: string;
  player2GamerTag?: string;
  isBotOpponent: boolean;
  userIsBatting: boolean;
  oversPerInnings: number;
  onDismiss: () => void;
}

export const MatchIntroOverlay: React.FC<MatchIntroOverlayProps> = ({
  player1Name,
  player2Name,
  player1GamerTag,
  player2GamerTag,
  isBotOpponent,
  userIsBatting,
  oversPerInnings,
  onDismiss,
}) => {
  const [countdown, setCountdown] = useState<number>(3);

  // Check reduced motion
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? localStorage.getItem("sixfingers_reduced_motion") === "true"
      : false;

  useEffect(() => {
    // Play match start fanfare
    soundEngine.playInningsTransition();

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onDismiss]);

  const handleSkip = () => {
    soundEngine.playClick();
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl bg-[#FFF9E8] border-4 border-[#111111] rounded-3xl shadow-brutal-lg p-6 sm:p-8 text-center space-y-6 ${
          prefersReducedMotion ? "" : "animate-pop"
        }`}
      >
        {/* Arena Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#6500C8] text-[#FFD900] border-2 border-black rounded-full text-xs font-mono font-black uppercase tracking-widest shadow-brutal-sm">
          <Zap className="w-4 h-4 fill-current text-[#FFD900]" />
          SIX FINGERS ARENA · {oversPerInnings} OVER CLASH
        </div>

        {/* Title */}
        <div>
          <h2 className="text-3xl sm:text-5xl font-black font-display text-[#111111] uppercase tracking-tight">
            MATCH DAY SHOWDOWN!
          </h2>
          <p className="text-xs sm:text-sm text-gray-700 font-bold mt-1">
            Get your gestures and hand signs ready. authoritative scoring is active!
          </p>
        </div>

        {/* VS Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-4 py-2">
          {/* Player 1 Card (You) */}
          <div className="sm:col-span-2 bg-[#9BE52E]/30 border-3 border-[#111111] rounded-2xl p-4 shadow-brutal text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black bg-[#111111] text-[#9BE52E] px-2 py-0.5 rounded border border-black uppercase">
                YOU
              </span>
              <span className="text-[10px] font-mono font-black text-purple-900 uppercase">
                {userIsBatting ? "BATTING FIRST 🏏" : "BOWLING FIRST 🎯"}
              </span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-12 h-12 rounded-xl bg-[#6500C8] border-2 border-black flex items-center justify-center text-white text-xl font-black">
                {player1Name ? player1Name.charAt(0).toUpperCase() : "P"}
              </div>
              <div className="truncate">
                <h3 className="font-display font-black text-lg text-[#111111] truncate">
                  {player1Name || "Player"}
                </h3>
                {player1GamerTag && (
                  <p className="text-[11px] font-mono text-purple-950 font-bold truncate">
                    @{player1GamerTag}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* VS Pulsing Center */}
          <div className="sm:col-span-1 flex flex-col items-center justify-center my-1 sm:my-0">
            <div className="w-14 h-14 bg-[#FFD900] border-3 border-black rounded-full flex items-center justify-center shadow-brutal transform hover:scale-105 transition-transform">
              <span className="font-display font-black text-xl text-[#111111]">
                VS
              </span>
            </div>
          </div>

          {/* Player 2 Card (Opponent / Bot) */}
          <div className="sm:col-span-2 bg-[#F000A8]/20 border-3 border-[#111111] rounded-2xl p-4 shadow-brutal text-left space-y-2">
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border border-black uppercase ${
                  isBotOpponent
                    ? "bg-[#FFD900] text-[#111111]"
                    : "bg-[#111111] text-white"
                }`}
              >
                {isBotOpponent ? "AI BOT 🤖" : "OPPONENT"}
              </span>
              <span className="text-[10px] font-mono font-black text-purple-900 uppercase">
                {userIsBatting ? "BOWLING FIRST 🎯" : "BATTING FIRST 🏏"}
              </span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-12 h-12 rounded-xl bg-[#FFD900] border-2 border-black flex items-center justify-center text-[#111111] text-xl font-black">
                {isBotOpponent ? "🤖" : player2Name ? player2Name.charAt(0).toUpperCase() : "O"}
              </div>
              <div className="truncate">
                <h3 className="font-display font-black text-lg text-[#111111] truncate">
                  {player2Name || "Opponent"}
                </h3>
                {player2GamerTag && (
                  <p className="text-[11px] font-mono text-purple-950 font-bold truncate">
                    @{player2GamerTag}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Countdown & Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t-2 border-gray-300">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-black uppercase text-gray-700">
              MATCH STARTS IN:
            </span>
            <span className="w-9 h-9 rounded-xl bg-[#111111] text-[#FFD900] border-2 border-black flex items-center justify-center font-display font-black text-lg shadow-brutal-sm animate-pulse">
              {countdown}
            </span>
          </div>

          <button
            onClick={handleSkip}
            className="btn-brutal-pink px-6 py-2 rounded-xl text-xs font-display font-black uppercase flex items-center gap-1.5 shadow-brutal-sm hover:scale-105 active:scale-95 transition-transform"
          >
            <span>SKIP INTRO</span>
            <FastForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
