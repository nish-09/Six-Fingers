"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { usePresence } from "@/lib/presenceContext";
import { AvatarIcon } from "./Avatars";
import {
  Swords,
  PlusCircle,
  KeyRound,
  Users,
  Trophy,
  History,
  Flame,
  Award,
  Zap,
  Shield,
  Activity,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { getApiBaseUrl } from "@/lib/config";

interface DashboardViewProps {
  onStartQuickPlay: () => void;
  onCreatePrivateRoom: () => void;
  onJoinRoomCode: (code: string) => void;
  onOpenFriends: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
  onOpenHistory: () => void;
  onViewMatchDetail: (matchId: string) => void;
  onOpenSeries?: () => void;
  onOpenTournaments?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onStartQuickPlay,
  onCreatePrivateRoom,
  onJoinRoomCode,
  onOpenFriends,
  onOpenLeaderboard,
  onOpenProfile,
  onOpenHistory,
  onViewMatchDetail,
  onOpenSeries,
  onOpenTournaments,
}) => {
  const { user, profile } = useAuth();
  const { presences } = usePresence();

  const [inputCode, setInputCode] = useState("");
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const apiBase = getApiBaseUrl();

  useEffect(() => {
    if (user?.id) {
      const loadRecent = async () => {
        setLoadingMatches(true);
        try {
          const res = await fetch(`${apiBase}/api/history?limit=5&offset=0`);
          if (res.ok) {
            const data = await res.json();
            setRecentMatches(data.history || []);
          }
        } catch (err) {
          console.warn("Failed to load match history:", err);
        } finally {
          setLoadingMatches(false);
        }
      };
      loadRecent();
    }
  }, [user]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    soundEngine.playClick();
    onJoinRoomCode(inputCode.trim().toUpperCase());
  };

  const winRate = profile?.win_rate ?? 0;
  const totalMatches = profile?.total_matches ?? 0;
  const matchesWon = profile?.matches_won ?? 0;
  const currentStreak = profile?.current_streak ?? 0;
  const bestStreak = profile?.best_streak ?? 0;

  // Compute online friends count from presences
  const onlineFriendsCount = Object.values(presences).filter((p) => p.is_online).length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Gamer Hero Banner */}
      <div className="bg-[#FFD900] border-4 border-black shadow-[8px_8px_0px_#111] p-6 text-[#111111] relative overflow-hidden">
        {/* Decorative Grid Lines */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none bg-[radial-gradient(#6500C8_2px,transparent_2px)] [background-size:16px_16px]" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <AvatarIcon id={profile?.avatar_url || "avatar_1"} size="xl" />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#9BE52E] border-2 border-black" title="Online" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl md:text-4xl font-black font-display text-[#111111] tracking-tight">
                  {profile?.gamer_tag || "Player#001"}
                </h1>
                <span className="bg-[#6500C8] text-white text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black shadow-[2px_2px_0px_#111]">
                  PRO
                </span>
              </div>
              <div className="text-xs md:text-sm font-black text-gray-800 mt-1">
                {profile?.display_name || user?.full_name} · <span className="text-[#6500C8] font-black">{profile?.custom_team_name || profile?.favorite_team}</span> · {profile?.batting_style}
              </div>
              {profile?.bio && (
                <p className="text-xs text-gray-700 font-bold mt-1 max-w-lg italic">
                  &ldquo;{profile.bio}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3">
            <div className="bg-black border-3 border-black shadow-[4px_4px_0px_#6500C8] p-3 text-center min-w-[90px] text-white">
              <div className="text-[10px] font-black uppercase text-gray-400">Win Rate</div>
              <div className="text-2xl font-black font-display text-[#9BE52E]">{winRate}%</div>
            </div>
            <div className="bg-black border-3 border-black shadow-[4px_4px_0px_#F000A8] p-3 text-center min-w-[90px] text-white">
              <div className="text-[10px] font-black uppercase text-gray-400">Streak</div>
              <div className="text-2xl font-black font-display text-[#FFD900] flex items-center justify-center gap-1">
                {currentStreak} <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Battle Launcher & Quick Actions */}
      <section aria-labelledby="quick-play-heading" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Giant Quick Play Button */}
        <div className="lg:col-span-7 bg-[#240046] border-4 border-[#FFD900] shadow-[8px_8px_0px_#FFD900] p-6 flex flex-col justify-between text-white">
          <div>
            <h2 id="quick-play-heading" className="text-3xl sm:text-4xl font-black font-display text-[#FFD900] uppercase tracking-tight leading-none">
              Quick Play Arena
            </h2>
            <p className="text-sm font-bold text-[#E2D9F3] mt-2 max-w-md">
              Instant matchmaking with live rivals worldwide. Authoritative cricket rules, computer-vision gesture recognition, and verified stats.
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={() => {
                soundEngine.playClick();
                onStartQuickPlay();
              }}
              className="w-full py-5 bg-[#FFD900] hover:bg-[#ffe338] text-[#111111] border-4 border-black shadow-[6px_6px_0px_#111] font-display font-black text-2xl uppercase tracking-wider flex items-center justify-center gap-3 transition-transform hover:-translate-y-1 active:translate-x-1 active:translate-y-1"
            >
              <Swords className="w-7 h-7 text-[#6500C8]" />
              <span>Launch Quick Play</span>
            </button>
            <div className="flex items-center justify-between text-xs font-bold text-gray-300 mt-3">
              <span>⚡ Fair wait-time matchmaking</span>
              <span>🔒 Zero-client-trust security</span>
            </div>
          </div>
        </div>

        {/* Private Room Actions */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Create Room Card */}
          <div className="bg-[#FFF9E8] border-4 border-black shadow-[6px_6px_0px_#111] p-5 flex items-center justify-between">
            <div>
              <div className="text-xl font-black font-display">Create Private Room</div>
              <div className="text-xs font-bold text-gray-600 mt-0.5">Customize overs, wickets, & team roster</div>
            </div>
            <button
              onClick={() => {
                soundEngine.playClick();
                onCreatePrivateRoom();
              }}
              className="px-4 py-3 bg-[#F000A8] hover:bg-[#d60096] text-white border-3 border-black shadow-[3px_3px_0px_#111] font-display font-black text-sm uppercase transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              Create
            </button>
          </div>

          {/* Join With Code */}
          <div className="bg-[#FFF9E8] border-4 border-black shadow-[6px_6px_0px_#111] p-5">
            <form onSubmit={handleJoinSubmit} className="space-y-2">
              <label htmlFor="dashboard-room-code" className="block text-xs font-black uppercase text-[#6500C8]">
                Join Match With Code
              </label>
              <div className="flex gap-2">
                <input
                  id="dashboard-room-code"
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="6-CHAR CODE (e.g. 26PW7B)"
                  maxLength={8}
                  className="flex-1 px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-mono font-black text-sm uppercase tracking-wider focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#9BE52E] hover:bg-[#86c924] text-black border-3 border-black shadow-[2px_2px_0px_#111] font-display font-black text-sm uppercase"
                >
                  Join
                </button>
              </div>
            </form>
          </div>

          {/* Friends & Hall of Fame Quick Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenFriends();
              }}
              className="p-4 bg-white border-3 border-black shadow-[4px_4px_0px_#111] hover:bg-gray-50 flex items-center justify-between text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <div>
                <div className="font-display font-black text-sm uppercase">Gaming Circle</div>
                <div className="text-[10px] font-bold text-[#6500C8]">
                  {onlineFriendsCount > 0 ? `${onlineFriendsCount} Online` : "Manage Friends"}
                </div>
              </div>
              <Users className="w-5 h-5 text-[#6500C8]" />
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenLeaderboard();
              }}
              className="p-4 bg-white border-3 border-black shadow-[4px_4px_0px_#111] hover:bg-gray-50 flex items-center justify-between text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <div>
                <div className="font-display font-black text-sm uppercase">Leaderboard</div>
                <div className="text-[10px] font-bold text-[#F000A8]">Global Records</div>
              </div>
              <Trophy className="w-5 h-5 text-[#FFD900]" />
            </button>
          </div>

          {/* Multi-Match Series & Tournaments Quick Launch */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                soundEngine.playClick();
                if (onOpenSeries) onOpenSeries();
              }}
              className="p-3.5 bg-[#FFF9E8] border-3 border-black shadow-[4px_4px_0px_#111] hover:bg-yellow-50 flex items-center justify-between text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <div>
                <div className="font-display font-black text-xs sm:text-sm uppercase text-[#6500C8]">Series Derby</div>
                <div className="text-[10px] font-bold text-gray-600">Best of 3, 5, 7</div>
              </div>
              <Swords className="w-5 h-5 text-[#6500C8]" />
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                if (onOpenTournaments) onOpenTournaments();
              }}
              className="p-3.5 bg-[#FFF9E8] border-3 border-black shadow-[4px_4px_0px_#111] hover:bg-purple-50 flex items-center justify-between text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <div>
                <div className="font-display font-black text-xs sm:text-sm uppercase text-[#F000A8]">Tournaments</div>
                <div className="text-[10px] font-bold text-gray-600">Knockout Brackets</div>
              </div>
              <Trophy className="w-5 h-5 text-[#FFD900]" />
            </button>
          </div>
        </div>
      </section>

      {/* Verified Competitive Statistics Matrix */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#6500C8]" />
            <h3 className="font-display font-black text-xl uppercase tracking-wider">
              Verified Competitive Record
            </h3>
          </div>
          <span className="text-xs font-bold text-gray-600">Authoritative server calculations</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Matches</div>
            <div className="text-2xl font-black font-display text-black">{totalMatches}</div>
          </div>
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Victories</div>
            <div className="text-2xl font-black font-display text-[#9BE52E]">{matchesWon}</div>
          </div>
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Defeats</div>
            <div className="text-2xl font-black font-display text-red-600">{profile?.matches_lost ?? 0}</div>
          </div>
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Win Rate</div>
            <div className="text-2xl font-black font-display text-[#6500C8]">{winRate}%</div>
          </div>
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Total Runs</div>
            <div className="text-2xl font-black font-display text-black">{profile?.total_runs ?? 0}</div>
          </div>
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Wickets</div>
            <div className="text-2xl font-black font-display text-black">{profile?.total_wickets ?? 0}</div>
          </div>
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Active Streak</div>
            <div className="text-2xl font-black font-display text-orange-500">{currentStreak} 🔥</div>
          </div>
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] text-center">
            <div className="text-[10px] font-black uppercase text-gray-500">Best Streak</div>
            <div className="text-2xl font-black font-display text-[#F000A8]">{bestStreak}</div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Matches Feed */}
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_#111] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#6500C8]" />
            <h3 className="font-display font-black text-xl uppercase tracking-wider">
              Recent Matches on Platform
            </h3>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenHistory();
            }}
            className="text-xs font-black uppercase text-[#6500C8] hover:underline flex items-center gap-1"
          >
            Full History <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingMatches ? (
          <div className="py-8 text-center text-sm font-bold text-gray-500">Loading recent matches...</div>
        ) : recentMatches.length === 0 ? (
          <div className="py-12 text-center bg-gray-50 border-2 border-dashed border-gray-300">
            <Swords className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <div className="font-extrabold text-sm text-gray-700">No Match Records Yet</div>
            <p className="text-xs text-gray-500 mt-1">Jump into Quick Play or challenge a friend to log your first match!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMatches.map((m) => (
              <div
                key={m.id}
                onClick={() => onViewMatchDetail(m.id)}
                className="p-3.5 bg-[#FFF9E8] hover:bg-[#fff2c6] border-3 border-black shadow-[3px_3px_0px_#111] flex items-center justify-between cursor-pointer transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 text-xs font-black uppercase border-2 border-black ${
                      m.match_type === "PUBLIC" ? "bg-[#FFD900] text-black" : "bg-[#6500C8] text-white"
                    }`}
                  >
                    {m.match_type || "PRIVATE"}
                  </span>
                  <div>
                    <div className="font-display font-extrabold text-base">
                      {m.team_a_name} <span className="text-gray-400">vs</span> {m.team_b_name}
                    </div>
                    <div className="text-xs font-bold text-gray-600 mt-0.5">
                      {m.win_description || "Match Completed"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-black text-sm">
                    {m.first_innings} & {m.second_innings}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">
                    {new Date(m.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
