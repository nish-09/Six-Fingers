"use client";

import React, { useState, useEffect } from "react";
import { AvatarIcon } from "./Avatars";
import { X, Trophy, Medal, Flame, Zap, ArrowUpRight } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGamerTag?: (gamerTag: string) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  onSelectGamerTag,
}) => {
  const [sortBy, setSortBy] = useState<"wins" | "win_rate" | "runs" | "wickets">("wins");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const apiBase = getApiBaseUrl();

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/profiles/leaderboard?sort_by=${sortBy}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.warn("Failed to load leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#FFF9E8] border-4 border-black shadow-[10px_10px_0px_#111] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#FFD900] p-4 border-b-4 border-black flex items-center justify-between text-black">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#6500C8]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display">
              Six Fingers Global Hall of Fame
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F000A8] border-2 border-black flex items-center justify-center text-white hover:bg-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sort Filter Tabs */}
        <div className="grid grid-cols-4 border-b-4 border-black bg-black font-display font-extrabold text-xs uppercase">
          <button
            onClick={() => setSortBy("wins")}
            className={`py-3 text-center transition-colors ${
              sortBy === "wins" ? "bg-[#6500C8] text-white" : "bg-black text-gray-300 hover:bg-gray-900"
            }`}
          >
            Most Wins
          </button>
          <button
            onClick={() => setSortBy("win_rate")}
            className={`py-3 text-center transition-colors ${
              sortBy === "win_rate" ? "bg-[#F000A8] text-white" : "bg-black text-gray-300 hover:bg-gray-900"
            }`}
          >
            Win Rate %
          </button>
          <button
            onClick={() => setSortBy("runs")}
            className={`py-3 text-center transition-colors ${
              sortBy === "runs" ? "bg-[#9BE52E] text-black" : "bg-black text-gray-300 hover:bg-gray-900"
            }`}
          >
            Total Runs
          </button>
          <button
            onClick={() => setSortBy("wickets")}
            className={`py-3 text-center transition-colors ${
              sortBy === "wickets" ? "bg-[#FF5500] text-white" : "bg-black text-gray-300 hover:bg-gray-900"
            }`}
          >
            Wickets
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-gray-500">Ranking players...</div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-gray-500">
              No ranked matches on record yet. Play Quick Play or Private matches to claim your rank!
            </div>
          ) : (
            <div className="space-y-2.5">
              {leaderboard.map((item) => (
                <div
                  key={item.user_id}
                  onClick={() => onSelectGamerTag && onSelectGamerTag(item.gamer_tag)}
                  className="p-3 bg-white hover:bg-yellow-50 border-3 border-black shadow-[3px_3px_0px_#111] flex items-center justify-between cursor-pointer transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Indicator */}
                    <div
                      className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-display font-black text-sm ${
                        item.rank === 1
                          ? "bg-[#FFD900] text-black shadow-[2px_2px_0px_#111]"
                          : item.rank === 2
                          ? "bg-gray-300 text-black shadow-[2px_2px_0px_#111]"
                          : item.rank === 3
                          ? "bg-[#d97706] text-white shadow-[2px_2px_0px_#111]"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.rank}
                    </div>

                    <AvatarIcon id={item.avatar_url} size="md" />

                    <div>
                      <div className="font-extrabold text-sm">{item.gamer_tag}</div>
                      <div className="text-[10px] font-bold text-gray-500">
                        {item.favorite_team} · {item.current_streak} Streak 🔥
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {sortBy === "wins" && (
                      <div>
                        <span className="font-display font-black text-base text-[#6500C8]">{item.matches_won}</span>
                        <span className="text-xs font-bold text-gray-500"> Wins ({item.total_matches}M)</span>
                      </div>
                    )}
                    {sortBy === "win_rate" && (
                      <div>
                        <span className="font-display font-black text-base text-[#F000A8]">{item.win_rate}%</span>
                        <span className="text-xs font-bold text-gray-500"> ({item.matches_won}/{item.total_matches})</span>
                      </div>
                    )}
                    {sortBy === "runs" && (
                      <div>
                        <span className="font-display font-black text-base text-black">{item.total_runs}</span>
                        <span className="text-xs font-bold text-gray-500"> Runs</span>
                      </div>
                    )}
                    {sortBy === "wickets" && (
                      <div>
                        <span className="font-display font-black text-base text-black">{item.total_wickets}</span>
                        <span className="text-xs font-bold text-gray-500"> Wkts</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
