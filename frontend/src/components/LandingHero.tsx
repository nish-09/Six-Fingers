import React, { useState } from "react";
import {
  Play,
  Users,
  Video,
  Sparkles,
  Zap,
  Shield,
  HelpCircle,
  ArrowRight,
  Flame,
  Award
} from "lucide-react";
import { soundEngine } from "@/lib/sound";
import {
  RetroController,
  CricketBallIcon,
  BarrelRollBadge,
  StarSticker,
  GameBannerTitle
} from "./Stickers";

interface LandingHeroProps {
  onCreateMatch: (hostName: string, config?: { playersPerTeam?: number; maxSpectators?: number; overs?: number }) => void;
  onJoinMatch: (code: string, playerName: string, role: "player" | "spectator") => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onCreateMatch,
  onJoinMatch,
}) => {
  const [hostName, setHostName] = useState("Player 1");
  const [joinPlayerName, setJoinPlayerName] = useState("Player 2");
  const [joinCode, setJoinCode] = useState("");
  const [joinRole, setJoinRole] = useState<"player" | "spectator">("player");
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  // Create match configuration
  const [playersPerTeam, setPlayersPerTeam] = useState<number>(1);
  const [overs, setOvers] = useState<number>(2);
  const [maxSpectators, setMaxSpectators] = useState<number>(20);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    if (hostName.trim()) {
      onCreateMatch(hostName.trim(), {
        playersPerTeam,
        maxSpectators,
        overs,
      });
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    if (joinCode.trim() && joinPlayerName.trim()) {
      onJoinMatch(joinCode.trim().toUpperCase(), joinPlayerName.trim(), joinRole);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 py-4 sm:py-8">
      {/* 1. TOP EDITORIAL HERO BANNER (Directly based on design-reference.png) */}
      <div className="relative text-center space-y-6">
        {/* Floating playful stickers */}
        <div className="hidden lg:block absolute -top-4 left-6 transform -rotate-12 hover:rotate-0 transition-transform">
          <RetroController className="w-24 h-16 drop-shadow-[4px_4px_0px_#111111]" />
        </div>
        <div className="hidden lg:block absolute -top-2 right-10 transform rotate-12 hover:rotate-0 transition-transform">
          <BarrelRollBadge className="w-20 h-20" />
        </div>
        <div className="hidden md:block absolute top-24 left-1/4">
          <StarSticker className="w-8 h-8 text-[#F000A8] animate-wiggle" />
        </div>

        {/* BUBBLE BANNER "LET THE GAME BEGIN" */}
        <div className="flex justify-center">
          <GameBannerTitle title="LET THE GAME BEGIN" />
        </div>

        {/* HERO TITLE */}
        <div className="space-y-2">
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black font-display tracking-tight text-[#111111] uppercase drop-shadow-[5px_5px_0px_#F000A8]">
            SIX FINGERS
          </h1>
          <p className="text-xl sm:text-2xl font-black font-display text-[#6500C8] uppercase tracking-wide">
            MULTIPLAYER TEAM CRICKET & SPECTATOR ARENA
          </p>
          <p className="text-sm sm:text-base font-bold text-gray-800 max-w-2xl mx-auto">
            Play with your crew on opposing teams, rotate controllers each over, watch live as a spectator,
            and enjoy hand cricket with live webcams, secret decision locking, and multilingual commentary!
          </p>
        </div>

        {/* ACTION PANEL: CREATE OR JOIN MATCH (Vivid Purple Container) */}
        <div className="max-w-xl mx-auto panel-brutal-purple p-5 sm:p-7 text-white text-left relative z-10">
          <div className="flex border-b-3 border-black pb-3 mb-5 gap-2">
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab("create");
              }}
              className={`flex-1 py-2.5 rounded-xl font-display font-black text-sm uppercase transition-all ${
                activeTab === "create"
                  ? "bg-[#FFD900] text-[#111111] border-3 border-black shadow-brutal-sm"
                  : "bg-transparent text-white hover:bg-white/10"
              }`}
            >
              CREATE MATCH ROOM
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab("join");
              }}
              className={`flex-1 py-2.5 rounded-xl font-display font-black text-sm uppercase transition-all ${
                activeTab === "join"
                  ? "bg-[#9BE52E] text-[#111111] border-3 border-black shadow-brutal-sm"
                  : "bg-transparent text-white hover:bg-white/10"
              }`}
            >
              JOIN WITH CODE
            </button>
          </div>

          {activeTab === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-[#FFD900] mb-1">
                  YOUR NAME / GAMER TAG:
                </label>
                <input
                  type="text"
                  required
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="e.g. Master Blaster"
                  className="w-full bg-[#FFF9E8] border-3 border-black text-[#111111] rounded-xl px-4 py-3 font-display font-bold text-base shadow-brutal-sm outline-none focus:bg-white"
                />
              </div>

              {/* Team Mode & Spectators Configuration */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-black uppercase text-[#FFF9E8] mb-1">
                    PLAYERS PER TEAM:
                  </label>
                  <select
                    value={playersPerTeam}
                    onChange={(e) => setPlayersPerTeam(parseInt(e.target.value))}
                    className="w-full bg-[#FFF9E8] border-2 border-black text-[#111111] rounded-xl px-3 py-2 font-mono font-bold text-xs outline-none"
                  >
                    <option value={1}>1 vs 1 (Classic Duel)</option>
                    <option value={2}>2 vs 2 (Team Cricket)</option>
                    <option value={3}>3 vs 3 (Full Squad)</option>
                    <option value={4}>4 vs 4 (Party Match)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-[#FFF9E8] mb-1">
                    MAX SPECTATORS:
                  </label>
                  <select
                    value={maxSpectators}
                    onChange={(e) => setMaxSpectators(parseInt(e.target.value))}
                    className="w-full bg-[#FFF9E8] border-2 border-black text-[#111111] rounded-xl px-3 py-2 font-mono font-bold text-xs outline-none"
                  >
                    <option value={10}>10 Spectators</option>
                    <option value={20}>20 Spectators</option>
                    <option value={50}>50 Spectators</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="btn-brutal-pink w-full py-4 rounded-xl text-lg flex items-center justify-center gap-2"
                >
                  <Flame className="w-5 h-5" />
                  <span>CREATE MATCH ROOM & GET CODE</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-[#9BE52E] mb-1">
                  6-DIGIT ROOM CODE:
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CRIC77"
                  className="w-full bg-[#FFF9E8] border-3 border-black text-[#111111] rounded-xl px-4 py-3 font-mono font-black text-xl uppercase tracking-widest shadow-brutal-sm outline-none focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[#9BE52E] mb-1">
                  YOUR NAME:
                </label>
                <input
                  type="text"
                  required
                  value={joinPlayerName}
                  onChange={(e) => setJoinPlayerName(e.target.value)}
                  placeholder="e.g. King Kohli"
                  className="w-full bg-[#FFF9E8] border-3 border-black text-[#111111] rounded-xl px-4 py-3 font-display font-bold text-base shadow-brutal-sm outline-none focus:bg-white"
                />
              </div>

              {/* Role Selection: Player vs Spectator */}
              <div>
                <label className="block text-xs font-black uppercase text-[#FFF9E8] mb-1.5">
                  HOW WOULD YOU LIKE TO JOIN?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setJoinRole("player");
                    }}
                    className={`py-2.5 px-3 rounded-xl border-3 border-black font-display font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all ${
                      joinRole === "player"
                        ? "bg-[#9BE52E] text-black shadow-brutal-sm"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    <span>🏏 JOIN AS PLAYER</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setJoinRole("spectator");
                    }}
                    className={`py-2.5 px-3 rounded-xl border-3 border-black font-display font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all ${
                      joinRole === "spectator"
                        ? "bg-[#FFD900] text-black shadow-brutal-sm"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    <span>👁️ JOIN AS SPECTATOR</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#FFF9E8]/80 mt-1 font-mono">
                  {joinRole === "player"
                    ? "👉 You will join a team, rotate over controls, and submit hand gestures."
                    : "👉 You will watch the live scoreboard, discuss deliveries, and cheer!"}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="btn-brutal-green w-full py-4 rounded-xl text-lg flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  <span>{joinRole === "player" ? "ENTER ROOM & START PLAYING" : "ENTER ROOM AS SPECTATOR"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 2. ARCADE FEATURE CARDS (Inspired by "Most Popular" cards in reference) */}
      <div className="panel-brutal-purple p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6 border-b-3 border-black pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-[#FFD900] text-black text-xs font-black uppercase px-3 py-1 rounded-full border-2 border-black">
              GAMEPLAY MODES
            </span>
            <h3 className="text-xl sm:text-2xl font-black font-display text-white uppercase">
              POPULAR CRICKET FORMATS
            </h3>
          </div>
          <span className="text-xs font-bold text-[#FFF9E8]">2-PLAYER PEER-TO-PEER</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="panel-brutal-white p-5 flex flex-col justify-between hover:translate-x-1 hover:translate-y-1 transition-transform">
            <div>
              <span className="bg-[#FFD900] text-black text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black mb-2 inline-block">
                FAST BLITZ
              </span>
              <h4 className="text-2xl font-black font-display text-[#111111]">1-OVER DERBY</h4>
              <p className="text-xs text-gray-700 font-medium mt-1">
                6 deliveries each! Maximize your runs without showing matching fingers. Sudden death
                intensity.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#6500C8]">1 Over • 2 Wickets</span>
              <span className="text-xs font-black text-[#F000A8]">⚡ 3 MINS</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="panel-brutal-white p-5 flex flex-col justify-between hover:translate-x-1 hover:translate-y-1 transition-transform border-4 border-[#F000A8]">
            <div>
              <span className="bg-[#F000A8] text-white text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black mb-2 inline-block">
                MOST POPULAR
              </span>
              <h4 className="text-2xl font-black font-display text-[#111111]">CLASSIC 2-OVERS</h4>
              <p className="text-xs text-gray-700 font-medium mt-1">
                The authentic gully-cricket formula. 12 balls per side with bowler rotation and tactical
                pacing.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#6500C8]">2 Overs • 3 Wickets</span>
              <span className="text-xs font-black text-green-700">🏆 BALANCED</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="panel-brutal-white p-5 flex flex-col justify-between hover:translate-x-1 hover:translate-y-1 transition-transform">
            <div>
              <span className="bg-[#9BE52E] text-black text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black mb-2 inline-block">
                CHAMPIONSHIP
              </span>
              <h4 className="text-2xl font-black font-display text-[#111111]">5-OVERS T20 DERBY</h4>
              <p className="text-xs text-gray-700 font-medium mt-1">
                Full batting lineup with 5 wickets. Build partnerships, pace the chase, and settle old
                scores.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#6500C8]">5 Overs • 5 Wickets</span>
              <span className="text-xs font-black text-purple-700">🎯 STRATEGIC</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. HOW TO PLAY SECTION */}
      <div className="bg-[#FFF9E8] border-4 border-black rounded-2xl shadow-brutal p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6 border-b-3 border-black pb-3">
          <HelpCircle className="w-8 h-8 text-[#F000A8]" />
          <div>
            <h3 className="text-2xl sm:text-3xl font-black font-display text-[#111111] uppercase">
              HOW HAND CRICKET WORKS
            </h3>
            <p className="text-xs text-gray-600 font-bold">
              Traditional Indian school cricket rules powered by computer vision & fair play security
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <span className="w-8 h-8 rounded-full bg-[#FFD900] border-2 border-black flex items-center justify-center font-display font-black text-sm mb-2">
              1
            </span>
            <h5 className="font-display font-black text-sm uppercase text-[#111111]">
              PRIVATE DECISION
            </h5>
            <p className="text-xs text-gray-700 mt-1">
              During the 5-second countdown, both players point numbers (1 to 6) in front of their
              webcam. The opponent's screen is completely hidden!
            </p>
          </div>

          <div className="bg-white border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <span className="w-8 h-8 rounded-full bg-[#F000A8] text-white border-2 border-black flex items-center justify-center font-display font-black text-sm mb-2">
              2
            </span>
            <h5 className="font-display font-black text-sm uppercase text-[#111111]">
              SECRET LOCK
            </h5>
            <p className="text-xs text-gray-700 mt-1">
              Your number is locked securely on the server. Neither player knows the other's choice until
              both have locked.
            </p>
          </div>

          <div className="bg-white border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <span className="w-8 h-8 rounded-full bg-[#9BE52E] border-2 border-black flex items-center justify-center font-display font-black text-sm mb-2">
              3
            </span>
            <h5 className="font-display font-black text-sm uppercase text-[#111111]">
              SIMULTANEOUS REVEAL
            </h5>
            <p className="text-xs text-gray-700 mt-1">
              Both numbers pop up together! If numbers match = <b>WICKET (OUT!)</b>. If different ={" "}
              <b>BATSMAN SCORES RUNS</b>!
            </p>
          </div>

          <div className="bg-white border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <span className="w-8 h-8 rounded-full bg-[#6500C8] text-white border-2 border-black flex items-center justify-center font-display font-black text-sm mb-2">
              4
            </span>
            <h5 className="font-display font-black text-sm uppercase text-[#111111]">
              DISCUSS & READY UP
            </h5>
            <p className="text-xs text-gray-700 mt-1">
              Webcams reconnect! Talk, laugh, banter, and click "Ready for next ball" when prepared for
              the next delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
