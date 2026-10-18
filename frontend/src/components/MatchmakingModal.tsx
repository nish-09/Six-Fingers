"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/authContext";
import { AvatarIcon } from "./Avatars";
import { Zap, X, Shield, Swords, Timer, UserCheck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface MatchmakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchFound: (roomCode: string, playerId: string, sessionToken: string, role: string, teamId: string) => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  isOpen,
  onClose,
  onMatchFound,
}) => {
  const { user, profile, token } = useAuth();
  const [phase, setPhase] = useState<"SEARCHING" | "FOUND">("SEARCHING");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [opponent, setOpponent] = useState<any | null>(null);
  const [matchData, setMatchData] = useState<any | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
      setPhase("SEARCHING");
      return;
    }

    setPhase("SEARCHING");
    setElapsedSeconds(0);
    setCountdown(3);

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Connect to WebSocket
    let wsUrl = "";
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      const wsProto = isHttps ? "wss:" : "ws:";
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        wsUrl = `${wsProto}//${host}:8000/api/matchmaking/ws?token=${encodeURIComponent(token)}`;
      } else {
        wsUrl = `${wsProto}//${host}/api/matchmaking/ws?token=${encodeURIComponent(token)}`;
      }
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "MATCH_FOUND") {
          const match = data.match;
          setOpponent(match.opponent);
          setMatchData(match);
          setPhase("FOUND");
          if (timerRef.current) clearInterval(timerRef.current);

          // 3-second countdown to auto transition
          let count = 3;
          const countTimer = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
              clearInterval(countTimer);
              onMatchFound(
                match.room_code,
                match.player_id,
                match.session_token,
                match.role,
                match.team_id
              );
            }
          }, 1000);
        }
      } catch (err) {
        console.warn("Matchmaking WS error:", err);
      }
    };

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.send(JSON.stringify({ type: "CANCEL" }));
        ws.close();
      }
    };
  }, [isOpen, token]);

  const handleCancel = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CANCEL" }));
      wsRef.current.close();
    }
    onClose();
  };

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#FFF9E8] border-4 border-black shadow-[10px_10px_0px_#111] overflow-hidden">
        {/* Top Header - Inverted Palette */}
        <div className="bg-[#FFD900] p-4 border-b-4 border-black flex items-center justify-between text-black">
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6 text-[#1A0038]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display text-black">
              {phase === "SEARCHING" ? "Quick Play Matchmaking" : "Rival Located!"}
            </span>
          </div>
          {phase === "SEARCHING" && (
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-full bg-[#F000A8] border-2 border-black flex items-center justify-center text-white hover:bg-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-8 flex flex-col items-center justify-center text-center">
          {phase === "SEARCHING" ? (
            <div className="space-y-6 w-full flex flex-col items-center">
              {/* Animated Radar Effect */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#6500C8] animate-spin" style={{ animationDuration: "8s" }} />
                <div className="absolute inset-2 rounded-full border-4 border-[#F000A8] opacity-60 animate-ping" style={{ animationDuration: "2s" }} />
                <div className="relative z-10 p-4 bg-[#FFD900] rounded-full border-3 border-black shadow-[3px_3px_0px_#111]">
                  <Zap className="w-12 h-12 text-[#6500C8] fill-[#6500C8] animate-bounce" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black uppercase font-display tracking-wide">
                  Scanning for Opponents
                </h3>
                <p className="text-sm font-bold text-gray-700 mt-1 max-w-sm">
                  Pairing with a live hand-cricket player with balanced latency and fair waiting time.
                </p>
              </div>

              {/* Timer Badge */}
              <div className="px-6 py-2 bg-black text-[#9BE52E] border-3 border-black shadow-[3px_3px_0px_#FFD900] font-mono text-xl font-black flex items-center gap-2">
                <Timer className="w-5 h-5 text-[#FFD900]" />
                <span>{formatTime(elapsedSeconds)}</span>
              </div>

              {/* My Profile Card Preview */}
              <div className="w-full p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AvatarIcon id={profile?.avatar_url || "avatar_1"} size="md" />
                  <div className="text-left">
                    <div className="text-xs font-black uppercase text-gray-500">Queueing As</div>
                    <div className="font-extrabold text-base">{profile?.gamer_tag || user?.username}</div>
                  </div>
                </div>
                <div className="text-right text-xs font-bold text-[#6500C8]">
                  <span>Win Rate: </span>
                  <span className="font-black">{profile?.win_rate || 0}%</span>
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="w-full py-3.5 bg-gray-200 hover:bg-gray-300 text-black border-3 border-black shadow-[3px_3px_0px_#111] font-extrabold uppercase tracking-wider text-sm transition-transform active:translate-x-1 active:translate-y-1"
              >
                Cancel Search
              </button>
            </div>
          ) : (
            <div className="w-full space-y-6 animate-in zoom-in-95 duration-300">
              <div className="py-2 px-4 bg-[#9BE52E] border-3 border-black shadow-[4px_4px_0px_#111] inline-block font-display font-extrabold text-xl uppercase tracking-wider">
                ⚡ Showdown Match Ready! ⚡
              </div>

              {/* VS Battle Layout */}
              <div className="grid grid-cols-11 items-center gap-2">
                {/* Player 1 Card */}
                <div className="col-span-5 p-4 bg-[#6500C8] text-white border-3 border-black shadow-[4px_4px_0px_#111] flex flex-col items-center">
                  <AvatarIcon id={profile?.avatar_url || "avatar_1"} size="lg" />
                  <div className="mt-2 font-extrabold text-sm truncate max-w-full">{profile?.gamer_tag || user?.username}</div>
                  <div className="text-[10px] uppercase font-bold text-[#FFD900] mt-0.5">{profile?.favorite_team || "Team A"}</div>
                </div>

                {/* VS Badge */}
                <div className="col-span-1 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#FFD900] border-2 border-black flex items-center justify-center font-display font-black text-sm shadow-[2px_2px_0px_#111] animate-pulse">
                    VS
                  </div>
                </div>

                {/* Opponent Card */}
                <div className="col-span-5 p-4 bg-[#F000A8] text-white border-3 border-black shadow-[4px_4px_0px_#111] flex flex-col items-center">
                  <AvatarIcon id={opponent?.avatar_url || "avatar_2"} size="lg" />
                  <div className="mt-2 font-extrabold text-sm truncate max-w-full">{opponent?.gamer_tag || "Challenger"}</div>
                  <div className="text-[10px] uppercase font-bold text-[#9BE52E] mt-0.5">{opponent?.favorite_team || "Team B"}</div>
                </div>
              </div>

              {/* Countdown Banner */}
              <div className="p-4 bg-black text-[#FFD900] border-3 border-black shadow-[4px_4px_0px_#F000A8] flex flex-col items-center">
                <div className="text-xs font-black uppercase tracking-widest text-white">Launching Arena In</div>
                <div className="text-4xl font-display font-black text-[#FFD900] mt-1 animate-ping">
                  {countdown}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
