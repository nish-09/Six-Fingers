"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./authContext";
import { getApiBaseUrl, getPresenceWsEndpoint } from "./config";

export interface FriendPresence {
  user_id: string;
  state: "ONLINE" | "IN_LOBBY" | "IN_MATCH" | "SPECTATING" | "OFFLINE";
  activity: string;
  room_code?: string | null;
  last_seen: number;
  is_online: boolean;
}

export interface MatchInviteNotification {
  invitation_id: string;
  room_code: string;
  sender_id: string;
  sender_tag: string;
  sender_avatar: string;
}

interface PresenceContextType {
  presences: Record<string, FriendPresence>;
  activeInvite: MatchInviteNotification | null;
  dismissInvite: () => void;
  acceptInvite: (invite: MatchInviteNotification) => Promise<{ room_code: string; player_id: string; session_token: string } | null>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{
  children: React.ReactNode;
  onAcceptRoom?: (roomCode: string, playerId: string, sessionToken: string) => void;
}> = ({ children, onAcceptRoom }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [presences, setPresences] = useState<Record<string, FriendPresence>>({});
  const [activeInvite, setActiveInvite] = useState<MatchInviteNotification | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const wsUrl = getPresenceWsEndpoint(token);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Start heartbeat
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "HEARTBEAT" }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "INITIAL_FRIENDS_PRESENCE") {
          const map: Record<string, FriendPresence> = {};
          (data.friends || []).forEach((f: FriendPresence) => {
            map[f.user_id] = f;
          });
          setPresences(map);
        } else if (data.type === "FRIEND_PRESENCE_UPDATE") {
          const p: FriendPresence = data.presence;
          if (p && p.user_id) {
            setPresences((prev) => ({
              ...prev,
              [p.user_id]: p,
            }));
          }
        } else if (data.type === "MATCH_INVITATION_RECEIVED") {
          setActiveInvite(data.invitation);
        }
      } catch (err) {
        console.warn("Presence message parsing error:", err);
      }
    };

    ws.onclose = () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [isAuthenticated, token]);

  const dismissInvite = () => {
    setActiveInvite(null);
  };

  const acceptInvite = async (invite: MatchInviteNotification) => {
    if (!token) return null;
    const apiBase = getApiBaseUrl();
    try {
      const res = await fetch(`${apiBase}/api/invitations/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          invitation_id: invite.invitation_id,
          action: "accept",
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setActiveInvite(null);
        if (onAcceptRoom) {
          onAcceptRoom(data.room_code, data.player_id, data.session_token);
        }
        return {
          room_code: data.room_code,
          player_id: data.player_id,
          session_token: data.session_token,
        };
      }
    } catch (err) {
      console.warn("Accept invite error:", err);
    }
    return null;
  };

  return (
    <PresenceContext.Provider
      value={{
        presences,
        activeInvite,
        dismissInvite,
        acceptInvite,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
};
