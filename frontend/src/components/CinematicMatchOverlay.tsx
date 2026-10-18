import React, { useEffect, useState, useRef } from "react";
import confetti from "canvas-confetti";
import { soundEngine } from "@/lib/sound";

interface DeliveryResultData {
  delivery_id: string;
  runs_scored: number;
  is_wicket: boolean;
  batsman_number?: number;
  bowler_number?: number;
  batsman_name?: string;
  bowler_name?: string;
  dismissal_type?: string;
}

interface CinematicMatchOverlayProps {
  revealResult: DeliveryResultData | null;
  matchPhase: string;
  isWinner: boolean;
  winnerName?: string;
  winnerGamerTag?: string;
}

export const CinematicMatchOverlay: React.FC<CinematicMatchOverlayProps> = ({
  revealResult,
  matchPhase,
  isWinner,
  winnerName,
  winnerGamerTag,
}) => {
  const [activeCelebration, setActiveCelebration] = useState<"four" | "six" | "wicket" | "dot" | null>(null);
  const lastAnimatedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!revealResult || !revealResult.delivery_id) return;
    if (lastAnimatedIdRef.current === revealResult.delivery_id) return;

    lastAnimatedIdRef.current = revealResult.delivery_id;

    if (revealResult.is_wicket) {
      setActiveCelebration("wicket");
      soundEngine.playWicket();
    } else if (revealResult.runs_scored === 6) {
      setActiveCelebration("six");
      soundEngine.playSixFanfare();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FFD900", "#F000A8", "#9BE52E", "#6500C8"],
        });
      } catch (_) {}
    } else if (revealResult.runs_scored === 4) {
      setActiveCelebration("four");
      soundEngine.playFourFanfare();
    } else if (revealResult.runs_scored === 0) {
      setActiveCelebration("dot");
    }

    const timer = setTimeout(() => {
      setActiveCelebration(null);
    }, 2800);

    return () => clearTimeout(timer);
  }, [revealResult]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-hidden">
      {/* 1. FOUR (BOUNDARY) CELEBRATION */}
      {activeCelebration === "four" && (
        <div className="animate-in zoom-in-75 fade-in duration-300 flex flex-col items-center justify-center">
          <div className="relative">
            <div className="text-8xl sm:text-9xl font-black font-display text-[#FFD900] drop-shadow-[6px_6px_0px_#000] tracking-tighter stroke-black transform scale-110 animate-pulse">
              4
            </div>
            <div className="absolute -top-3 -right-6 px-3 py-1 bg-[#F000A8] text-white font-black text-xs sm:text-sm uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_#000] rotate-12">
              BOUNDARY!
            </div>
          </div>
          <div className="mt-2 px-4 py-1.5 bg-[#111111] text-[#9BE52E] font-black text-sm uppercase tracking-wider border-2 border-[#9BE52E] shadow-[3px_3px_0px_#000]">
            ⚡ CRACKING FOUR THROUGH COVERS ⚡
          </div>
        </div>
      )}

      {/* 2. SIX (MAXIMUM) CELEBRATION */}
      {activeCelebration === "six" && (
        <div className="animate-in zoom-in-50 fade-in duration-200 flex flex-col items-center justify-center">
          <div className="relative">
            <div className="text-9xl sm:text-[11rem] font-black font-display text-[#FFD900] drop-shadow-[8px_8px_0px_#6500C8] tracking-tighter animate-bounce">
              6
            </div>
            <div className="absolute -top-4 -left-6 px-4 py-1.5 bg-[#FFD900] text-black font-black text-sm uppercase tracking-widest border-3 border-black shadow-[3px_3px_0px_#000] -rotate-12">
              MAXIMUM!
            </div>
          </div>
          <div className="mt-1 px-5 py-2 bg-[#6500C8] text-white font-black text-base uppercase tracking-widest border-3 border-black shadow-[4px_4px_0px_#FFD900] animate-pulse">
            💥 OUT OF THE STADIUM! 💥
          </div>
        </div>
      )}

      {/* 3. WICKET (OUT) CELEBRATION */}
      {activeCelebration === "wicket" && (
        <div className="animate-in zoom-in-90 fade-in duration-200 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Flying Stumps Illustration */}
            <div className="flex gap-2 mb-2">
              <div className="w-3 h-16 bg-[#FFD900] border-2 border-black rounded-t -rotate-12 transform -translate-y-4 animate-bounce" />
              <div className="w-3 h-16 bg-[#FFD900] border-2 border-black rounded-t rotate-6 transform translate-y-2" />
              <div className="w-3 h-16 bg-[#FFD900] border-2 border-black rounded-t rotate-45 transform -translate-y-8 animate-bounce" />
            </div>
          </div>
          <div className="px-6 py-2.5 bg-[#E50020] text-white font-black text-2xl sm:text-3xl uppercase tracking-widest border-4 border-black shadow-[6px_6px_0px_#000] rotate-[-2deg]">
            WICKET! OUT!
          </div>
          <div className="mt-2 px-3 py-1 bg-black text-white font-mono text-xs uppercase tracking-wider border border-white/40">
            {revealResult?.dismissal_type || "CLEAN BOWLED"}
          </div>
        </div>
      )}

      {/* 4. DOT BALL CELEBRATION */}
      {activeCelebration === "dot" && (
        <div className="animate-in fade-in zoom-in duration-200 px-4 py-1.5 bg-[#16161F]/90 text-white font-black text-sm uppercase tracking-wider border-2 border-white/40 shadow-[3px_3px_0px_#000]">
          🛡️ DOT BALL · PRESSURE MOUNTS
        </div>
      )}

      {/* 5. MATCH WINNER CROWN EFFECT */}
      {matchPhase === "match_end" && isWinner && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-in zoom-in-75 duration-500">
          <div className="relative">
            <span className="text-6xl animate-bounce inline-block">👑</span>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 px-3 py-0.5 bg-[#FFD900] text-black font-black text-[11px] uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] whitespace-nowrap">
              CHAMPION
            </div>
          </div>
          <div className="mt-2 px-3 py-1 bg-black/90 text-[#FFD900] border-2 border-[#FFD900] rounded-lg font-bold text-xs uppercase shadow-[2px_2px_0px_#000]">
            {winnerGamerTag || winnerName || "Match Winner"}
          </div>
        </div>
      )}
    </div>
  );
};
