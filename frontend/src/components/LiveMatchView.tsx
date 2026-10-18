import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  Sparkles,
  Trophy,
  ArrowRight,
  Hand,
  Volume2,
  Users,
  Shield,
  RotateCw,
  Lock,
  Radio
} from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { speechManager } from "@/lib/speech";
import { gestureRecognizer, GestureResult } from "@/lib/vision/gestureRecognizer";
import { Scoreboard } from "./Scoreboard";
import { CricketBallIcon, StarSticker } from "./Stickers";
import { ChatDrawer, ChatMessageItem } from "./ChatDrawer";
import { WebcamEffectsModal } from "./WebcamEffectsModal";
import { VoiceEffectsModal } from "./VoiceEffectsModal";
import { CinematicMatchOverlay } from "./CinematicMatchOverlay";
import { WebcamEffectId, WebcamEffectsPipeline } from "@/lib/webcamEffects";
import { VoicePresetId, globalAudioEffects } from "@/lib/audioEffects";

interface LiveMatchViewProps {
  state: any;
  playerId: string;
  isHost: boolean;
  userRole?: "player" | "spectator";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onSubmitHand: (chosenNumber: number, deliveryId: string) => void;
  onReadyNextBall: () => void;
  onReadyOverTransition?: () => void;
  onSetManualController?: (role: "batting" | "bowling", controllerId: string) => void;
  onStartInnings2: () => void;
  onOpenDetailedScorecard: () => void;
  latestRevealResult: any | null;
  myLockedNumber: number | null;
  opponentLocked: boolean;
  chatMessages?: ChatMessageItem[];
  onSendChat?: (channel: "all" | "team" | "spectator", text: string, reaction?: string) => void;
  onSendMessage?: (channel: string, text: string, reaction?: string) => void;
  onApplyWebcamEffectTrack?: (track: MediaStreamTrack | null) => void;
  onApplyVoiceEffectTrack?: (track: MediaStreamTrack | null) => void;
}

export const LiveMatchView: React.FC<LiveMatchViewProps> = ({
  state,
  playerId,
  isHost,
  userRole = "player",
  localStream,
  remoteStream,
  onSubmitHand,
  onReadyNextBall,
  onReadyOverTransition,
  onSetManualController,
  onStartInnings2,
  onOpenDetailedScorecard,
  latestRevealResult,
  myLockedNumber,
  opponentLocked,
  chatMessages = [],
  onSendChat,
  onSendMessage,
  onApplyWebcamEffectTrack,
  onApplyVoiceEffectTrack,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filteredCanvasRef = useRef<HTMLCanvasElement>(null);

  // Effects & Modulator State
  const [isEffectsModalOpen, setIsEffectsModalOpen] = useState(false);
  const [activeWebcamEffect, setActiveWebcamEffect] = useState<WebcamEffectId>("none");
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [activeVoiceEffect, setActiveVoiceEffect] = useState<VoicePresetId>("normal");
  const pipelineRef = useRef<WebcamEffectsPipeline | null>(null);

  // Media toggles
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  // Chat Drawer toggle
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Vision detection state
  const [currentGesture, setCurrentGesture] = useState<GestureResult | null>(null);
  const [manualChosenNumber, setManualChosenNumber] = useState<number | null>(null);
  const [decisionSecondsLeft, setDecisionSecondsLeft] = useState<number>(5);

  // Connect streams to video elements and initialize effects pipeline
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      if (!pipelineRef.current) {
        pipelineRef.current = new WebcamEffectsPipeline(640, 480);
      }
      pipelineRef.current.setVideoSource(localVideoRef.current);
    }
  }, [localStream]);

  // Audio Effects initialization
  useEffect(() => {
    if (localStream) {
      globalAudioEffects.init(localStream);
    }
    return () => {
      pipelineRef.current?.stop();
    };
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Synchronize canvas animation loop for filtered display
  useEffect(() => {
    let animId: number;
    const updateFilteredDisplay = () => {
      if (activeWebcamEffect !== "none" && pipelineRef.current && filteredCanvasRef.current) {
        const destCtx = filteredCanvasRef.current.getContext("2d");
        if (destCtx) {
          destCtx.clearRect(0, 0, 640, 480);
          destCtx.drawImage(pipelineRef.current.getCanvas(), 0, 0);
        }
      }
      animId = requestAnimationFrame(updateFilteredDisplay);
    };
    if (activeWebcamEffect !== "none") {
      animId = requestAnimationFrame(updateFilteredDisplay);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [activeWebcamEffect]);

  const handleSelectWebcamEffect = (fx: WebcamEffectId) => {
    setActiveWebcamEffect(fx);
    if (!pipelineRef.current) return;
    pipelineRef.current.setEffect(fx);
    if (fx !== "none") {
      pipelineRef.current.start();
      const track = pipelineRef.current.getProcessedTrack();
      if (track && onApplyWebcamEffectTrack) {
        onApplyWebcamEffectTrack(track);
      }
    } else {
      pipelineRef.current.stop();
      if (onApplyWebcamEffectTrack) {
        onApplyWebcamEffectTrack(null);
      }
    }
  };

  const handleSelectVoicePreset = (preset: VoicePresetId) => {
    setActiveVoiceEffect(preset);
    globalAudioEffects.setPreset(preset);
    if (preset !== "normal") {
      const track = globalAudioEffects.getProcessedTrack();
      if (track && onApplyVoiceEffectTrack) {
        onApplyVoiceEffectTrack(track);
      }
    } else {
      if (onApplyVoiceEffectTrack) {
        onApplyVoiceEffectTrack(null);
      }
    }
  };

  // Audio / Video track control
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
        soundEngine.playClick();
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
        soundEngine.playClick();
      }
    }
  };

  // Synchronized countdown timer for DECISION phase
  useEffect(() => {
    if (state.phase !== "decision") return;

    const timer = setInterval(() => {
      const deadline = state.decision_deadline || 0;
      const now = Date.now() / 1000;
      const left = Math.max(0, Math.ceil(deadline - now));
      setDecisionSecondsLeft(left);

      if (left > 0 && left <= 3) {
        soundEngine.playTick(left === 1);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [state.phase, state.decision_deadline]);

  // Clear choices when a new delivery begins
  useEffect(() => {
    if (state.phase === "decision") {
      setManualChosenNumber(null);
      gestureRecognizer.reset();
      setCurrentGesture(null);
    }
  }, [state.current_delivery_id, state.phase]);

  // Roles & active controllers
  const currentInnings = state.innings_list && state.innings_list[state.current_innings_number - 1];
  const activeBatId = state.active_batting_controller_id || state.player_1_id;
  const activeBowlId = state.active_bowling_controller_id || state.player_2_id;

  const isActiveBatting = playerId === activeBatId;
  const isActiveBowling = playerId === activeBowlId;
  const isActiveController = isActiveBatting || isActiveBowling;
  const isSpectator =
    userRole === "spectator" ||
    state.user_role === "spectator" ||
    state.participants?.[playerId]?.role === "spectator" ||
    (state.spectators && state.spectators.includes(playerId));

  const activeBatName = state.participants?.[activeBatId]?.name || state.player_1_name || "Batter";
  const activeBowlName = state.participants?.[activeBowlId]?.name || state.player_2_name || "Bowler";
  const nextBatName = state.next_batting_controller_id ? state.participants?.[state.next_batting_controller_id]?.name : null;
  const nextBowlName = state.next_bowling_controller_id ? state.participants?.[state.next_bowling_controller_id]?.name : null;

  // Client-side Vision Frame Loop with MediaPipe Hand Landmarker (ONLY for active controller!)
  useEffect(() => {
    if (state.phase !== "decision" || myLockedNumber !== null || !isActiveController) return;

    let animId: number;
    let handLandmarker: any = null;
    let isCancelled = false;

    const setupMediaPipe = async () => {
      try {
        const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        if (isCancelled) return;
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch (err) {
        console.warn("MediaPipe note: fallback or waiting", err);
      }
    };

    setupMediaPipe();

    const processFrame = () => {
      if (isCancelled) return;
      const video = localVideoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && handLandmarker && canvas) {
        const results = handLandmarker.detectForVideo(video, performance.now());
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (results.landmarks && results.landmarks[0]) {
            const rawLandmarks = results.landmarks[0];
            const gestureRes = gestureRecognizer.interpretLandmarks(rawLandmarks);
            setCurrentGesture(gestureRes);

            // Draw skeleton overlay
            ctx.fillStyle = "#9BE52E";
            ctx.strokeStyle = "#111111";
            ctx.lineWidth = 3;
            rawLandmarks.forEach((pt: any) => {
              const x = pt.x * canvas.width;
              const y = pt.y * canvas.height;
              ctx.beginPath();
              ctx.arc(x, y, 5, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
            });

            // Auto-lock when stable pose confirmed
            if (gestureRes.isStable && gestureRes.number !== null && myLockedNumber === null) {
              soundEngine.playBatHit();
              onSubmitHand(gestureRes.number, state.current_delivery_id);
            }
          } else {
            setCurrentGesture(null);
          }
        }
      }
      animId = requestAnimationFrame(processFrame);
    };

    animId = requestAnimationFrame(processFrame);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      if (handLandmarker) {
        try {
          handLandmarker.close();
        } catch (_) {}
      }
    };
  }, [state.phase, state.current_delivery_id, myLockedNumber, isActiveController]);

  // Audio / Confetti on Simultaneous Reveal
  useEffect(() => {
    if (state.phase === "reveal" && latestRevealResult) {
      if (latestRevealResult.is_wicket) {
        soundEngine.playWicket();
      } else if (latestRevealResult.runs_scored === 6) {
        soundEngine.playSixFanfare();
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } else if (latestRevealResult.runs_scored === 4) {
        soundEngine.playFourFanfare();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } else {
        soundEngine.playBatHit();
      }

      if (latestRevealResult.commentary_text) {
        speechManager.speak(latestRevealResult.commentary_text);
      }
    }
  }, [state.phase, latestRevealResult]);

  // In-Game Player Stats
  const strikerStats = currentInnings?.batters?.[state.current_striker_id || ""];
  const nonStrikerStats = currentInnings?.batters?.[state.current_non_striker_id || ""];
  const bowlerStats = currentInnings?.bowlers?.[state.current_bowler_id || ""];

  // Readiness
  const isMyReady = Boolean(state.ready_for_next_ball?.[playerId]);
  const isOverReady = Boolean(state.over_transition_ready?.[playerId]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* 1. SCOREBOARD */}
      {currentInnings && (
        <Scoreboard
          currentInningsNum={state.current_innings_number}
          battingTeamName={currentInnings.batting_team_name}
          bowlingTeamName={currentInnings.bowling_team_name}
          totalRuns={currentInnings.total_runs}
          wickets={currentInnings.wickets}
          ballsBowled={currentInnings.balls_bowled}
          ballsPerOver={state.rules.balls_per_over}
          totalOvers={state.rules.overs_per_innings}
          target={currentInnings.target}
          strikerName={strikerStats?.name}
          strikerRuns={strikerStats?.runs}
          strikerBalls={strikerStats?.balls_faced}
          strikerFours={strikerStats?.fours}
          strikerSixes={strikerStats?.sixes}
          nonStrikerName={nonStrikerStats?.name}
          nonStrikerRuns={nonStrikerStats?.runs}
          nonStrikerBalls={nonStrikerStats?.balls_faced}
          bowlerName={bowlerStats?.name}
          bowlerOvers={`${Math.floor((bowlerStats?.balls_bowled || 0) / state.rules.balls_per_over)}.${(bowlerStats?.balls_bowled || 0) % state.rules.balls_per_over}`}
          bowlerRuns={bowlerStats?.runs_conceded}
          bowlerWickets={bowlerStats?.wickets}
          activeBattingControllerName={activeBatName}
          activeBowlingControllerName={activeBowlName}
          nextBattingControllerName={nextBatName || undefined}
          nextBowlingControllerName={nextBowlName || undefined}
          spectatorCount={state.spectator_count || 0}
          recentDeliveries={currentInnings.deliveries?.slice(-6).map((d: any) => ({
            runs: d.runs_scored,
            isWicket: d.is_wicket,
            ballNum: d.ball_in_over,
          }))}
          latestCommentary={latestRevealResult?.commentary_text?.[speechManager.getLanguage()]}
          onOpenDetailedScorecard={onOpenDetailedScorecard}
        />
      )}

      {/* 2. MAIN ARENA (VIDEO / DECISION AREA) */}
      {isActiveController ? (
        /* ACTIVE CONTROLLER ARENA: Your Camera + Opponent Shield */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* YOU (Active Controller) */}
          <div className="relative panel-brutal-purple p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#9BE52E] border border-black animate-pulse" />
                <span className="font-display font-black text-sm uppercase text-[#FFD900]">
                  YOU ({isActiveBatting ? "BATTING CONTROL 🏏" : "BOWLING CONTROL 🎯"})
                </span>
              </div>
              {myLockedNumber !== null && (
                <span className="bg-[#9BE52E] text-[#111111] text-xs font-black px-2 py-0.5 rounded-md border-2 border-black flex items-center gap-1 shadow-sm">
                  <CheckCircle className="w-3.5 h-3.5" /> LOCKED ({myLockedNumber})
                </span>
              )}
            </div>

            {/* Local Video & Landmark Overlay Canvas */}
            <div className="relative w-full aspect-video bg-[#111111] rounded-xl border-3 border-[#111111] overflow-hidden flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
              />
              {/* Processed Filtered Video Canvas Overlay */}
              <canvas
                ref={filteredCanvasRef}
                width={640}
                height={480}
                className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
                  activeWebcamEffect !== "none" ? "block" : "hidden"
                }`}
              />

              {/* In-Game Cinematic Delivery & Victory Celebration Overlay */}
              <CinematicMatchOverlay
                revealResult={latestRevealResult}
                matchPhase={state.phase}
                isWinner={state.winner_team_id === (isActiveBatting ? currentInnings?.batting_team_id : currentInnings?.bowling_team_id)}
                winnerName={state.winner_team_id === state.team_a?.id ? state.team_a?.name : state.team_b?.name}
                winnerGamerTag={state.winner_team_id === state.team_a?.id ? state.player_1_name : state.player_2_name}
              />

              {/* Gesture Detection Feedback Tag */}
              {state.phase === "decision" && myLockedNumber === null && (
                <div className="absolute top-3 left-3 bg-[#111111]/85 border-2 border-[#9BE52E] rounded-xl px-3 py-1.5 text-white flex items-center gap-2 shadow-sm">
                  <Hand className="w-4 h-4 text-[#9BE52E]" />
                  <span className="text-xs font-bold font-mono">
                    DETECTED:{" "}
                    <span className="text-base font-black text-[#FFD900]">
                      {currentGesture?.number ?? "Show Hand..."}
                    </span>
                  </span>
                  {currentGesture?.number && (
                    <div className="w-12 bg-gray-700 h-2 rounded-full overflow-hidden border border-black">
                      <div
                        className="bg-[#9BE52E] h-full transition-all duration-100"
                        style={{ width: `${Math.min(100, (currentGesture.stableCount / 4) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Countdown Ring */}
              {state.phase === "decision" && (
                <div className="absolute top-3 right-3 bg-[#F000A8] text-white border-3 border-[#111111] w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-brutal-sm font-display font-black animate-pulse">
                  <span className="text-lg leading-none">{decisionSecondsLeft}</span>
                  <span className="text-[8px] uppercase font-sans">SEC</span>
                </div>
              )}
            </div>

            {/* Media Controls */}
            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMic}
                  className={`p-1.5 rounded-lg border-2 border-[#111111] ${
                    isMicMuted ? "bg-red-500 text-white" : "bg-[#FFF9E8] text-[#111111]"
                  }`}
                  title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`p-1.5 rounded-lg border-2 border-[#111111] ${
                    isVideoDisabled ? "bg-red-500 text-white" : "bg-[#FFF9E8] text-[#111111]"
                  }`}
                  title={isVideoDisabled ? "Turn Video On" : "Turn Video Off"}
                >
                  {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
                {/* Webcam Effects Button */}
                <button
                  onClick={() => setIsEffectsModalOpen(true)}
                  className={`px-2.5 py-1.5 rounded-lg border-2 border-[#111111] text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-brutal-sm ${
                    activeWebcamEffect !== "none"
                      ? "bg-[#FFD900] text-black"
                      : "bg-[#FFF9E8] text-[#111111] hover:bg-[#FFD900]"
                  }`}
                  title="Webcam Filters & Avatar Effects"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F000A8]" />
                  <span>Filters {activeWebcamEffect !== "none" && "✓"}</span>
                </button>
                {/* Voice Effects Button */}
                <button
                  onClick={() => setIsVoiceModalOpen(true)}
                  className={`px-2.5 py-1.5 rounded-lg border-2 border-[#111111] text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-brutal-sm ${
                    activeVoiceEffect !== "normal"
                      ? "bg-[#F000A8] text-white"
                      : "bg-[#FFF9E8] text-[#111111] hover:bg-[#F000A8] hover:text-white"
                  }`}
                  title="Real-Time Voice Effects & Modulator"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Voice {activeVoiceEffect !== "normal" && "✓"}</span>
                </button>
              </div>
              <span className="text-[11px] text-[#FFF9E8] font-bold font-mono">
                Hold gesture in camera or use keypad below
              </span>
            </div>

            {/* PRIVATE KEYPAD (1 to 6) */}
            {state.phase === "decision" && (
              <div className="mt-3 bg-[#FFF9E8] border-3 border-[#111111] rounded-xl p-2.5 shadow-brutal-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase text-[#111111] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#F000A8]" />
                    MANUAL KEYPAD (NEVER REVEALED BEFORE SIMULTANEOUS UNLOCK):
                  </span>
                  {myLockedNumber !== null && (
                    <span className="text-xs font-black text-green-700">LOCKED IN!</span>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((num) => {
                    const isSelected = myLockedNumber === num;
                    return (
                      <button
                        key={num}
                        disabled={myLockedNumber !== null}
                        onClick={() => {
                          soundEngine.playClick();
                          setManualChosenNumber(num);
                          onSubmitHand(num, state.current_delivery_id);
                        }}
                        className={`h-11 rounded-lg border-2 border-[#111111] font-display font-black text-xl transition-all ${
                          isSelected
                            ? "bg-[#9BE52E] text-[#111111] shadow-none translate-x-0.5 translate-y-0.5"
                            : "bg-white text-[#111111] shadow-brutal-sm hover:bg-[#FFD900] active:translate-x-0.5 active:translate-y-0.5"
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* OPPONENT ACTIVE CONTROLLER (FAIR PLAY PRIVACY SHIELD) */}
          <div className="relative panel-brutal-purple p-3 overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#F000A8] border border-black" />
                  <span className="font-display font-black text-sm uppercase text-[#FFD900]">
                    OPPONENT: {isActiveBatting ? activeBowlName : activeBatName} (
                    {isActiveBatting ? "BOWLING 🎯" : "BATTING 🏏"})
                  </span>
                </div>
                {opponentLocked && (
                  <span className="bg-[#9BE52E] text-[#111111] text-xs font-black px-2 py-0.5 rounded-md border-2 border-black flex items-center gap-1 shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5" /> READY & LOCKED
                  </span>
                )}
              </div>

              {/* Opponent Video Shield Container */}
              <div className="relative w-full aspect-video bg-[#111111] rounded-xl border-3 border-[#111111] overflow-hidden flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${state.phase === "decision" ? "hidden" : "block"}`}
                />

                {/* STRICT PRIVACY SHIELD DURING DECISION */}
                {state.phase === "decision" && (
                  <div className="absolute inset-0 bg-[#470094] flex flex-col items-center justify-center p-6 text-center text-white border-2 border-[#FFD900] animate-pulse">
                    <EyeOff className="w-16 h-16 text-[#FFD900] mb-2 animate-bounce" />
                    <h4 className="font-display font-black text-xl text-[#FFD900] uppercase tracking-wide">
                      OPPONENT IS CHOOSING PRIVATELY
                    </h4>
                    <p className="text-xs text-[#FFF9E8] mt-1 max-w-xs font-medium">
                      Opponent's video feed and secret number are completely shielded during the decision phase!
                    </p>
                    <div className="mt-4 bg-[#111111] text-xs font-mono font-bold px-4 py-2 rounded-xl border border-white flex items-center gap-2 shadow-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFD900] animate-ping" />
                      {opponentLocked ? "Opponent has locked their move! 🔒" : "Waiting for opponent's hand..."}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controller Status Footer */}
            <div className="mt-3 bg-[#FFF9E8] border-3 border-[#111111] rounded-xl p-2.5 flex items-center justify-between text-[#111111] shadow-brutal-sm">
              <span className="text-xs font-bold font-mono">
                STATUS: <span className="font-black text-[#6500C8]">IN PLAY</span>
              </span>
              {Boolean(state.ready_for_next_ball?.[isActiveBatting ? activeBowlId : activeBatId]) && (
                <span className="bg-[#9BE52E] text-black text-[11px] font-black px-2 py-0.5 rounded border border-black">
                  READY FOR NEXT BALL
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SPECTATOR / NON-ACTIVE TEAMMATE VIEW */
        <div className="bg-[#FFF9E8] border-4 border-[#111111] rounded-2xl shadow-brutal p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-[#111111] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#6500C8] text-white flex items-center justify-center border-2 border-black shadow-brutal-sm">
                <Eye className="w-5 h-5 text-[#FFD900]" />
              </div>
              <div>
                <h3 className="font-display font-black text-xl text-[#111111] uppercase">
                  {isSpectator ? "SPECTATING LIVE MATCH" : "BENCH / TEAMMATE VIEW"}
                </h3>
                <p className="text-xs text-gray-600 font-mono">
                  {isSpectator ? "Enjoy the game, chat with friends, and watch each ball!" : "Cheer on your teammates! You will rotate in upcoming overs."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-[#9BE52E] text-black text-xs font-mono font-black uppercase px-2.5 py-1 rounded-lg border-2 border-black shadow-brutal-sm">
                OVER {Math.floor((currentInnings?.balls_bowled || 0) / state.rules.balls_per_over) + 1} OF {state.rules.overs_per_innings}
              </span>
            </div>
          </div>

          {/* Neutral Waiting Screen During Decision Phase */}
          {state.phase === "decision" ? (
            <div className="bg-[#470094] border-3 border-[#111111] rounded-2xl p-8 text-center text-white space-y-4 shadow-brutal">
              <div className="w-16 h-16 rounded-full bg-[#FFD900] text-black mx-auto flex items-center justify-center border-3 border-black shadow-brutal-sm animate-bounce">
                <Lock className="w-8 h-8" />
              </div>

              <div>
                <h4 className="font-display font-black text-2xl text-[#FFD900] uppercase tracking-wide">
                  PLAYERS ARE LOCKING THEIR MOVES...
                </h4>
                <p className="text-xs text-[#FFF9E8] max-w-md mx-auto mt-1">
                  Private decision phase is active! Numbers remain strictly secret until both controllers lock and reveal simultaneously.
                </p>
              </div>

              {/* Shared Countdown */}
              <div className="inline-block bg-[#F000A8] text-white border-3 border-black rounded-2xl px-6 py-2 shadow-brutal-sm font-display font-black text-2xl animate-pulse">
                {decisionSecondsLeft} SECONDS REMAINING
              </div>

              {/* Controller Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2 text-left">
                <div className="bg-white text-black border-2 border-black rounded-xl p-3 shadow-brutal-sm">
                  <div className="text-[10px] font-black uppercase text-purple-900">BATTER CONTROLLER</div>
                  <div className="font-display font-black text-base">{activeBatName}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-mono font-bold">
                    {state.active_batting_controller_locked ? (
                      <span className="text-green-700 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> LOCKED 🔒
                      </span>
                    ) : (
                      <span className="text-amber-600 animate-pulse">THINKING ⏳</span>
                    )}
                  </div>
                </div>

                <div className="bg-white text-black border-2 border-black rounded-xl p-3 shadow-brutal-sm">
                  <div className="text-[10px] font-black uppercase text-purple-900">BOWLER CONTROLLER</div>
                  <div className="font-display font-black text-base">{activeBowlName}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-mono font-bold">
                    {state.active_bowling_controller_locked ? (
                      <span className="text-green-700 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> LOCKED 🔒
                      </span>
                    ) : (
                      <span className="text-amber-600 animate-pulse">THINKING ⏳</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Discussion / Ready View for Spectators */
            <div className="bg-[#6500C8] border-3 border-[#111111] rounded-2xl p-6 text-center text-white space-y-3 shadow-brutal">
              <h4 className="font-display font-black text-xl text-[#FFD900] uppercase">
                DELIVERY RESOLUTION & DISCUSSION
              </h4>
              <p className="text-xs text-[#FFF9E8] font-mono">
                The delivery has been resolved. Players are reviewing and discussing before the next ball begins!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. SIMULTANEOUS REVEAL OVERLAY / POPUP */}
      {state.phase === "reveal" && latestRevealResult && (
        <div className="bg-[#FFD900] border-4 border-[#111111] rounded-2xl shadow-brutal-lg p-4 sm:p-6 text-center animate-pop">
          <div className="inline-block bg-[#F000A8] text-white text-xs sm:text-sm font-black px-4 py-1 rounded-full border-2 border-[#111111] shadow-brutal-sm mb-3 uppercase tracking-wider">
            SIMULTANEOUS REVEAL!
          </div>

          <div className="flex items-center justify-center gap-6 sm:gap-12 my-2">
            {/* Batter Move */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black uppercase text-gray-800 mb-0.5">
                BATSMAN ({latestRevealResult.batsman_name})
              </span>
              <span className="text-[10px] font-mono font-bold text-purple-900 mb-1">
                Controlled by: {latestRevealResult.batting_controller_name || activeBatName}
              </span>
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border-4 border-[#111111] rounded-2xl flex items-center justify-center font-display font-black text-3xl sm:text-4xl shadow-brutal">
                {latestRevealResult.batsman_number}
              </div>
            </div>

            <div className="font-display font-black text-2xl sm:text-3xl text-[#111111]">
              VS
            </div>

            {/* Bowler Move */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black uppercase text-gray-800 mb-0.5">
                BOWLER ({latestRevealResult.bowler_name})
              </span>
              <span className="text-[10px] font-mono font-bold text-purple-900 mb-1">
                Controlled by: {latestRevealResult.bowling_controller_name || activeBowlName}
              </span>
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border-4 border-[#111111] rounded-2xl flex items-center justify-center font-display font-black text-3xl sm:text-4xl shadow-brutal">
                {latestRevealResult.bowler_number}
              </div>
            </div>
          </div>

          {/* Outcome Announcement */}
          <div className="my-4">
            {latestRevealResult.is_wicket ? (
              <div className="bg-red-500 text-white border-3 border-[#111111] px-6 py-2.5 rounded-xl shadow-brutal inline-block animate-bounce">
                <span className="text-2xl sm:text-3xl font-black font-display tracking-wide uppercase">
                  WICKET FALLEN! OUT! ☝️
                </span>
              </div>
            ) : (
              <div className="bg-[#9BE52E] text-[#111111] border-3 border-[#111111] px-6 py-2.5 rounded-xl shadow-brutal inline-block">
                <span className="text-2xl sm:text-3xl font-black font-display tracking-wide uppercase">
                  {latestRevealResult.runs_scored === 6
                    ? "SIX RUNS! MAXIMUM! 🚀"
                    : latestRevealResult.runs_scored === 4
                    ? "FOUR RUNS! BOUNDARY! ⚡"
                    : `${latestRevealResult.runs_scored} RUNS SCORED! 🏃`}
                </span>
              </div>
            )}
          </div>

          {/* Action button for active players */}
          {isActiveController && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onReadyNextBall();
                }}
                className="btn-brutal-purple text-base px-8 py-3 rounded-xl flex items-center gap-2"
              >
                <span>READY FOR NEXT BALL</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. OVER COMPLETE TRANSITION (`OVER_BREAK` PHASE) */}
      {state.phase === "over_break" && (
        <div className="bg-[#FFD900] border-4 border-[#111111] rounded-2xl shadow-brutal-lg p-6 text-center space-y-4 animate-pop">
          <div className="inline-block bg-[#111111] text-[#FFD900] text-xs font-black px-4 py-1 rounded-full border-2 border-black uppercase tracking-wider">
            OVER COMPLETE!
          </div>

          <h2 className="text-3xl sm:text-4xl font-black font-display text-[#111111] uppercase">
            CONTROLLERS ROTATING FOR NEXT OVER!
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto my-3 text-left">
            <div className="bg-white border-3 border-black rounded-xl p-4 shadow-brutal-sm">
              <span className="text-[10px] font-black uppercase text-purple-900 block mb-0.5">
                NEXT BATTER CONTROL:
              </span>
              <h3 className="font-display font-black text-xl text-[#111111]">
                {activeBatName}
              </h3>
              <p className="text-[10px] text-gray-500 font-mono mt-1">Get your camera ready to bat!</p>
            </div>

            <div className="bg-white border-3 border-black rounded-xl p-4 shadow-brutal-sm">
              <span className="text-[10px] font-black uppercase text-purple-900 block mb-0.5">
                NEXT BOWLER CONTROL:
              </span>
              <h3 className="font-display font-black text-xl text-[#111111]">
                {activeBowlName}
              </h3>
              <p className="text-[10px] text-gray-500 font-mono mt-1">Get your camera ready to bowl!</p>
            </div>
          </div>

          {/* Ready Button for next over */}
          <div className="pt-2">
            {isActiveController ? (
              <button
                disabled={isOverReady}
                onClick={() => {
                  soundEngine.playClick();
                  if (onReadyOverTransition) onReadyOverTransition();
                }}
                className={`text-base px-8 py-3.5 rounded-xl border-3 border-black font-display font-black uppercase shadow-brutal ${
                  isOverReady ? "bg-[#9BE52E] text-black" : "btn-brutal-pink"
                }`}
              >
                {isOverReady ? "YOU ARE READY! WAITING FOR OPPONENT..." : "I'M READY FOR THE OVER! 👉"}
              </button>
            ) : (
              <div className="inline-block bg-[#FFF9E8] border-2 border-black px-5 py-2 rounded-xl text-xs font-mono font-bold text-gray-700">
                Waiting for {activeBatName} and {activeBowlName} to prepare webcams...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. INNINGS BREAK BANNER */}
      {state.phase === "innings_break" && (
        <div className="bg-[#6500C8] text-white border-4 border-[#111111] rounded-2xl shadow-brutal-lg p-6 text-center space-y-4">
          <span className="bg-[#FFD900] text-[#111111] text-xs font-black uppercase px-3 py-1 rounded-full border-2 border-black">
            INNINGS 1 COMPLETE
          </span>
          <h2 className="text-3xl sm:text-4xl font-black font-display text-[#FFD900]">
            TARGET FOR CHASE: {(currentInnings?.total_runs || 0) + 1} RUNS
          </h2>
          <p className="text-sm font-bold max-w-md mx-auto text-[#FFF9E8]">
            Roles will now swap. The bowling team will bat and needs {(currentInnings?.total_runs || 0) + 1} runs to win!
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                soundEngine.playClick();
                onStartInnings2();
              }}
              className="btn-brutal-green text-base px-8 py-3 rounded-xl shadow-brutal"
            >
              START 2ND INNINGS CHASE! ⚡
            </button>
          </div>
        </div>
      )}

      {/* 6. DISCUSSION PHASE BAR */}
      {state.phase === "discussion" && !state.is_match_over && (
        <div className="bg-[#FFF9E8] border-4 border-[#111111] rounded-2xl shadow-brutal p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black font-display text-[#111111] uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#6500C8]" />
              DELIVERY DISCUSSION PHASE
            </h3>
            <p className="text-xs text-gray-700 font-medium">
              Webcams and audio are active! Chat with everyone and click ready when prepared.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isActiveController ? (
              <button
                disabled={isMyReady}
                onClick={() => {
                  soundEngine.playClick();
                  onReadyNextBall();
                }}
                className={`px-6 py-3 rounded-xl border-3 border-[#111111] font-display font-black text-sm uppercase transition-all ${
                  isMyReady
                    ? "bg-[#9BE52E] text-[#111111] shadow-brutal-sm"
                    : "btn-brutal-pink"
                }`}
              >
                {isMyReady ? "WAITING FOR OPPONENT TO READY..." : "READY FOR NEXT BALL 👉"}
              </button>
            ) : (
              <span className="text-xs font-mono font-bold text-gray-600 bg-white px-3 py-2 rounded-xl border border-black">
                Watching discussion...
              </span>
            )}
          </div>
        </div>
      )}

      {/* 7. INTEGRATED CHAT & REACTIONS DRAWER */}
      {(onSendChat || onSendMessage) && (
        <ChatDrawer
          messages={chatMessages}
          currentUserId={playerId}
          currentUserRole={userRole || state.user_role || (isSpectator ? "spectator" : "player")}
          currentUserTeamId={state.participants?.[playerId]?.team_id}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
          onSendMessage={(channel, text, reaction) => {
            if (onSendChat) {
              onSendChat(channel as any, text, reaction);
            } else if (onSendMessage) {
              onSendMessage(channel, text, reaction);
            }
          }}
        />
      )}

      {/* 8. WEBCAM EFFECTS MODAL */}
      {isEffectsModalOpen && (
        <WebcamEffectsModal
          currentEffect={activeWebcamEffect}
          onSelectEffect={handleSelectWebcamEffect}
          onClose={() => setIsEffectsModalOpen(false)}
        />
      )}

      {/* 9. VOICE EFFECTS & MODULATOR MODAL */}
      {isVoiceModalOpen && (
        <VoiceEffectsModal
          currentPreset={activeVoiceEffect}
          onSelectPreset={handleSelectVoicePreset}
          onClose={() => setIsVoiceModalOpen(false)}
        />
      )}
    </div>
  );
};
