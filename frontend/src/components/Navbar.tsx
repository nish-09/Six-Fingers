"use client";

import React, { useState } from "react";
import {
  Volume2,
  VolumeX,
  Globe,
  History,
  Settings,
  Bell,
  Users,
  Trophy,
  User,
  LogOut,
  Swords,
  Sparkles,
} from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { speechManager, CommentaryLang } from "@/lib/speech";
import { CricketBallIcon } from "./Stickers";
import { useAuth } from "@/lib/authContext";
import { AvatarIcon } from "./Avatars";

interface NavbarProps {
  roomCode?: string;
  spectatorCount?: number;
  userRole?: string;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onOpenAuth?: (tab?: "signin" | "register") => void;
  onOpenFriends?: () => void;
  onOpenProfile?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenNotifications?: () => void;
  onStartQuickPlay?: () => void;
  unreadNotificationsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomCode,
  spectatorCount = 0,
  userRole,
  onOpenHistory,
  onOpenSettings,
  onOpenAuth,
  onOpenFriends,
  onOpenProfile,
  onOpenLeaderboard,
  onOpenNotifications,
  onStartQuickPlay,
  unreadNotificationsCount = 0,
}) => {
  const { user, profile, isAuthenticated, logout } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [currentLang, setCurrentLang] = useState<CommentaryLang>("en");
  const [showUserMenu, setShowUserMenu] = useState(false);

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
    <header className="w-full bg-[#FFD900] border-b-4 border-[#111111] px-4 py-2.5 sticky top-0 z-40 shadow-brutal text-[#111111]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6500C8] border-3 border-[#111111] flex items-center justify-center shadow-brutal-sm flex-shrink-0 text-[#FFD900]">
            <CricketBallIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-[#111111] font-display tracking-tight leading-none drop-shadow-[2px_2px_0px_rgba(101,0,200,0.3)]">
                SIX FINGERS
              </span>
              <span className="hidden sm:inline-block bg-[#F000A8] text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-[#111111]">
                PRO GAMING
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[#6500C8] font-black tracking-wide">
              TWO HANDS. ONE RIVALRY.
            </p>
          </div>
        </div>

        {/* Room Code Indicator & Live Spectators */}
        {roomCode && (
          <div className="flex items-center gap-2">
            <div className="bg-white border-3 border-[#111111] px-3 py-1 rounded-xl shadow-brutal-sm flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-700 uppercase">ROOM:</span>
              <span className="text-sm font-black font-mono text-[#6500C8] tracking-wider">{roomCode}</span>
            </div>

            {spectatorCount > 0 && (
              <div className="bg-[#F000A8] text-white border-3 border-[#111111] px-2.5 py-1 rounded-xl shadow-brutal-sm flex items-center gap-1.5 font-mono font-black text-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>👁️ {spectatorCount}</span>
                <span className="hidden md:inline text-[10px] font-bold uppercase">WATCHING</span>
              </div>
            )}

            {userRole && (
              <span
                className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border-2 border-[#111111] shadow-brutal-sm ${
                  userRole === "spectator" ? "bg-white text-purple-950" : "bg-[#9BE52E] text-black"
                }`}
              >
                {userRole === "spectator" ? "SPECTATOR 👁️" : "PLAYER 🏏"}
              </span>
            )}
          </div>
        )}

        {/* Navigation & Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Play Trigger in Navbar if logged in */}
          {isAuthenticated && onStartQuickPlay && !roomCode && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onStartQuickPlay();
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#6500C8] hover:bg-[#5200a3] text-white border-3 border-black rounded-xl font-display font-black text-xs uppercase shadow-brutal-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <Swords className="w-4 h-4 text-[#FFD900]" />
              <span>Quick Play</span>
            </button>
          )}

          {/* Social Circle / Friends */}
          {isAuthenticated && onOpenFriends && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenFriends();
              }}
              className="p-2 bg-[#FFF9E8] hover:bg-white text-black border-3 border-black rounded-xl shadow-brutal-sm flex items-center gap-1 transition-transform active:translate-x-0.5 active:translate-y-0.5"
              title="Friends & Rivals"
              aria-label="Friends and Rivals"
            >
              <Users className="w-4 h-4 text-[#6500C8]" />
              <span className="hidden sm:inline text-xs font-black uppercase">Friends</span>
            </button>
          )}

          {/* Leaderboard Trigger */}
          {onOpenLeaderboard && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenLeaderboard();
              }}
              className="p-2 bg-[#FFF9E8] hover:bg-white text-black border-3 border-black rounded-xl shadow-brutal-sm flex items-center gap-1 transition-transform active:translate-x-0.5 active:translate-y-0.5"
              title="Hall of Fame"
              aria-label="Hall of Fame Leaderboard"
            >
              <Trophy className="w-4 h-4 text-[#FFD900]" />
              <span className="hidden sm:inline text-xs font-black uppercase">Ranks</span>
            </button>
          )}

          {/* Notifications Bell */}
          {isAuthenticated && onOpenNotifications && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenNotifications();
              }}
              className="relative p-2 bg-[#FFF9E8] hover:bg-white text-black border-3 border-black rounded-xl shadow-brutal-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
              title="Notifications"
              aria-label={`Notifications ${unreadNotificationsCount > 0 ? `(${unreadNotificationsCount} unread)` : ""}`}
            >
              <Bell className="w-4 h-4 text-[#6500C8]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F000A8] border border-black text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Commentary Language Selector */}
          <div className="flex items-center bg-[#FFF9E8] border-3 border-[#111111] rounded-xl px-2 py-1 shadow-brutal-sm">
            <Globe className="w-4 h-4 text-[#6500C8] mr-1" />
            <select
              id="commentary-lang-select"
              value={currentLang}
              onChange={handleLangChange}
              className="bg-transparent text-xs font-black text-[#111111] outline-none cursor-pointer"
              title="Commentary Language"
              aria-label="Commentary Language"
            >
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="mr">MR</option>
              <option value="gu">GU</option>
            </select>
          </div>

          {/* Mute Button */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl border-3 border-[#111111] shadow-brutal-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
              isMuted ? "bg-red-400 text-white" : "bg-[#9BE52E] text-[#111111]"
            }`}
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
            aria-label={isMuted ? "Unmute Game Audio" : "Mute Game Audio"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* User Account / Auth Section */}
          {isAuthenticated && profile ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 pl-2 pr-2.5 bg-[#FFF9E8] hover:bg-white border-3 border-black rounded-xl shadow-brutal-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
                aria-expanded={showUserMenu}
                aria-haspopup="menu"
                aria-label={`Account menu for ${profile.gamer_tag}`}
              >
                <AvatarIcon id={profile.avatar_url} size="sm" />
                <span className="text-xs font-black text-black font-display truncate max-w-[100px] sm:max-w-[130px]">
                  {profile.gamer_tag}
                </span>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#FFF9E8] border-3 border-black shadow-[4px_4px_0px_#111] rounded-xl py-2 z-50 animate-in fade-in">
                  <div className="px-3 py-1.5 border-b-2 border-gray-200">
                    <div className="text-[10px] font-black uppercase text-gray-500">Player Handle</div>
                    <div className="text-xs font-black text-[#6500C8] truncate">{profile.gamer_tag}</div>
                  </div>

                  {onOpenProfile && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenProfile();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-black uppercase hover:bg-[#FFD900] flex items-center gap-2"
                    >
                      <User className="w-3.5 h-3.5 text-[#6500C8]" /> Edit Profile
                    </button>
                  )}

                  {onOpenHistory && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenHistory();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-black uppercase hover:bg-[#FFD900] flex items-center gap-2"
                    >
                      <History className="w-3.5 h-3.5 text-[#6500C8]" /> Match History
                    </button>
                  )}

                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSettings();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-black uppercase hover:bg-[#FFD900] flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#6500C8]" /> Settings
                    </button>
                  )}

                  <div className="border-t-2 border-gray-200 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                soundEngine.playClick();
                if (onOpenAuth) onOpenAuth("signin");
              }}
              className="btn-brutal-pink px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
