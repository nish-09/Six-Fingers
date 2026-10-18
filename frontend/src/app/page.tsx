"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { LandingHero } from "@/components/LandingHero";
import { DashboardView } from "@/components/DashboardView";
import { LobbyView } from "@/components/LobbyView";
import { LiveMatchView } from "@/components/LiveMatchView";
import { TossModal } from "@/components/TossModal";
import { MatchResultView } from "@/components/MatchResultView";
import { DetailedScorecardModal } from "@/components/DetailedScorecardModal";
import { MatchHistoryModal } from "@/components/MatchHistoryModal";
import { SettingsModal } from "@/components/SettingsModal";
import { AuthModal } from "@/components/AuthModal";
import { MatchmakingModal } from "@/components/MatchmakingModal";
import { FriendsModal } from "@/components/FriendsModal";
import { ProfileModal } from "@/components/ProfileModal";
import { PublicProfileModal } from "@/components/PublicProfileModal";
import { LeaderboardModal } from "@/components/LeaderboardModal";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { WebRTCManager } from "@/lib/webrtc";
import { getApiBaseUrl, getWsEndpoint } from "@/lib/config";
import { useAuth } from "@/lib/authContext";
import { usePresence } from "@/lib/presenceContext";

export default function Home() {
  const { user, profile, token, isAuthenticated } = useAuth();
  const { presences } = usePresence();

  // App views: "landing" | "lobby" | "match"
  const [view, setView] = useState<"landing" | "lobby" | "match">("landing");

  // Player & Room Session State
  const [roomCode, setRoomCode] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [isHost, setIsHost] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<"player" | "spectator">("player");
  const [gameState, setGameState] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Live Gameplay Delivery State
  const [myLockedNumber, setMyLockedNumber] = useState<number | null>(null);
  const [opponentLocked, setOpponentLocked] = useState<boolean>(false);
  const [latestRevealResult, setLatestRevealResult] = useState<any | null>(null);

  // Modals
  const [showDetailedScorecard, setShowDetailedScorecard] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "register">("signin");
  const [showMatchmakingModal, setShowMatchmakingModal] = useState<boolean>(false);
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  const [selectedPublicProfileGamerTag, setSelectedPublicProfileGamerTag] = useState<string | null>(null);
  const [selectedMatchDetail, setSelectedMatchDetail] = useState<any | null>(null);

  // Notifications count
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  // Media & WebRTC
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  // Fetch unread notifications count
  useEffect(() => {
    if (token) {
      const loadUnread = async () => {
        try {
          const res = await fetch(`${getApiBaseUrl()}/api/invitations/notifications?limit=5`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            setUnreadNotifications(data.unread_count || 0);
          }
        } catch (err) {
          console.warn("Error fetching notification count:", err);
        }
      };
      loadUnread();
    }
  }, [token, showNotificationsDrawer]);

  // Handle invitation link on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const joinParam = urlParams.get("join");
      if (joinParam) {
        setRoomCode(joinParam.toUpperCase());
      }
    }
  }, []);

  // WebRTC setup helper
  const setupWebRTC = async (caller: boolean) => {
    if (!webrtcRef.current) {
      const rtc = new WebRTCManager({
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
        },
        onSendSignal: (type, payload) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, payload }));
          }
        },
        onError: (err) => {
          console.warn("WebRTC warning:", err);
        },
      });
      webrtcRef.current = rtc;
    }

    const stream = await webrtcRef.current.startLocalMedia(true, true);
    if (stream) {
      setLocalStream(stream);
    }
    webrtcRef.current.initializePeerConnection(caller);

    if (caller) {
      const offer = await webrtcRef.current.createOffer();
      if (offer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "RTC_OFFER", payload: offer }));
      }
    }
  };

  // WebSocket Connection & Event Dispatcher
  const connectWebSocket = (
    code: string,
    pId: string,
    tok: string,
    host: boolean,
    role: "player" | "spectator"
  ) => {
    const fullWsUrl = getWsEndpoint(code, pId, tok, role);

    const ws = new WebSocket(fullWsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`WebSocket connected to room ${code} as ${role}`);
      if (role === "player") {
        setupWebRTC(host);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("WS Received:", msg.type, msg);

        switch (msg.type) {
          case "INITIAL_STATE":
            setGameState(msg.state);
            setIsHost(msg.is_host);
            if (msg.state.phase === "lobby") {
              setView("lobby");
            } else {
              setView("match");
            }
            if (msg.state.recent_chats) {
              setChatMessages(msg.state.recent_chats);
            }
            break;

          case "PLAYER_CONNECTED":
            if (msg.state) setGameState(msg.state);
            if (isHost && role === "player" && webrtcRef.current) {
              const offer = await webrtcRef.current.createOffer();
              if (offer && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "RTC_OFFER", payload: offer }));
              }
            }
            break;

          case "SPECTATOR_JOINED":
          case "SPECTATOR_LEFT":
            if (msg.state) {
              setGameState(msg.state);
            }
            break;

          case "STATE_UPDATE":
            if (msg.state) {
              setGameState(msg.state);
              if (msg.state.phase === "decision") {
                setMyLockedNumber(null);
                setOpponentLocked(false);
              }
            }
            break;

          case "OPPONENT_LOCKED":
            setOpponentLocked(true);
            break;

          case "MATCH_STARTED":
            if (msg.state) setGameState(msg.state);
            setView("match");
            setMyLockedNumber(null);
            setOpponentLocked(false);
            break;

          case "DELIVERY_REVEAL":
            setLatestRevealResult(msg.result);
            if (msg.state) setGameState(msg.state);
            break;

          case "CHAT_BROADCAST":
            if (msg.message) {
              setChatMessages((prev) => [...prev, msg.message]);
            }
            break;

          case "TOSS_RESULT":
            if (msg.state) setGameState(msg.state);
            break;

          case "RTC_OFFER":
            if (webrtcRef.current && role === "player") {
              const answer = await webrtcRef.current.handleOffer(msg.payload);
              if (answer && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "RTC_ANSWER", payload: answer }));
              }
            }
            break;

          case "RTC_ANSWER":
            if (webrtcRef.current && role === "player") {
              await webrtcRef.current.handleAnswer(msg.payload);
            }
            break;

          case "RTC_ICE_CANDIDATE":
            if (webrtcRef.current && role === "player") {
              await webrtcRef.current.handleIceCandidate(msg.payload);
            }
            break;

          case "MEDIA_STATUS_UPDATE":
            break;

          case "REMATCH_STARTED":
            if (msg.state) setGameState(msg.state);
            setView("match");
            setMyLockedNumber(null);
            setOpponentLocked(false);
            setLatestRevealResult(null);
            break;

          case "PLAYER_DISCONNECTED":
            if (msg.state) setGameState(msg.state);
            break;

          case "ERROR":
            alert(msg.message || "An error occurred");
            break;

          default:
            break;
        }
      } catch (err) {
        console.warn("WS dispatch error:", err);
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };
  };

  // 1. Create Room Flow
  const handleCreateMatch = async (
    hostName: string,
    config?: { playersPerTeam?: number; maxSpectators?: number; overs?: number }
  ) => {
    try {
      const apiUrl = getApiBaseUrl();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiUrl}/api/rooms/create`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          host_name: hostName || profile?.display_name || user?.full_name || "Player 1",
          players_per_team: config?.playersPerTeam ?? 1,
          max_spectators: config?.maxSpectators ?? 20,
        }),
      });

      if (!res.ok) throw new Error("Failed to create match room");
      const data = await res.json();
      setRoomCode(data.room_code);
      setPlayerId(data.player_id);
      setSessionToken(data.session_token);
      setIsHost(true);
      setUserRole("player");
      connectWebSocket(data.room_code, data.player_id, data.session_token, true, "player");
    } catch (err: any) {
      alert("Error creating room: " + err.message);
    }
  };

  // 2. Join Room Flow
  const handleJoinMatch = async (
    code: string,
    playerName: string,
    role: "player" | "spectator" = "player",
    teamId?: "team_a" | "team_b"
  ) => {
    try {
      const apiUrl = getApiBaseUrl();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiUrl}/api/rooms/join`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          room_code: code,
          player_name: playerName || profile?.display_name || user?.full_name || "Player",
          role: role,
          team_id: teamId,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Room not found or full");
      }
      const data = await res.json();
      setRoomCode(data.room_code);
      setPlayerId(data.player_id);
      setSessionToken(data.session_token);
      setIsHost(false);
      const actualRole = data.role || role;
      setUserRole(actualRole);
      connectWebSocket(data.room_code, data.player_id, data.session_token, false, actualRole);
    } catch (err: any) {
      alert("Error joining room: " + err.message);
    }
  };

  // 3. Quick Play Launch
  const handleStartQuickPlay = () => {
    if (!isAuthenticated) {
      setAuthModalTab("register");
      setShowAuthModal(true);
      return;
    }
    setShowMatchmakingModal(true);
  };

  // 4. Matchmaking Result Handler
  const handleMatchFound = (
    rCode: string,
    pId: string,
    sToken: string,
    role: string,
    tId: string
  ) => {
    setShowMatchmakingModal(false);
    setRoomCode(rCode);
    setPlayerId(pId);
    setSessionToken(sToken);
    const host = role === "host";
    setIsHost(host);
    setUserRole("player");
    connectWebSocket(rCode, pId, sToken, host, "player");
  };

  // 5. Send Friend Invitation from Room
  const handleSendRoomInvitation = async (recipientUserId: string) => {
    if (!roomCode || !token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/invitations/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          recipient_user_id: recipientUserId,
          room_code: roomCode,
        }),
      });
      if (res.ok) {
        alert("Invitation sent successfully!");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Failed to send invitation");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Lobby Ready Action
  const handleSetLobbyReady = (ready: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "SET_LOBBY_READY", ready }));
    }
  };

  // Update Rules Action
  const handleUpdateRules = (rules: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "UPDATE_RULES", rules }));
    }
  };

  // Toss Actions
  const handleDoToss = (callChoice: "heads" | "tails") => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "DO_TOSS", call: callChoice }));
    }
  };

  const handleTossDecision = (decision: "bat" | "bowl") => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "TOSS_DECISION", decision }));
    }
  };

  // Secret Hand Submission (Webcam or Keypad)
  const handleSubmitHand = (chosenNumber: number, deliveryId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SUBMIT_HAND",
          chosen_number: chosenNumber,
          delivery_id: deliveryId,
        })
      );
    }
  };

  // Discussion Ready Action
  const handleReadyNextBall = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "READY_NEXT_BALL" }));
    }
  };

  // Over Transition Ready Action
  const handleReadyOverTransition = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "READY_OVER_TRANSITION" }));
    }
  };

  // Manual Controller Selection
  const handleSetManualController = (role: "batting" | "bowling", controllerId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SET_MANUAL_CONTROLLER",
          role,
          controller_id: controllerId,
        })
      );
    }
  };

  // Team & Captain Assignments
  const handleAssignTeam = (targetPlayerId: string, teamId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "ASSIGN_TEAM",
          player_id: targetPlayerId,
          team_id: teamId,
        })
      );
    }
  };

  const handleAssignCaptain = (captainId: string, teamId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "ASSIGN_CAPTAIN",
          captain_id: captainId,
          team_id: teamId,
        })
      );
    }
  };

  const handleUpdateRotation = (
    teamId: string,
    battingOrder: string[],
    bowlingOrder: string[]
  ) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "UPDATE_ROTATION",
          team_id: teamId,
          batting_controller_order: battingOrder,
          bowling_controller_order: bowlingOrder,
        })
      );
    }
  };

  // Social & Chat Action
  const handleSendChat = (channel: "all" | "team" | "spectator", text: string, reaction?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SEND_CHAT",
          channel,
          text,
          reaction,
        })
      );
    }
  };

  // Innings 2 Start Action
  const handleStartInnings2 = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "START_INNINGS_2" }));
    }
  };

  // Rematch Action
  const handleRematch = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "REQUEST_REMATCH" }));
    }
  };

  // Leave Room Action
  const handleLeaveRoom = () => {
    if (wsRef.current) wsRef.current.close();
    if (webrtcRef.current) webrtcRef.current.cleanup();
    setView("landing");
    setRoomCode("");
    setGameState(null);
    setLocalStream(null);
    setRemoteStream(null);
    setUserRole("player");
    setChatMessages([]);
  };

  // View Match Scorecard Detail
  const handleViewMatchDetail = async (matchId: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/matches/${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMatchDetail(data.match);
        setShowDetailedScorecard(true);
      }
    } catch (err) {
      console.warn("Error fetching match detail:", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-[#F000A8] selection:text-white">
      {/* 1. Global Neo-brutalist Header */}
      <Navbar
        roomCode={roomCode}
        spectatorCount={gameState?.spectator_count || 0}
        userRole={userRole}
        onOpenHistory={() => setShowHistory(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAuth={(tab) => {
          setAuthModalTab(tab || "signin");
          setShowAuthModal(true);
        }}
        onOpenFriends={() => setShowFriendsModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenLeaderboard={() => setShowLeaderboardModal(true)}
        onOpenNotifications={() => setShowNotificationsDrawer(true)}
        onStartQuickPlay={handleStartQuickPlay}
        unreadNotificationsCount={unreadNotifications}
      />

      {/* 2. Main Body View Routing */}
      <main className="flex-1 p-3 sm:p-6">
        {view === "landing" && (
          <>
            {isAuthenticated ? (
              <DashboardView
                onStartQuickPlay={handleStartQuickPlay}
                onCreatePrivateRoom={() => handleCreateMatch(profile?.display_name || "Player 1")}
                onJoinRoomCode={(code) => handleJoinMatch(code, profile?.display_name || "Player")}
                onOpenFriends={() => setShowFriendsModal(true)}
                onOpenLeaderboard={() => setShowLeaderboardModal(true)}
                onOpenProfile={() => setShowProfileModal(true)}
                onOpenHistory={() => setShowHistory(true)}
                onViewMatchDetail={handleViewMatchDetail}
              />
            ) : (
              <LandingHero
                onCreateMatch={handleCreateMatch}
                onJoinMatch={handleJoinMatch}
                onOpenAuth={(tab) => {
                  setAuthModalTab(tab || "register");
                  setShowAuthModal(true);
                }}
                onStartQuickPlay={handleStartQuickPlay}
              />
            )}
          </>
        )}

        {view === "lobby" && gameState && (
          <LobbyView
            roomCode={roomCode}
            state={gameState}
            playerId={playerId}
            isHost={isHost}
            userRole={userRole}
            onSetLobbyReady={handleSetLobbyReady}
            onUpdateRules={handleUpdateRules}
            onAssignTeam={handleAssignTeam}
            onAssignCaptain={handleAssignCaptain}
            onUpdateRotation={handleUpdateRotation}
            onLeaveRoom={handleLeaveRoom}
            onInviteFriends={() => setShowFriendsModal(true)}
          />
        )}

        {view === "match" && gameState && (
          <>
            {gameState.phase === "match_end" ? (
              <MatchResultView
                state={gameState}
                playerId={playerId}
                onRematch={handleRematch}
                onOpenDetailedScorecard={() => setShowDetailedScorecard(true)}
                onReturnToLobby={() => {
                  setView("lobby");
                  handleRematch();
                }}
              />
            ) : (
              <LiveMatchView
                state={gameState}
                playerId={playerId}
                isHost={isHost}
                userRole={userRole}
                localStream={localStream}
                remoteStream={remoteStream}
                onSubmitHand={handleSubmitHand}
                onReadyNextBall={handleReadyNextBall}
                onReadyOverTransition={handleReadyOverTransition}
                onSetManualController={handleSetManualController}
                onStartInnings2={handleStartInnings2}
                onOpenDetailedScorecard={() => setShowDetailedScorecard(true)}
                latestRevealResult={latestRevealResult}
                myLockedNumber={myLockedNumber}
                opponentLocked={opponentLocked}
                chatMessages={chatMessages}
                onSendChat={handleSendChat}
              />
            )}
          </>
        )}
      </main>

      {/* 3. Toss Modal */}
      {gameState?.phase === "toss" && (
        <TossModal
          state={gameState}
          playerId={playerId}
          isHost={isHost}
          onDoToss={handleDoToss}
          onTossDecision={handleTossDecision}
        />
      )}

      {/* 4. Detailed Scorecard Modal */}
      {showDetailedScorecard && (selectedMatchDetail || gameState) && (
        <DetailedScorecardModal
          state={selectedMatchDetail || gameState}
          onClose={() => {
            setShowDetailedScorecard(false);
            setSelectedMatchDetail(null);
          }}
        />
      )}

      {/* 5. Match History Modal */}
      {showHistory && <MatchHistoryModal onClose={() => setShowHistory(false)} />}

      {/* 6. Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* 7. Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab={authModalTab}
      />

      {/* 8. Matchmaking Modal */}
      <MatchmakingModal
        isOpen={showMatchmakingModal}
        onClose={() => setShowMatchmakingModal(false)}
        onMatchFound={handleMatchFound}
      />

      {/* 9. Friends Modal */}
      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        activeRoomCode={roomCode}
        onInviteToRoom={handleSendRoomInvitation}
        onViewPublicProfile={(tag) => setSelectedPublicProfileGamerTag(tag)}
      />

      {/* 10. Profile Edit Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* 11. Public Profile Inspector Modal */}
      <PublicProfileModal
        gamerTag={selectedPublicProfileGamerTag}
        onClose={() => setSelectedPublicProfileGamerTag(null)}
      />

      {/* 12. Leaderboard Modal */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        onSelectGamerTag={(tag) => setSelectedPublicProfileGamerTag(tag)}
      />

      {/* 13. Notifications Drawer */}
      <NotificationDrawer
        isOpen={showNotificationsDrawer}
        onClose={() => setShowNotificationsDrawer(false)}
        onSelectNotification={(notif) => {
          if (notif.data?.room_code) {
            handleJoinMatch(notif.data.room_code, profile?.display_name || "Player");
            setShowNotificationsDrawer(false);
          }
        }}
      />

      {/* 14. Footer */}
      <footer className="w-full bg-[#111111] border-t-4 border-[#111111] text-[#FFF9E8] py-4 px-4 text-center text-xs font-bold font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>SIX FINGERS © {new Date().getFullYear()} • TWO HANDS. ONE RIVALRY.</span>
          <span className="text-[#FFD900]">FASTAPI • NEXT.JS • WEBRTC • MEDIAPIPE</span>
        </div>
      </footer>
    </div>
  );
}
