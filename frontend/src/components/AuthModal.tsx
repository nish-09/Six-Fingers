"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/authContext";
import { AvatarIcon, AVATAR_OPTIONS } from "./Avatars";
import { getApiBaseUrl } from "@/lib/config";
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Zap,
  Eye,
  EyeOff,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Dices,
  Trash2,
  UserCheck,
  Shield
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "register";
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

  // Register Form - Step / Section 1: Personal Information
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Register Form - Step / Section 2: Gamer Identity
  const [regUsername, setRegUsername] = useState("");
  const [regGamerTag, setRegGamerTag] = useState("#4821");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [usernameMessage, setUsernameMessage] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Avatar Selection / Custom Upload
  const [selectedAvatar, setSelectedAvatar] = useState("avatar_1");
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Register Form - Step / Section 3: Cricket Preferences
  const [regTeamName, setRegTeamName] = useState("Mumbai Blasters");
  const [regBattingStyle, setRegBattingStyle] = useState("Right-handed");
  const [regBowlingStyle, setRegBowlingStyle] = useState("Right-arm medium");

  // State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate random 4-digit gamer tag
  const generateRandomTag = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newTag = `#${randomNum}`;
    setRegGamerTag(newTag);
  };

  // Debounced check username availability considering current gamer tag
  const checkUsernameAvailability = useCallback(async (u: string, tag: string) => {
    const trimmedU = u.trim();
    if (!trimmedU) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      setSuggestions([]);
      return;
    }

    if (trimmedU.length < 3 || trimmedU.length > 24 || !/^[a-zA-Z0-9_]+$/.test(trimmedU)) {
      setUsernameStatus("invalid");
      setUsernameMessage("Username must be 3-24 alphanumeric characters or underscores.");
      setSuggestions([]);
      return;
    }

    setUsernameStatus("checking");
    setUsernameMessage("Checking availability...");
    setSuggestions([]);

    try {
      const apiBase = getApiBaseUrl();
      const cleanTag = tag.trim().replace(/^#/, "");
      const res = await fetch(
        `${apiBase}/api/auth/check-username?username=${encodeURIComponent(trimmedU)}&gamer_tag=${encodeURIComponent(cleanTag)}`
      );

      if (!res.ok) {
        setUsernameStatus("error");
        setUsernameMessage("Unable to verify username. Please try again.");
        return;
      }

      const data = await res.json();
      if (data.available) {
        setUsernameStatus("available");
        setUsernameMessage(data.message || "Username available");
        setSuggestions([]);
      } else {
        setUsernameStatus("taken");
        setUsernameMessage(data.message || "Username already taken for this Gamer ID");
        setSuggestions(data.suggestions || []);
      }
    } catch {
      setUsernameStatus("error");
      setUsernameMessage("Unable to verify username. Please try again.");
    }
  }, []);

  // Trigger availability check when username or gamer tag changes
  useEffect(() => {
    if (tab !== "register") return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (regUsername.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        checkUsernameAvailability(regUsername, regGamerTag);
      }, 400);
    } else {
      setUsernameStatus("idle");
      setUsernameMessage("");
      setSuggestions([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [regUsername, regGamerTag, tab, checkUsernameAvailability]);

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
  const strengthLabels = ["Too Short", "Weak", "Fair", "Good", "Strong"];
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

  // Avatar file upload handler
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Avatar image must be smaller than 2MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate mime type
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
        setCustomAvatarPreview(data.avatar_url);
        setSelectedAvatar(data.avatar_url);
      }
    } catch {
      setAvatarError("Network error uploading avatar. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveCustomAvatar = () => {
    setCustomAvatarPreview(null);
    setSelectedAvatar("avatar_1");
    setAvatarError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!regFullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!regUsername.trim()) {
      setError("Username is required.");
      return;
    }

    if (!regEmail.trim()) {
      setError("Email address is required.");
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

    if (usernameStatus === "taken") {
      setError("The chosen username is already taken for this Gamer Tag. Please pick a suggested alternative or change the tag.");
      return;
    }

    const cleanTag = regGamerTag.trim().replace(/^#/, "");
    if (cleanTag && !/^[a-zA-Z0-9]{2,8}$/.test(cleanTag)) {
      setError("Gamer Tag must be 2-8 alphanumeric characters (e.g. #4821).");
      return;
    }

    setLoading(true);
    const res = await register({
      full_name: regFullName.trim(),
      username: regUsername.trim(),
      gamer_tag: `#${cleanTag || "0001"}`,
      email: regEmail.trim(),
      password: regPassword,
      avatar_url: selectedAvatar,
      favorite_team: regTeamName.trim() || "Mumbai Blasters",
      custom_team_name: regTeamName.trim(),
      batting_style: regBattingStyle,
      bowling_style: regBowlingStyle,
    });
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.message || "Failed to register account");
    }
  };

  const formattedTag = regGamerTag.startsWith("#") ? regGamerTag : `#${regGamerTag}`;
  const gamerIdentityPreview = regUsername.trim()
    ? `${regUsername.trim()}${formattedTag}`
    : `username${formattedTag}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#FFF9E8] border-4 border-black shadow-[8px_8px_0px_#111] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <div className="bg-[#6500C8] p-4 border-b-4 border-black flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Zap className="w-6 h-6 text-[#FFD900] fill-[#FFD900]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display">
              {tab === "signin" ? "Gamer Sign In" : "Player Registration"}
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
            Register Account
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
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={signinIdentifier}
                    onChange={(e) => setSigninIdentifier(e.target.value)}
                    placeholder="Enter your username or email"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
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
                    className="w-full pl-10 pr-10 py-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
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
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  "Enter Six Fingers Arena"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              {/* SECTION 1: Personal Information */}
              <div className="border-3 border-black p-4 bg-white shadow-[4px_4px_0px_#111]">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-black">
                  <span className="w-6 h-6 rounded-full bg-[#FFD900] border-2 border-black text-black font-black text-xs flex items-center justify-center">1</span>
                  <h3 className="font-display font-black text-sm uppercase tracking-wider text-black">Personal Information</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                      className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="Enter your email address"
                        required
                        className="w-full pl-9 pr-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                        Password
                      </label>
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                        Confirm Password
                      </label>
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        required
                        className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
                      />
                    </div>
                  </div>

                  {/* Password strength meter */}
                  {regPassword && (
                    <div className="space-y-1 pt-1">
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
                </div>
              </div>

              {/* SECTION 2: Gamer Identity */}
              <div className="border-3 border-black p-4 bg-white shadow-[4px_4px_0px_#111]">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-black">
                  <span className="w-6 h-6 rounded-full bg-[#FFD900] border-2 border-black text-black font-black text-xs flex items-center justify-center">2</span>
                  <h3 className="font-display font-black text-sm uppercase tracking-wider text-black">Gamer Identity</h3>
                </div>

                {/* Live Gamer Tag Banner */}
                <div className="p-3 mb-4 bg-[#1A0038] border-3 border-black shadow-[3px_3px_0px_#111] text-white flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase text-[#FFD900]">Your Official Gamer Identity</div>
                    <div className="text-xl font-extrabold font-display tracking-wide text-white">
                      {gamerIdentityPreview}
                    </div>
                    <div className="text-[10px] text-gray-300">
                      Unique composite ID: Same username allowed across different Gamer Tags
                    </div>
                  </div>
                  <AvatarIcon id={selectedAvatar} size="md" />
                </div>

                {/* Username & Gamer Tag inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                      Username
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="Choose a username"
                      required
                      className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-black uppercase tracking-wider text-black">
                        Gamer Tag
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomTag}
                        title="Generate random tag"
                        className="text-[10px] font-black uppercase text-[#6500C8] hover:underline flex items-center gap-0.5"
                      >
                        <Dices className="w-3 h-3" /> Roll
                      </button>
                    </div>
                    <input
                      type="text"
                      value={regGamerTag}
                      onChange={(e) => setRegGamerTag(e.target.value)}
                      placeholder="Enter your gamer tag"
                      required
                      className="w-full px-3 py-2.5 bg-white border-3 border-black shadow-[2px_2px_0px_#111] font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FFD900]"
                    />
                  </div>
                </div>

                {/* Username Availability Feedback */}
                {usernameStatus !== "idle" && (
                  <div className="mt-2 text-xs font-bold">
                    {usernameStatus === "checking" && (
                      <div className="flex items-center gap-1.5 text-blue-700">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking availability...</span>
                      </div>
                    )}
                    {usernameStatus === "available" && (
                      <div className="flex items-center gap-1.5 text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        <span>{usernameMessage}</span>
                      </div>
                    )}
                    {usernameStatus === "taken" && (
                      <div className="space-y-1.5 text-red-600">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>{usernameMessage}</span>
                        </div>
                        {suggestions.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[11px] text-gray-700 block mb-1">
                              Available alternatives for tag {formattedTag}:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {suggestions.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => setRegUsername(sug)}
                                  className="px-2 py-0.5 bg-[#FFD900] border border-black font-extrabold text-[11px] text-black shadow-[1px_1px_0px_#000] hover:bg-[#F000A8] hover:text-white transition-colors"
                                >
                                  +{sug}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {(usernameStatus === "invalid" || usernameStatus === "error") && (
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{usernameMessage}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Avatar Selection & Upload */}
                <div className="mt-4 pt-3 border-t-2 border-black/20">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#F000A8]" /> Avatar
                    </label>
                    <span className="text-[11px] text-gray-600">Preset or Custom Upload</span>
                  </div>

                  {/* Custom upload area */}
                  <div className="mb-3 p-3 bg-gray-50 border-2 border-dashed border-black flex flex-col sm:flex-row items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                      id="avatar-file-input"
                    />

                    {customAvatarPreview ? (
                      <div className="flex items-center gap-3 w-full">
                        <img
                          src={customAvatarPreview}
                          alt="Custom Avatar Preview"
                          className="w-12 h-12 rounded-full border-2 border-black object-cover shadow-[2px_2px_0px_#111]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-green-700 truncate">Custom Avatar Selected</p>
                          <p className="text-[10px] text-gray-500">Persisted safely to your profile</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2 py-1 text-xs font-black border border-black bg-white shadow-[1px_1px_0px_#000] hover:bg-gray-100"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveCustomAvatar}
                            className="p-1 border border-black bg-red-100 text-red-700 hover:bg-red-200"
                            title="Remove custom avatar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Upload className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-xs font-bold text-black">Upload Custom Image</p>
                            <p className="text-[10px] text-gray-500">PNG, JPEG, or WebP (max 2MB)</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={avatarUploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 text-xs font-black uppercase border-2 border-black bg-[#FFD900] shadow-[2px_2px_0px_#000] hover:bg-[#ffe54c] active:translate-y-0.5"
                        >
                          {avatarUploading ? "Uploading..." : "Browse File"}
                        </button>
                      </div>
                    )}
                  </div>

                  {avatarError && (
                    <div className="mb-2 text-xs font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{avatarError}</span>
                    </div>
                  )}

                  {/* Preset Avatar Grid */}
                  <div>
                    <span className="block text-[11px] font-bold text-gray-600 mb-1.5">Or choose a preset avatar:</span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => {
                            setSelectedAvatar(av.id);
                            setCustomAvatarPreview(null);
                          }}
                          className={`p-1.5 border-2 border-black flex flex-col items-center justify-center transition-transform ${
                            selectedAvatar === av.id && !customAvatarPreview
                              ? "bg-[#FFD900] shadow-[2px_2px_0px_#111] scale-105"
                              : "bg-white hover:bg-gray-100"
                          }`}
                        >
                          <AvatarIcon id={av.id} size="sm" />
                          <span className="text-[9px] font-black mt-1 truncate max-w-full text-black">{av.name.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Cricket Preferences */}
              <div className="border-3 border-black p-4 bg-white shadow-[4px_4px_0px_#111]">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-black">
                  <span className="w-6 h-6 rounded-full bg-[#FFD900] border-2 border-black text-black font-black text-xs flex items-center justify-center">3</span>
                  <h3 className="font-display font-black text-sm uppercase tracking-wider text-black">Cricket Preferences</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                      Custom Team Name
                    </label>
                    <input
                      type="text"
                      value={regTeamName}
                      onChange={(e) => setRegTeamName(e.target.value)}
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
                          onClick={() => setRegTeamName(team)}
                          className="px-1.5 py-0.5 text-[10px] font-bold border border-black/40 bg-gray-100 hover:bg-[#FFD900] text-black transition-colors"
                        >
                          {team}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1 text-black">
                        Batting Style
                      </label>
                      <select
                        value={regBattingStyle}
                        onChange={(e) => setRegBattingStyle(e.target.value)}
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
                        value={regBowlingStyle}
                        onChange={(e) => setRegBowlingStyle(e.target.value)}
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
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || usernameStatus === "checking" || usernameStatus === "taken"}
                className="w-full mt-4 py-4 btn-brutal-pink text-lg uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Registering Account...</span>
                  </>
                ) : (
                  "Create Gamer Profile"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
