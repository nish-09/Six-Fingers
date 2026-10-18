"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getApiBaseUrl } from "./config";

export interface User {
  id: string;
  username: string;
  gamer_tag?: string;
  email: string;
  full_name: string;
  created_at?: number;
  last_login_at?: number;
}

export interface Profile {
  user_id: string;
  display_name: string;
  gamer_tag: string;
  tag_number?: number;
  avatar_url: string;
  bio?: string;
  age?: number | null;
  country?: string;
  favorite_team?: string;
  custom_team_name?: string;
  batting_style?: string;
  bowling_style?: string;
  total_matches: number;
  matches_won: number;
  matches_lost: number;
  win_rate: number;
  total_runs: number;
  total_wickets: number;
  current_streak: number;
  best_streak: number;
  is_public: boolean;
  show_age?: boolean;
  show_stats?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: any) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ success: boolean; message?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const apiBase = getApiBaseUrl();

  const refreshUser = async (authToken?: string) => {
    const activeToken = authToken || token || (typeof window !== "undefined" ? localStorage.getItem("sf_token") : null);
    if (!activeToken) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
        setToken(activeToken);
        if (typeof window !== "undefined") {
          localStorage.setItem("sf_token", activeToken);
        }
      } else {
        // Token invalid or expired
        setUser(null);
        setProfile(null);
        setToken(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("sf_token");
        }
      }
    } catch (err) {
      console.warn("Auth verify error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedToken = typeof window !== "undefined" ? localStorage.getItem("sf_token") : null;
    refreshUser(savedToken || undefined);
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username_or_email: usernameOrEmail,
          password: password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.detail || "Invalid login credentials" };
      }

      setUser(data.user);
      setProfile(data.profile);
      setToken(data.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem("sf_token", data.access_token);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error. Please try again." };
    }
  };

  const register = async (data: any) => {
    try {
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) {
        return { success: false, message: resData.detail || "Failed to create account" };
      }

      setUser(resData.user);
      setProfile(resData.profile);
      setToken(resData.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem("sf_token", resData.access_token);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || "Registration error" };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiBase}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setUser(null);
      setProfile(null);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("sf_token");
      }
    }
  };

  const updateProfile = async (updateData: Partial<Profile>) => {
    if (!token) return { success: false, message: "Not authenticated" };
    try {
      const res = await fetch(`${apiBase}/api/profiles/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(updateData),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.detail || "Failed to update profile" };
      }

      setProfile(data.profile);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to update profile" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
