"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/lib/authContext";
import { AvatarIcon, AVATAR_OPTIONS } from "./Avatars";
import { getApiBaseUrl } from "@/lib/config";
import { X, Sparkles, Lock, Upload, Trash2, AlertCircle } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BATTING_STYLES = [
  "Right-handed",
  "Left-handed",
];

const BOWLING_STYLES = [
  "Right-arm fast",
  "Left-arm fast",
  "Right-arm medium",
  "Left-arm medium",
  "Right-arm off-spin",
  "Right-arm leg-spin",
  "Left-arm orthodox spin",
  "Left-arm wrist spin",
  "Does not bowl",
];

const PRESET_TEAMS = [
  "Mumbai Blasters",
  "Chennai Superstars",
  "Bangalore Strikers",
  "Kolkata Knights",
  "Delhi Dynamos",
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "avatar_1");
  const [bio, setBio] = useState(profile?.bio || "");
  const [country, setCountry] = useState(profile?.country || "India");
  const [customTeamName, setCustomTeamName] = useState(profile?.custom_team_name || profile?.favorite_team || "Mumbai Blasters");
  const [battingStyle, setBattingStyle] = useState(profile?.batting_style || "Right-handed");
  const [bowlingStyle, setBowlingStyle] = useState(profile?.bowling_style || "Right-arm medium");
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [showStats, setShowStats] = useState(profile?.show_stats ?? true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Avatar image must be smaller than 2MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setAvatarError("Only PNG, JPEG, and WebP images are supported.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/upload-avatar`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.detail || "Failed to upload avatar image.");
      } else {
        setAvatarUrl(data.avatar_url);
      }
    } catch {
      setAvatarError("Network error uploading avatar. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await updateProfile({
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
      bio: bio.trim(),
      country: country.trim(),
      favorite_team: customTeamName.trim(),
      custom_team_name: customTeamName.trim(),
      batting_style: battingStyle,
      bowling_style: bowlingStyle,
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
        {/* Header - Inverted Palette: Electric Yellow Background with Dark Text */}
        <div className="bg-[#FFD900] p-4 border-b-4 border-black flex items-center justify-between text-black">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#1A0038]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display text-black">
              Customize Gamer Profile
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

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-5">
          {message && (
            <div className="p-3 bg-[#9BE52E] border-3 border-black shadow-[3px_3px_0px_#111] font-bold text-xs uppercase text-black">
              {message}
            </div>
          )}

          {/* Gamer Tag Card */}
          <div className="p-4 bg-[#1A0038] text-white border-3 border-black shadow-[4px_4px_0px_#FFD900] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AvatarIcon id={avatarUrl} size="lg" />
              <div>
                <div className="text-[10px] font-black uppercase text-[#FFD900]">Official Gamer Identity</div>
                <div className="text-2xl font-extrabold font-display text-[#FFD900]">
                  {profile?.gamer_tag || "Gamer#0001"}
                </div>
                <div className="text-xs text-gray-300">
                  {user?.full_name ? `${user.full_name} • ` : ""}@{user?.username}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-1 bg-[#F000A8] text-white border border-white text-[10px] font-black uppercase shadow-[2px_2px_0px_#000]">
                {profile?.current_streak || 0} Streak 🔥
              </span>
            </div>
          </div>

          {/* Custom Avatar Upload / Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-black">
                Gamer Avatar
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-black uppercase text-[#6500C8] hover:underline flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Custom Photo
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />

            {avatarUploading && (
              <p className="text-xs font-bold text-blue-700 mb-2">Uploading avatar...</p>
            )}
            {avatarError && (
              <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {avatarError}
              </p>
            )}

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setAvatarUrl(av.id)}
                  className={`p-1.5 border-3 border-black flex flex-col items-center justify-center transition-all ${
                    avatarUrl === av.id
                      ? "bg-[#FFD900] shadow-[3px_3px_0px_#111] scale-105"
                      : "bg-white hover:bg-gray-100"
                  }`}
                >
                  <AvatarIcon id={av.id} size="sm" />
                  <span className="text-[10px] font-black mt-1 truncate max-w-full text-black">{av.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              required
              className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
              Gamer Bio & Motto
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Enter your gamer bio or motto"
              rows={2}
              maxLength={200}
              className="w-full px-3 py-2 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900] resize-none"
            />
          </div>

          {/* Team Name */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
              Custom Team Name
            </label>
            <input
              type="text"
              value={customTeamName}
              onChange={(e) => setCustomTeamName(e.target.value)}
              placeholder="Enter your team name"
              required
              className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className="text-[10px] text-gray-500 mr-1 self-center">Presets:</span>
              {PRESET_TEAMS.map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => setCustomTeamName(team)}
                  className="px-1.5 py-0.5 text-[10px] font-bold border border-black/40 bg-gray-100 hover:bg-[#FFD900] text-black transition-colors"
                >
                  {team}
                </button>
              ))}
            </div>
          </div>

          {/* Batting and Bowling Styles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                Batting Style
              </label>
              <select
                value={battingStyle}
                onChange={(e) => setBattingStyle(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-xs text-black focus:outline-none"
              >
                {BATTING_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                Bowling Style
              </label>
              <select
                value={bowlingStyle}
                onChange={(e) => setBowlingStyle(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-xs text-black focus:outline-none"
              >
                {BOWLING_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Privacy Toggles */}
          <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] space-y-2">
            <div className="text-xs font-black uppercase tracking-wider mb-1 flex items-center gap-1 text-black">
              <Lock className="w-3.5 h-3.5 text-[#6500C8]" /> Profile Privacy Settings
            </div>
            <label className="flex items-center justify-between text-xs font-bold cursor-pointer text-black">
              <span>Public Profile Visible in Search</span>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-[#6500C8]"
              />
            </label>
            <label className="flex items-center justify-between text-xs font-bold cursor-pointer text-black">
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
