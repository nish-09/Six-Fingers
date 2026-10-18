import React, { useState } from "react";
import {
  Copy,
  Check,
  Users,
  Eye,
  Shield,
  Sparkles,
  Settings2,
  Play,
  Crown,
  ArrowRightLeft,
  RotateCw,
  MessageSquare
} from "lucide-react";
import { soundEngine } from "@/lib/sound";

interface LobbyViewProps {
  roomCode: string;
  state: any;
  playerId: string;
  isHost: boolean;
  userRole?: "player" | "spectator";
  onSetLobbyReady: (ready: boolean) => void;
  onUpdateRules: (rules: any) => void;
  onAssignTeam?: (userId: string, teamId: string) => void;
  onAssignCaptain?: (captainId: string, teamId: string) => void;
  onUpdateRotation?: (teamId: string, battingOrder: string[], bowlingOrder: string[]) => void;
  onLeaveRoom: () => void;
  onOpenChat?: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  state,
  playerId,
  isHost,
  userRole = "player",
  onSetLobbyReady,
  onUpdateRules,
  onAssignTeam,
  onAssignCaptain,
  onUpdateRotation,
  onLeaveRoom,
  onOpenChat,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Current participant info
  const myParticipant = state.participants?.[playerId];
  const isSpectator = myParticipant?.role === "spectator" || state.user_role === "spectator";
  const isMyReady = Boolean(myParticipant?.is_ready);

  // Teams
  const teamA = state.team_a;
  const teamB = state.team_b;
  const teamAPlayers = teamA?.human_player_ids || (state.player_1_id ? [state.player_1_id] : []);
  const teamBPlayers = teamB?.human_player_ids || (state.player_2_id ? [state.player_2_id] : []);
  const spectators = state.spectators || [];

  const copyCode = () => {
    soundEngine.playClick();
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    soundEngine.playClick();
    const link = `${window.location.origin}?join=${roomCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRuleChange = (field: string, val: any) => {
    soundEngine.playClick();
    const updated = { ...state.rules, [field]: val };
    onUpdateRules(updated);
  };

  const canSwitchTeamA = !isSpectator && myParticipant?.team_id !== teamA?.id && teamAPlayers.length < (state.rules?.players_per_team || 1);
  const canSwitchTeamB = !isSpectator && myParticipant?.team_id !== teamB?.id && teamBPlayers.length < (state.rules?.players_per_team || 1);
  const canSpectatorJoin = isSpectator && (teamAPlayers.length < (state.rules?.players_per_team || 1) || teamBPlayers.length < (state.rules?.players_per_team || 1));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. TOP BANNER: Room Code, Invite, Spectator Counter */}
      <div className="bg-[#6500C8] border-4 border-[#111111] rounded-2xl shadow-brutal p-4 sm:p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#FFD900] text-[#111111] text-xs font-black uppercase px-2.5 py-1 rounded-md border-2 border-black">
              SIX FINGERS LOBBY
            </span>
            <span className="bg-[#9BE52E] text-black text-xs font-mono font-black uppercase px-2 py-0.5 rounded-md border-2 border-black flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{state.spectator_count || spectators.length} SPECTATORS</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-[#FFD900]">
            ROOM CODE: <span className="font-mono tracking-widest text-white">{roomCode}</span>
          </h2>
          <p className="text-xs text-[#FFF9E8] font-bold mt-0.5">
            Share code or invite link for friends to play or watch live!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={copyCode}
            className="btn-brutal-yellow px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? "COPIED CODE!" : "COPY CODE"}</span>
          </button>

          <button
            onClick={copyLink}
            className="btn-brutal-pink px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5"
          >
            {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4" />}
            <span>{copiedLink ? "COPIED LINK!" : "COPY INVITE LINK"}</span>
          </button>

          {onOpenChat && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenChat();
              }}
              className="btn-brutal-green px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>CHAT</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TWO TEAM CARDS (SUPPORT FOR >2 PLAYERS PER TEAM) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TEAM 1 (YELLOW / PURPLE) */}
        <div className="panel-brutal-white p-5 flex flex-col justify-between border-4 border-[#111111]">
          <div>
            <div className="flex items-center justify-between mb-3 border-b-2 border-gray-200 pb-2">
              <span className="bg-[#FFD900] text-[#111111] text-xs font-black uppercase px-2.5 py-1 rounded-lg border-2 border-black">
                TEAM 1: {teamA?.name || "Blasters"}
              </span>
              <span className="text-xs font-mono font-black text-gray-700">
                {teamAPlayers.length}/{state.rules?.players_per_team || 1} PLAYERS
              </span>
            </div>

            {/* Human Participants on Team 1 */}
            <div className="space-y-2 mt-2">
              <div className="text-[11px] font-black uppercase text-gray-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#6500C8]" />
                <span>CONNECTED TEAMMATES:</span>
              </div>

              {teamAPlayers.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No players assigned yet</p>
              ) : (
                teamAPlayers.map((pId: string, idx: number) => {
                  const pData = state.participants?.[pId] || (pId === state.player_1_id ? { name: state.player_1_name, is_ready: state.player_1_ready } : null);
                  const isCap = teamA?.captain_id === pId;
                  const isMe = pId === playerId;
                  const isReady = pData?.is_ready;

                  return (
                    <div
                      key={pId}
                      className={`p-2.5 rounded-xl border-2 border-[#111111] flex items-center justify-between ${
                        isMe ? "bg-[#FFD900]/30 shadow-brutal-sm" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#6500C8] text-white font-black text-xs flex items-center justify-center border-2 border-black">
                          {pData?.name?.slice(0, 2).toUpperCase() || `P${idx + 1}`}
                        </div>
                        <div>
                          <div className="font-display font-black text-sm flex items-center gap-1">
                            <span>{pData?.name || `Player ${idx + 1}`}</span>
                            {isCap && (
                              <span title="Team Captain">
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                            )}
                            {isMe && (
                              <span className="text-[9px] bg-[#6500C8] text-white px-1.5 py-0.2 rounded font-mono">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">
                            Player {idx + 1} • Over {idx + 1} Lead
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-black ${
                          isReady ? "bg-[#9BE52E] text-black shadow-sm" : "bg-yellow-200 text-yellow-900"
                        }`}
                      >
                        {isReady ? "READY ✅" : "WAITING ⏳"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* In-Game Cricket Roster Preview */}
            <div className="mt-4 pt-3 border-t-2 border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                IN-GAME CRICKET ROSTER:
              </span>
              <div className="flex flex-wrap gap-1">
                {teamA?.players?.slice(0, 4).map((p: any) => (
                  <span
                    key={p.id}
                    className="text-[10px] bg-gray-100 text-gray-800 font-mono px-2 py-0.5 rounded border border-gray-300"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Switch to Team A Action */}
          {canSwitchTeamA && onAssignTeam && (
            <div className="mt-4 pt-2">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onAssignTeam(playerId, teamA.id);
                }}
                className="w-full btn-brutal-yellow py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>SWITCH TO THIS TEAM</span>
              </button>
            </div>
          )}
        </div>

        {/* TEAM 2 (PINK / LIME) */}
        <div className="panel-brutal-white p-5 flex flex-col justify-between border-4 border-[#111111]">
          <div>
            <div className="flex items-center justify-between mb-3 border-b-2 border-gray-200 pb-2">
              <span className="bg-[#F000A8] text-white text-xs font-black uppercase px-2.5 py-1 rounded-lg border-2 border-black">
                TEAM 2: {teamB?.name || "Kings"}
              </span>
              <span className="text-xs font-mono font-black text-gray-700">
                {teamBPlayers.length}/{state.rules?.players_per_team || 1} PLAYERS
              </span>
            </div>

            {/* Human Participants on Team 2 */}
            <div className="space-y-2 mt-2">
              <div className="text-[11px] font-black uppercase text-gray-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#F000A8]" />
                <span>CONNECTED TEAMMATES:</span>
              </div>

              {teamBPlayers.length === 0 ? (
                <div className="py-6 text-center">
                  <Users className="w-8 h-8 text-gray-400 mx-auto mb-1 animate-bounce" />
                  <p className="text-xs font-bold text-gray-600">Waiting for friends to join...</p>
                  <p className="text-[10px] text-gray-400 font-mono">Send room code to invite!</p>
                </div>
              ) : (
                teamBPlayers.map((pId: string, idx: number) => {
                  const pData = state.participants?.[pId] || (pId === state.player_2_id ? { name: state.player_2_name, is_ready: state.player_2_ready } : null);
                  const isCap = teamB?.captain_id === pId;
                  const isMe = pId === playerId;
                  const isReady = pData?.is_ready;

                  return (
                    <div
                      key={pId}
                      className={`p-2.5 rounded-xl border-2 border-[#111111] flex items-center justify-between ${
                        isMe ? "bg-[#F000A8]/20 shadow-brutal-sm" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#F000A8] text-white font-black text-xs flex items-center justify-center border-2 border-black">
                          {pData?.name?.slice(0, 2).toUpperCase() || `P${idx + 1}`}
                        </div>
                        <div>
                          <div className="font-display font-black text-sm flex items-center gap-1">
                            <span>{pData?.name || `Player ${idx + 1}`}</span>
                            {isCap && (
                              <span title="Team Captain">
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                            )}
                            {isMe && (
                              <span className="text-[9px] bg-[#F000A8] text-white px-1.5 py-0.2 rounded font-mono">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">
                            Player {idx + 1} • Over {idx + 1} Lead
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-black ${
                          isReady ? "bg-[#9BE52E] text-black shadow-sm" : "bg-yellow-200 text-yellow-900"
                        }`}
                      >
                        {isReady ? "READY ✅" : "WAITING ⏳"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* In-Game Cricket Roster Preview */}
            <div className="mt-4 pt-3 border-t-2 border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                IN-GAME CRICKET ROSTER:
              </span>
              <div className="flex flex-wrap gap-1">
                {teamB?.players?.slice(0, 4).map((p: any) => (
                  <span
                    key={p.id}
                    className="text-[10px] bg-gray-100 text-gray-800 font-mono px-2 py-0.5 rounded border border-gray-300"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Switch to Team B Action */}
          {canSwitchTeamB && onAssignTeam && (
            <div className="mt-4 pt-2">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onAssignTeam(playerId, teamB.id);
                }}
                className="w-full btn-brutal-pink py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>SWITCH TO THIS TEAM</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. SPECTATOR SECTION ("WATCHING THE MATCH") */}
      <div className="bg-[#FFF9E8] border-4 border-[#111111] rounded-2xl shadow-brutal p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gray-300 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFD900] border-2 border-black flex items-center justify-center shadow-brutal-sm">
              <Eye className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-[#111111] uppercase">
                WATCHING THE MATCH
              </h3>
              <p className="text-xs text-gray-600 font-mono">
                Spectators can follow live deliveries, listen to commentary, and chat!
              </p>
            </div>
          </div>

          <div className="bg-[#111111] text-white px-3 py-1 rounded-xl font-mono font-black text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>SPECTATORS: {spectators.length}</span>
          </div>
        </div>

        {/* Spectator Avatars / List */}
        {spectators.length === 0 ? (
          <p className="text-xs text-gray-500 font-mono italic py-2">
            No spectators watching right now. Friends joining with code can select "Join as Spectator" to watch!
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {spectators.map((spec: any, idx: number) => {
              const isMe = spec.id === playerId;
              return (
                <div
                  key={spec.id || idx}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black text-xs shadow-brutal-sm font-display font-bold ${
                    isMe ? "bg-[#FFD900] text-black" : "bg-white text-gray-800"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-[#6500C8] text-white text-[9px] font-black flex items-center justify-center">
                    {spec.name?.slice(0, 2).toUpperCase() || `S${idx + 1}`}
                  </div>
                  <span>{spec.name}</span>
                  <span className="text-[9px] text-gray-500 font-mono">• Spectator</span>
                  {isMe && <span className="text-[9px] font-black text-[#6500C8]">(YOU)</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* If user is spectator and spots are available, allow switching to player */}
        {canSpectatorJoin && onAssignTeam && (
          <div className="mt-4 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">
              Want to get in on the action? Playing spots are open!
            </span>
            <button
              onClick={() => {
                soundEngine.playClick();
                const targetTeamId = teamAPlayers.length <= teamBPlayers.length ? teamA.id : teamB.id;
                onAssignTeam(playerId, targetTeamId);
              }}
              className="btn-brutal-green text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5" />
              <span>JOIN AS PLAYER 🏏</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. MATCH CONFIGURATION & ROTATION RULES */}
      <div className="bg-[#FFF9E8] border-4 border-[#111111] rounded-2xl shadow-brutal p-5">
        <div className="flex items-center justify-between mb-4 border-b-2 border-gray-300 pb-2">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#6500C8]" />
            <h3 className="text-lg font-black font-display text-[#111111] uppercase">
              MATCH RULES & OVER ROTATION {isHost ? "(HOST EDITABLE)" : "(CONFIGURED BY HOST)"}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
            MODE: {state.rules?.rotation_mode?.toUpperCase() || "AUTOMATIC"} ROTATION
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Overs */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Overs Per Innings:
            </label>
            {isHost ? (
              <select
                value={state.rules?.overs_per_innings || 2}
                onChange={(e) => handleRuleChange("overs_per_innings", parseInt(e.target.value))}
                className="w-full bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs shadow-brutal-sm outline-none"
              >
                <option value={1}>1 Over Match (Quick Blitz)</option>
                <option value={2}>2 Overs Match (Classic)</option>
                <option value={3}>3 Overs Match</option>
                <option value={5}>5 Overs Match (Full Game)</option>
              </select>
            ) : (
              <div className="bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs">
                {state.rules?.overs_per_innings || 2} Overs
              </div>
            )}
          </div>

          {/* Wickets */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Wickets Per Innings:
            </label>
            {isHost ? (
              <select
                value={state.rules?.wickets_per_innings || 3}
                onChange={(e) => handleRuleChange("wickets_per_innings", parseInt(e.target.value))}
                className="w-full bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs shadow-brutal-sm outline-none"
              >
                <option value={1}>1 Wicket (Sudden Death)</option>
                <option value={2}>2 Wickets</option>
                <option value={3}>3 Wickets (Recommended)</option>
                <option value={5}>5 Wickets (All Out)</option>
              </select>
            ) : (
              <div className="bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs">
                {state.rules?.wickets_per_innings || 3} Wickets
              </div>
            )}
          </div>

          {/* Over Rotation Mode */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Player Over Rotation:
            </label>
            {isHost ? (
              <select
                value={state.rules?.rotation_mode || "automatic"}
                onChange={(e) => handleRuleChange("rotation_mode", e.target.value)}
                className="w-full bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs shadow-brutal-sm outline-none"
              >
                <option value="automatic">Automatic Rotation</option>
                <option value="captain_selected">Captain-Selected Order</option>
                <option value="manual">Manual Selection Each Over</option>
              </select>
            ) : (
              <div className="bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs capitalize">
                {state.rules?.rotation_mode || "Automatic"}
              </div>
            )}
          </div>

          {/* Decision Timer */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Hand Decision Timer:
            </label>
            {isHost ? (
              <select
                value={state.rules?.decision_timer_seconds || 5}
                onChange={(e) => handleRuleChange("decision_timer_seconds", parseInt(e.target.value))}
                className="w-full bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs shadow-brutal-sm outline-none"
              >
                <option value={3}>3 Seconds (Blitz)</option>
                <option value={5}>5 Seconds (Recommended)</option>
                <option value={7}>7 Seconds</option>
                <option value={10}>10 Seconds (Relaxed)</option>
              </select>
            ) : (
              <div className="bg-white border-2 border-[#111111] rounded-xl px-3 py-2 font-mono font-black text-xs">
                {state.rules?.decision_timer_seconds || 5} Seconds
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. ACTION FOOTER: READY UP & LEAVE */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          onClick={() => {
            soundEngine.playClick();
            onLeaveRoom();
          }}
          className="btn-brutal-white px-5 py-2.5 rounded-xl text-xs"
        >
          LEAVE ROOM
        </button>

        {isSpectator ? (
          <div className="bg-[#FFF9E8] border-3 border-[#111111] px-6 py-3 rounded-xl font-display font-black text-xs sm:text-sm shadow-brutal-sm flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#6500C8]" />
            <span>SPECTATING LIVE • MATCH WILL BEGIN WHEN PLAYERS READY UP</span>
          </div>
        ) : (
          <button
            onClick={() => {
              soundEngine.playClick();
              onSetLobbyReady(!isMyReady);
            }}
            className={`px-8 py-3.5 rounded-xl border-3 border-[#111111] font-display font-black text-base uppercase transition-all flex items-center gap-2 ${
              isMyReady
                ? "bg-[#9BE52E] text-[#111111] shadow-brutal"
                : "btn-brutal-pink"
            }`}
          >
            {isMyReady ? (
              <>
                <Check className="w-5 h-5 text-black" />
                <span>YOU ARE READY! (WAITING FOR OTHERS)</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 text-white" />
                <span>I'M READY TO PLAY! 👉</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
