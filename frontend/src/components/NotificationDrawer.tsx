"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { Bell, X, CheckCheck, UserPlus, Swords, Info } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNotification?: (notif: any) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onSelectNotification,
}) => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const apiBase = getApiBaseUrl();

  const loadNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/invitations/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.warn("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      loadNotifications();
    }
  }, [isOpen, token]);

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/invitations/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.warn("Failed to mark notifications read:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#FFF9E8] h-full border-l-4 border-black shadow-[-10px_0px_0px_#111] flex flex-col">
        {/* Header - Inverted Palette */}
        <div className="bg-[#FFD900] p-4 border-b-4 border-black flex items-center justify-between text-black">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#1A0038]" />
            <span className="font-extrabold text-lg tracking-wider uppercase font-display text-black">
              Notifications
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

        {/* Action bar */}
        {unreadCount > 0 && (
          <div className="p-3 bg-white border-b-2 border-black flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600">{unreadCount} unread alert(s)</span>
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-black uppercase text-[#6500C8] hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          </div>
        )}

        {/* Content list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {loading ? (
            <div className="py-8 text-center text-xs font-bold text-gray-500">Checking alert inbox...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-gray-500">
              No notifications yet. Matches and friend invites will appear here!
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => onSelectNotification && onSelectNotification(notif)}
                className={`p-3 border-3 border-black shadow-[2px_2px_0px_#111] transition-transform ${
                  notif.is_read ? "bg-white opacity-85" : "bg-[#FFD900]/30 border-l-8 border-l-[#F000A8]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-black text-white rounded mt-0.5">
                    {notif.type === "FRIEND_REQUEST" ? (
                      <UserPlus className="w-3.5 h-3.5 text-[#9BE52E]" />
                    ) : notif.type === "MATCH_INVITE" ? (
                      <Swords className="w-3.5 h-3.5 text-[#FFD900]" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-[#F000A8]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs">{notif.title}</div>
                    <div className="text-[11px] font-bold text-gray-700 mt-0.5">{notif.message}</div>
                    <div className="text-[9px] font-bold text-gray-400 mt-1">
                      {new Date(notif.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
