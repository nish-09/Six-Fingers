"use client";

import React, { useState, useEffect } from "react";
import { AvatarIcon } from "./Avatars";
import { X, Trophy, Swords, Flame, Shield, Globe, Award } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface PublicProfileModalProps {
  gamerTag: string | null;
  onClose: () => void;
  onInvite?: (userId: string) => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  gamerTag,
  onClose,
  onInvite,
}) => {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase = getApiBaseUrl();

  useEffect(() => {
    if (!gamerTag) {
      setProfile(null);
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/profiles/${encodeURIComponent(gamerTag)}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.warn("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [gamerTag]);

  if (!gamerTag) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FFF9E8] border-4 border-black shadow-[10px_10px_0px_#111] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header - Inverted Palette */}
        <div className="bg-[#FFD900] p-4 border-b-4 border-black flex items-center justify-between text-black">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#1A0038]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display text-black">
              Player Dossier
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[#F000A8] border-2 border-black flex items-center justify-center text-white hover:bg-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-gray-500">Retrieving player records...</div>
          ) : !profile ? (
            <div className="py-12 text-center text-sm font-bold text-red-600">Player profile not found.</div>
          ) : !profile.is_public ? (
            <div className="p-6 text-center bg-white border-3 border-black space-y-3">
              <AvatarIcon id={profile.avatar_url} size="xl" className="mx-auto" />
              <div className="font-display font-black text-2xl">{profile.gamer_tag}</div>
              <p className="text-xs font-bold text-gray-600">This player keeps their stats and dossier private.</p>
            </div>
          ) : (
            <>
              {/* Profile Hero Header */}
              <div className="p-4 bg-black text-white border-3 border-black shadow-[4px_4px_0px_#FFD900] flex items-center gap-4">
                <AvatarIcon id={profile.avatar_url} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="text-2xl font-extrabold font-display text-[#FFD900] truncate">
                    {profile.gamer_tag}
                  </div>
                  <div className="text-xs text-gray-300 font-bold">{profile.display_name}</div>
                  <div className="text-[11px] text-[#9BE52E] font-black uppercase mt-1">
                    {profile.favorite_team} · {profile.batting_style}
                  </div>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <div className="p-3 bg-white border-2 border-black text-xs font-bold text-gray-700 italic">
                  &ldquo;{profile.bio}&rdquo;
                </div>
              )}

              {/* Stat Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-white border-2 border-black text-center">
                  <div className="text-[10px] font-black uppercase text-gray-500">Win Rate</div>
                  <div className="text-xl font-display font-black text-[#6500C8]">{profile.win_rate ?? 0}%</div>
                </div>
                <div className="p-3 bg-white border-2 border-black text-center">
                  <div className="text-[10px] font-black uppercase text-gray-500">Matches</div>
                  <div className="text-xl font-display font-black text-black">
                    {profile.matches_won ?? 0}W / {profile.total_matches ?? 0}M
                  </div>
                </div>
                <div className="p-3 bg-white border-2 border-black text-center">
                  <div className="text-[10px] font-black uppercase text-gray-500">Streak</div>
                  <div className="text-xl font-display font-black text-[#F000A8]">
                    {profile.current_streak ?? 0} 🔥
                  </div>
                </div>
                <div className="p-3 bg-white border-2 border-black text-center">
                  <div className="text-[10px] font-black uppercase text-gray-500">Total Runs</div>
                  <div className="text-xl font-display font-black text-black">{profile.total_runs ?? 0}</div>
                </div>
                <div className="p-3 bg-white border-2 border-black text-center">
                  <div className="text-[10px] font-black uppercase text-gray-500">Wickets</div>
                  <div className="text-xl font-display font-black text-black">{profile.total_wickets ?? 0}</div>
                </div>
                <div className="p-3 bg-white border-2 border-black text-center">
                  <div className="text-[10px] font-black uppercase text-gray-500">Best Streak</div>
                  <div className="text-xl font-display font-black text-[#9BE52E]">{profile.best_streak ?? 0}</div>
                </div>
              </div>

              {/* Recent Matches */}
              {profile.recent_matches && profile.recent_matches.length > 0 && (
                <div>
                  <div className="text-xs font-black uppercase tracking-wider mb-2">Recent Matches</div>
                  <div className="space-y-2">
                    {profile.recent_matches.map((m: any) => (
                      <div
                        key={m.id}
                        className="p-2.5 bg-white border-2 border-black flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-extrabold">{m.team_a_name} vs {m.team_b_name}</div>
                          <div className="text-[10px] text-gray-500">{m.win_description || "Match Completed"}</div>
                        </div>
                        <span className="font-bold text-gray-700">
                          {m.first_innings} & {m.second_innings}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
