"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { LandingHero } from "@/components/LandingHero";
import { LobbyView } from "@/components/LobbyView";
import { LiveMatchView } from "@/components/LiveMatchView";
import { TossModal } from "@/components/TossModal";
import { MatchResultView } from "@/components/MatchResultView";
import { DetailedScorecardModal } from "@/components/DetailedScorecardModal";
import { MatchHistoryModal } from "@/components/MatchHistoryModal";
import { SettingsModal } from "@/components/SettingsModal";
import { WebRTCManager } from "@/lib/webrtc";
import { soundEngine } from "@/lib/sound";

export default function Home() {
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

  // Media & WebRTC
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

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
    token: string,
    host: boolean,
    role: "player" | "spectator"
  ) => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000/ws`;
    const fullWsUrl = `${wsUrl}/${code}?player_id=${pId}&session_token=${token}&role=${role}`;

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
            // If we are host and a player just connected, initiate WebRTC offer
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

          case "TOSS_RESULT":
            setGameState((prev: any) => ({
              ...prev,
              toss_winner_id: msg.toss_winner_id,
            }));
            break;

          case "MATCH_STARTED":
            if (msg.state) {
              setGameState(msg.state);
              setView("match");
              setMyLockedNumber(null);
              setOpponentLocked(false);
              setLatestRevealResult(null);
            }
            break;

          case "SECRET_LOCKED":
            setMyLockedNumber(msg.chosen_number);
            break;

          case "OPPONENT_LOCKED":
          case "CONTROLLER_LOCKED":
            setOpponentLocked(true);
            break;

          case "SIMULTANEOUS_REVEAL":
            setLatestRevealResult(msg.delivery_result);
            if (msg.state) setGameState(msg.state);
            break;

          case "OVER_TRANSITION_READY":
            if (msg.state) setGameState(msg.state);
            break;

          case "CHAT_MESSAGE":
            if (msg.message) {
              setChatMessages((prev) => [...prev, msg.message]);
            }
            break;

          case "REMATCH_STARTED":
            if (msg.state) {
              setGameState(msg.state);
              setMyLockedNumber(null);
              setOpponentLocked(false);
              setLatestRevealResult(null);
              setView("match");
            }
            break;

          // WebRTC Signaling
          case "RTC_OFFER":
            if (webrtcRef.current && msg.payload) {
              const answer = await webrtcRef.current.handleOffer(msg.payload);
              if (answer && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "RTC_ANSWER", payload: answer }));
              }
            }
            break;

          case "RTC_ANSWER":
            if (webrtcRef.current && msg.payload) {
              await webrtcRef.current.handleAnswer(msg.payload);
            }
            break;

          case "RTC_ICE_CANDIDATE":
            if (webrtcRef.current && msg.payload) {
              await webrtcRef.current.handleIceCandidate(msg.payload);
            }
            break;

          case "SUBMISSION_ERROR":
            alert(msg.message);
            break;
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/rooms/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host_name: hostName,
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_code: code,
          player_name: playerName,
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

  // Leave Room
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

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-[#F000A8] selection:text-white">
      {/* 1. Global Neo-brutalist Header */}
      <Navbar
        roomCode={roomCode}
        spectatorCount={gameState?.spectator_count || 0}
        userRole={userRole}
        onOpenHistory={() => setShowHistory(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* 2. Main Body View Routing */}
      <main className="flex-1 p-3 sm:p-6">
        {view === "landing" && (
          <LandingHero onCreateMatch={handleCreateMatch} onJoinMatch={handleJoinMatch} />
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

      {/* 3. Toss Modal (Triggers when both ready in lobby or rematch) */}
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
      {showDetailedScorecard && gameState && (
        <DetailedScorecardModal
          state={gameState}
          onClose={() => setShowDetailedScorecard(false)}
        />
      )}

      {/* 5. Match History Modal */}
      {showHistory && <MatchHistoryModal onClose={() => setShowHistory(false)} />}

      {/* 6. Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* 7. Footer */}
      <footer className="w-full bg-[#111111] border-t-4 border-[#111111] text-[#FFF9E8] py-4 px-4 text-center text-xs font-bold font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>SIX FINGERS © {new Date().getFullYear()} • MULTIPLAYER HAND CRICKET</span>
          <span className="text-[#FFD900]">POWERED BY WEBRTC, FASTAPI & MEDIAPIPE</span>
        </div>
      </footer>
    </div>
  );
}
