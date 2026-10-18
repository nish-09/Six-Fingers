"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { AvatarIcon, AVATAR_OPTIONS } from "./Avatars";
import { X, Shield, Sparkles, Check, Globe, Flame, Trophy, Lock } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "avatar_1");
  const [bio, setBio] = useState(profile?.bio || "");
  const [country, setCountry] = useState(profile?.country || "India");
  const [favoriteTeam, setFavoriteTeam] = useState(profile?.favorite_team || "Mumbai Blasters");
  const [battingStyle, setBattingStyle] = useState(profile?.batting_style || "Aggressive Six-Hitter");
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [showStats, setShowStats] = useState(profile?.show_stats ?? true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await updateProfile({
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
      bio: bio.trim(),
      country: country.trim(),
      favorite_team: favoriteTeam,
      batting_style: battingStyle,
      is_public: isPublic,
      show_stats: showStats,
    });
    setSaving(false);

    if (res.success) {
      setMessage("Profile updated successfully!");
      setTimeout(() => {
        setMessage(null);
        onClose();
      }, 1000);
    } else {
      setMessage(res.message || "Failed to update profile");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#FFF9E8] border-4 border-black shadow-[10px_10px_0px_#111] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#6500C8] p-4 border-b-4 border-black flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#FFD900]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display">
              Customize Gamer Profile
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F000A8] border-2 border-black flex items-center justify-center text-white hover:bg-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-5">
          {message && (
            <div className="p-3 bg-[#9BE52E] border-3 border-black shadow-[3px_3px_0px_#111] font-bold text-xs uppercase text-black">
              {message}
            </div>
          )}

          {/* Gamer Tag Card */}
          <div className="p-4 bg-black text-white border-3 border-black shadow-[4px_4px_0px_#FFD900] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AvatarIcon id={avatarUrl} size="lg" />
              <div>
                <div className="text-[10px] font-black uppercase text-[#9BE52E]">Official Gamer Tag</div>
                <div className="text-2xl font-extrabold font-display text-[#FFD900]">
                  {profile?.gamer_tag || "Gamer#001"}
                </div>
                <div className="text-xs text-gray-400">@{user?.username}</div>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-1 bg-[#6500C8] text-white border border-white text-[10px] font-black uppercase">
                {profile?.current_streak || 0} Streak 🔥
              </span>
            </div>
          </div>

          {/* Avatar Gallery */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-2">
              Select Avatar Badge
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setAvatarUrl(av.id)}
                  className={`p-2 border-3 border-black flex flex-col items-center justify-center transition-all ${
                    avatarUrl === av.id
                      ? "bg-[#FFD900] shadow-[3px_3px_0px_#111] scale-105"
                      : "bg-white hover:bg-gray-100"
                  }`}
                >
                  <AvatarIcon id={av.id} size="sm" />
                  <span className="text-[10px] font-black mt-1 truncate max-w-full">{av.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              required
              className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm focus:outline-none"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1">
              Gamer Bio & Motto
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Master of the 6-finger flick. Unbeaten in Mumbai."
              rows={2}
              maxLength={200}
              className="w-full px-3 py-2 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm focus:outline-none resize-none"
            />
          </div>

          {/* Team and Batting Style */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                Favorite Team
              </label>
              <select
                value={favoriteTeam}
                onChange={(e) => setFavoriteTeam(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-xs"
              >
                <option value="Mumbai Blasters">Mumbai Blasters</option>
                <option value="Chennai Superstars">Chennai Superstars</option>
                <option value="Bangalore Strikers">Bangalore Strikers</option>
                <option value="Kolkata Knights">Kolkata Knights</option>
                <option value="Delhi Dynamos">Delhi Dynamos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                Batting Style
              </label>
              <select
                value={battingStyle}
                onChange={(e) => setBattingStyle(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-xs"
              >
                <option value="Aggressive Six-Hitter">Aggressive Six-Hitter</option>
                <option value="Classic Anchor">Classic Anchor</option>
                <option value="Viper Finisher">Viper Finisher</option>
                <option value="360 Innovator">360 Innovator</option>
              </select>
            </div>
          </div>

          {/* Privacy Toggles */}
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] space-y-2">
            <div className="text-xs font-black uppercase tracking-wider mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#6500C8]" /> Profile Privacy Settings
            </div>
            <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
              <span>Public Profile Visible in Search</span>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-[#6500C8]"
              />
            </label>
            <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
              <span>Show Competitive Stats on Profile</span>
              <input
                type="checkbox"
                checked={showStats}
                onChange={(e) => setShowStats(e.target.checked)}
                className="w-4 h-4 accent-[#6500C8]"
              />
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 btn-brutal-green text-base uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? "Saving Changes..." : "Save Gamer Profile"}
          </button>
        </form>
      </div>
    </div>
  );
};
