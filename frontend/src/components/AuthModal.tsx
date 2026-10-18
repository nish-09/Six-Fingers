"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { AvatarIcon, AVATAR_OPTIONS } from "./Avatars";
import { X, Lock, Mail, User, ShieldCheck, Zap, Eye, EyeOff, Sparkles } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "register";
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = "signin",
}) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"signin" | "register">(defaultTab);

  // Sign In Form
  const [signinIdentifier, setSigninIdentifier] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  // Register Form
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("avatar_1");
  const [favoriteTeam, setFavoriteTeam] = useState("Mumbai Blasters");
  const [battingStyle, setBattingStyle] = useState("Aggressive Six-Hitter");

  // State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score; // 0 to 4
  };

  const pwdStrength = getPasswordStrength(regPassword);
  const strengthLabels = ["Too Short", "Weak", "Fair", "Good", "Bulletproof"];
  const strengthColors = ["bg-gray-300", "bg-red-500", "bg-orange-500", "bg-yellow-400", "bg-[#9BE52E]"];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signinIdentifier.trim() || !signinPassword) {
      setError("Please provide both username/email and password.");
      return;
    }
    setLoading(true);
    const res = await login(signinIdentifier.trim(), signinPassword);
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.message || "Failed to log in");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regFullName.trim() || !regUsername.trim() || !regEmail.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (regPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await register({
      full_name: regFullName.trim(),
      username: regUsername.trim(),
      email: regEmail.trim(),
      password: regPassword,
      avatar_url: selectedAvatar,
      favorite_team: favoriteTeam,
      batting_style: battingStyle,
    });
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.message || "Failed to register account");
    }
  };

  const gamerTagPreview = regFullName.trim()
    ? `${regFullName.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16)}#???`
    : "YourHandle#???";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FFF9E8] border-4 border-black shadow-[8px_8px_0px_#111] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <div className="bg-[#6500C8] p-4 border-b-4 border-black flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Zap className="w-6 h-6 text-[#FFD900] fill-[#FFD900]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display">
              {tab === "signin" ? "Gamer Sign In" : "Claim Gamer Identity"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F000A8] border-2 border-black flex items-center justify-center text-white hover:bg-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b-4 border-black bg-black font-display font-extrabold text-sm uppercase">
          <button
            onClick={() => {
              setTab("signin");
              setError(null);
            }}
            className={`py-3 text-center transition-colors ${
              tab === "signin"
                ? "bg-[#FFD900] text-black"
                : "bg-black text-white hover:bg-[#1f1f2e]"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`py-3 text-center transition-colors ${
              tab === "register"
                ? "bg-[#F000A8] text-white"
                : "bg-black text-white hover:bg-[#1f1f2e]"
            }`}
          >
            Create Gamer Account
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border-3 border-red-600 shadow-[3px_3px_0px_#dc2626] text-red-900 text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {tab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={signinIdentifier}
                    onChange={(e) => setSigninIdentifier(e.target.value)}
                    placeholder="e.g. nishit09 or player@cricket.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#6500C8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type={showSigninPassword ? "text" : "password"}
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-10 py-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#6500C8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSigninPassword(!showSigninPassword)}
                    className="absolute right-3 top-3.5 text-gray-500 hover:text-black"
                  >
                    {showSigninPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 py-4 btn-brutal-purple text-lg uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Enter Six Fingers Arena"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Live Gamer Tag Banner */}
              <div className="p-3 bg-[#6500C8] border-3 border-black shadow-[3px_3px_0px_#111] text-white flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-[#FFD900]">Your Official Gamer Tag</div>
                  <div className="text-xl font-extrabold font-display tracking-wide">{gamerTagPreview}</div>
                </div>
                <AvatarIcon id={selectedAvatar} size="md" />
              </div>

              {/* Avatar Selector Grid */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#F000A8]" /> Choose Your Avatar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatar(av.id)}
                      className={`p-2 border-3 border-black flex flex-col items-center justify-center transition-transform ${
                        selectedAvatar === av.id
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Nishit Patel"
                    required
                    className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Unique Username
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. nishit09"
                    required
                    className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="player@cricket.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 8 chars"
                      required
                      className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showRegPassword ? "text" : "password"}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Password strength meter */}
              {regPassword && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span>Password Strength:</span>
                    <span className="font-bold">{strengthLabels[pwdStrength]}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 h-2">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full border border-black ${
                          pwdStrength >= step ? strengthColors[pwdStrength] : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

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

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3.5 btn-brutal-pink text-lg uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Forging Identity..." : "Create Gamer Profile"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
