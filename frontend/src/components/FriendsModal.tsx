"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { usePresence } from "@/lib/presenceContext";
import { AvatarIcon } from "./Avatars";
import { X, Search, UserPlus, Check, UserMinus, Swords, Eye, Shield, Clock, Users, ArrowUpRight } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteToRoom?: (friendUserId: string) => void;
  onViewPublicProfile?: (gamerTag: string) => void;
  activeRoomCode?: string;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  onInviteToRoom,
  onViewPublicProfile,
  activeRoomCode,
}) => {
  const { user, token } = useAuth();
  const { presences } = usePresence();
  const [tab, setTab] = useState<"friends" | "search" | "requests">("friends");

  // Friends List
  const [friends, setFriends] = useState<any[]>([]);
  const [friendsFilter, setFriendsFilter] = useState<"all" | "online">("all");
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Requests
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);

  // Action feedback
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const apiBase = getApiBaseUrl();

  const fetchFriends = async () => {
    if (!token) return;
    setLoadingFriends(true);
    try {
      const res = await fetch(`${apiBase}/api/friends/list`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.warn("Fetch friends error:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const fetchRequests = async () => {
    if (!token) return;
    try {
      const [resInc, resOut] = await Promise.all([
        fetch(`${apiBase}/api/friends/requests/incoming`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
        fetch(`${apiBase}/api/friends/requests/outgoing`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
      ]);
      if (resInc.ok) {
        const incData = await resInc.json();
        setIncomingRequests(incData.incoming_requests || []);
      }
      if (resOut.ok) {
        const outData = await resOut.json();
        setOutgoingRequests(outData.outgoing_requests || []);
      }
    } catch (err) {
      console.warn("Fetch requests error:", err);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchFriends();
      fetchRequests();
    }
  }, [isOpen, token, tab]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !token) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${apiBase}/api/friends/search?q=${encodeURIComponent(searchQuery.trim())}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.warn("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const handleSendRequest = async (targetUserId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/friends/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage("Friend request sent!");
        setTimeout(() => setActionMessage(null), 3000);
        // Refresh search results
        setSearchResults((prev) =>
          prev.map((r) =>
            r.user_id === targetUserId ? { ...r, relationship: "PENDING_SENT" } : r
          )
        );
      } else {
        setActionMessage(data.detail || "Failed to send request");
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      setActionMessage(err.message || "Network error");
    }
  };

  const handleRespondRequest = async (requestId: string, action: "accept" | "decline") => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/friends/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ request_id: requestId, action }),
      });
      if (res.ok) {
        fetchRequests();
        fetchFriends();
        setActionMessage(action === "accept" ? "Friend request accepted!" : "Request declined.");
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      setActionMessage(err.message);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      const res = await fetch(`${apiBase}/api/friends/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (res.ok) {
        setFriends((prev) => prev.filter((f) => f.user_id !== friendId));
        setActionMessage("Friend removed.");
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      setActionMessage(err.message);
    }
  };

  if (!isOpen) return null;

  // Filtered friends
  const filteredFriends = friends.filter((f) => {
    const livePresence = presences[f.user_id] || f.presence;
    const isOnline = livePresence?.is_online;
    if (friendsFilter === "online") return isOnline;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#FFF9E8] border-4 border-black shadow-[10px_10px_0px_#111] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header - Inverted Palette: Electric Yellow with Dark Text */}
        <div className="bg-[#FFD900] p-4 border-b-4 border-black flex items-center justify-between text-black">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#1A0038]" />
            <span className="font-extrabold text-xl tracking-wider uppercase font-display text-black">
              Gamer Social Circle
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

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 border-b-4 border-black bg-black font-display font-extrabold text-sm uppercase">
          <button
            onClick={() => setTab("friends")}
            className={`py-3 text-center transition-colors ${
              tab === "friends" ? "bg-[#FFD900] text-black" : "bg-black text-white hover:bg-gray-900"
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setTab("search")}
            className={`py-3 text-center transition-colors ${
              tab === "search" ? "bg-[#9BE52E] text-black" : "bg-black text-white hover:bg-gray-900"
            }`}
          >
            Find Rivals
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`py-3 text-center transition-colors relative ${
              tab === "requests" ? "bg-[#F000A8] text-white" : "bg-black text-white hover:bg-gray-900"
            }`}
          >
            Requests
            {incomingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-[#FFD900] text-black rounded-full font-black">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Notification Toast */}
        {actionMessage && (
          <div className="bg-[#9BE52E] border-b-3 border-black p-2 text-center text-xs font-black uppercase tracking-wider animate-in fade-in">
            {actionMessage}
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {tab === "friends" && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setFriendsFilter("all")}
                    className={`px-3 py-1 border-2 border-black text-xs font-black uppercase ${
                      friendsFilter === "all" ? "bg-black text-white" : "bg-white text-black"
                    }`}
                  >
                    All ({friends.length})
                  </button>
                  <button
                    onClick={() => setFriendsFilter("online")}
                    className={`px-3 py-1 border-2 border-black text-xs font-black uppercase ${
                      friendsFilter === "online" ? "bg-[#9BE52E] text-black" : "bg-white text-black"
                    }`}
                  >
                    Online Now
                  </button>
                </div>
              </div>

              {filteredFriends.length === 0 ? (
                <div className="p-8 text-center bg-white border-3 border-dashed border-gray-400">
                  <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <div className="font-extrabold text-base">No Friends Found</div>
                  <p className="text-xs text-gray-600 mt-1">
                    Search for players in the &quot;Find Rivals&quot; tab to build your hand cricket crew!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredFriends.map((friend) => {
                    const live = presences[friend.user_id] || friend.presence;
                    const isOnline = live?.is_online;
                    const stateLabel = live?.state || "OFFLINE";
                    const activity = live?.activity || "Offline";

                    return (
                      <div
                        key={friend.user_id}
                        className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <AvatarIcon id={friend.avatar_url} size="md" />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${
                                stateLabel === "ONLINE"
                                  ? "bg-[#9BE52E]"
                                  : stateLabel === "IN_MATCH"
                                  ? "bg-[#F000A8] animate-pulse"
                                  : stateLabel === "IN_LOBBY"
                                  ? "bg-[#FFD900]"
                                  : "bg-gray-400"
                              }`}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-extrabold text-sm truncate">{friend.gamer_tag}</div>
                            <div className="text-[10px] font-bold text-gray-600 truncate">{activity}</div>
                            <div className="text-[10px] font-bold text-[#6500C8]">
                              Win Rate: <span className="font-black">{friend.win_rate}%</span> ({friend.matches_won}W / {friend.total_matches}M)
                            </div>
                          </div>
                        </div>

                        {/* Friend Action Buttons */}
                        <div className="mt-3 pt-2 border-t-2 border-gray-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => onViewPublicProfile && onViewPublicProfile(friend.gamer_tag)}
                            className="text-[11px] font-black uppercase text-[#6500C8] hover:underline flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Profile
                          </button>

                          <div className="flex items-center gap-2">
                            {onInviteToRoom && isOnline && stateLabel !== "IN_MATCH" && (
                              <button
                                onClick={() => onInviteToRoom(friend.user_id)}
                                className="px-2 py-1 bg-[#FFD900] hover:bg-[#ffe54d] text-black border-2 border-black text-[11px] font-black uppercase shadow-[2px_2px_0px_#111] flex items-center gap-1"
                              >
                                <Swords className="w-3 h-3" /> Invite
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveFriend(friend.user_id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Remove Friend"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "search" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by gamer tag (e.g. Nishit#009) or username..."
                  className="w-full pl-10 pr-4 py-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] font-bold text-sm focus:outline-none"
                />
              </div>

              {searching ? (
                <div className="p-6 text-center text-sm font-bold text-gray-500">Searching arena database...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  {searchQuery ? "No players found matching your query." : "Type a gamer tag or username above to discover players."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResults.map((player) => (
                    <div
                      key={player.user_id}
                      className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_#111] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarIcon id={player.avatar_url} size="md" />
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm truncate">{player.gamer_tag}</div>
                          <div className="text-[10px] font-bold text-gray-500">{player.favorite_team}</div>
                        </div>
                      </div>

                      <div>
                        {player.relationship === "FRIENDS" ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 border border-green-700 text-[10px] font-black uppercase">
                            Friends
                          </span>
                        ) : player.relationship === "PENDING_SENT" ? (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 border border-yellow-700 text-[10px] font-black uppercase">
                            Sent
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(player.user_id)}
                            className="px-2.5 py-1 bg-[#9BE52E] hover:bg-[#82c921] border-2 border-black text-[11px] font-black uppercase shadow-[2px_2px_0px_#111] flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "requests" && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                  Incoming Requests ({incomingRequests.length})
                </h4>
                {incomingRequests.length === 0 ? (
                  <div className="p-4 bg-white border-2 border-dashed border-gray-300 text-xs text-gray-500 text-center">
                    No pending incoming friend requests.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.request_id}
                        className="p-3 bg-white border-3 border-black shadow-[2px_2px_0px_#111] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <AvatarIcon id={req.sender_avatar} size="md" />
                          <div>
                            <div className="font-extrabold text-sm">{req.sender_gamer_tag}</div>
                            <div className="text-[10px] font-bold text-gray-500">{req.sender_name}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRespondRequest(req.request_id, "accept")}
                            className="px-3 py-1 bg-[#9BE52E] hover:bg-[#85c922] border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_#111]"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRespondRequest(req.request_id, "decline")}
                            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 border-2 border-black text-xs font-black uppercase"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                  Outgoing Requests ({outgoingRequests.length})
                </h4>
                {outgoingRequests.length === 0 ? (
                  <div className="p-4 bg-white border-2 border-dashed border-gray-300 text-xs text-gray-500 text-center">
                    No pending outgoing requests.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outgoingRequests.map((req) => (
                      <div
                        key={req.request_id}
                        className="p-3 bg-white border-3 border-black shadow-[2px_2px_0px_#111] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <AvatarIcon id={req.recipient_avatar} size="md" />
                          <div>
                            <div className="font-extrabold text-sm">{req.recipient_gamer_tag}</div>
                            <div className="text-[10px] font-bold text-gray-500">Waiting for response</div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
