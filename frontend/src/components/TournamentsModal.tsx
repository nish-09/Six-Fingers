import React, { useState, useEffect } from "react";
import { X, Trophy, Plus, ArrowRight, Play, Users, Medal, AlertCircle, ShieldCheck } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { useAuth } from "@/lib/authContext";
import { getApiBaseUrl } from "@/lib/config";

interface TournamentItem {
  id: string;
  title: string;
  description: string;
  organizer_id: string;
  organizer_name: string;
  tournament_format: string;
  max_participants: number;
  current_participants: number;
  overs_per_match: number;
  wickets_per_match: number;
  status: string;
  winner_name?: string;
  created_at: number;
}

interface TournamentsModalProps {
  onClose: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const TournamentsModal: React.FC<TournamentsModalProps> = ({ onClose, onJoinRoom }) => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<"directory" | "create">("directory");
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("Hand Cricket Premier Cup");
  const [format, setFormat] = useState("KNOCKOUT");
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [overs, setOvers] = useState(2);
  const [wickets, setWickets] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTournaments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tournaments`);
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments || []);
      }
    } catch (err) {
      console.error("Error fetching tournaments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournamentDetail = async (id: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tournaments/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTournament(data);
      }
    } catch (err) {
      console.error("Error fetching tournament detail:", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tournaments/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          tournament_format: format,
          max_participants: maxParticipants,
          overs_per_match: overs,
          wickets_per_match: wickets,
        }),
      });

      if (res.ok) {
        soundEngine.playVictory();
        await fetchTournaments();
        setActiveTab("directory");
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || "Failed to create tournament");
      }
    } catch (err) {
      setErrorMsg("Network error creating tournament");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tournaments/${id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        soundEngine.playClick();
        fetchTournamentDetail(id);
      } else {
        const err = await res.json();
        alert(err.detail || "Could not join tournament");
      }
    } catch (err) {
      console.error("Error joining:", err);
    }
  };

  const handleStart = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tournaments/${id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        soundEngine.playFourFanfare();
        fetchTournamentDetail(id);
      }
    } catch (err) {
      console.error("Error starting:", err);
    }
  };

  const handleLaunchFixture = async (fixtureId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tournaments/fixture/${fixtureId}/create-room`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        soundEngine.playClick();
        onClose();
        onJoinRoom(data.room_code);
      }
    } catch (err) {
      console.error("Error launching fixture:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-[#16161F] border-4 border-[#111111] max-w-3xl w-full p-5 sm:p-6 my-auto shadow-[8px_8px_0px_#000] relative max-h-[85vh] overflow-y-auto text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-[#2A2A38] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6500C8] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
              <Trophy className="w-6 h-6 text-[#FFD900]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-display text-[#FFD900] uppercase tracking-wide">
                TOURNAMENT CHAMPIONSHIPS
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Knockout brackets & Round-Robin tables with automated progression
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg border-2 border-white/20 hover:bg-white/10 text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => {
              setActiveTab("directory");
              setSelectedTournament(null);
            }}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wide border-2 transition-all ${
              activeTab === "directory"
                ? "bg-[#6500C8] border-white text-white shadow-[2px_2px_0px_#000]"
                : "bg-[#20202C] border-transparent text-gray-400 hover:text-white"
            }`}
          >
            All Tournaments ({tournaments.length})
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wide border-2 transition-all flex items-center gap-2 ${
              activeTab === "create"
                ? "bg-[#FFD900] border-black text-black shadow-[2px_2px_0px_#000]"
                : "bg-[#20202C] border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Plus className="w-4 h-4" /> Host Tournament
          </button>
        </div>

        {/* TAB 1: DIRECTORY & BRACKET */}
        {activeTab === "directory" && (
          <div>
            {selectedTournament ? (
              <div>
                <button
                  onClick={() => setSelectedTournament(null)}
                  className="mb-4 text-xs font-bold text-[#FFD900] hover:underline flex items-center gap-1"
                >
                  ← Back to tournaments list
                </button>

                <div className="bg-[#1C1C26] border-3 border-[#6500C8] rounded-xl p-4 shadow-[4px_4px_0px_#000] mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono uppercase bg-[#6500C8] px-2 py-0.5 rounded font-bold text-white">
                      {selectedTournament.tournament.tournament_format} ({selectedTournament.tournament.overs_per_match} overs)
                    </span>
                    <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                      selectedTournament.tournament.status === "COMPLETED"
                        ? "bg-[#9BE52E] text-black"
                        : selectedTournament.tournament.status === "IN_PROGRESS"
                        ? "bg-[#FFD900] text-black"
                        : "bg-[#F000A8] text-white"
                    }`}>
                      {selectedTournament.tournament.status}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black font-display text-white">{selectedTournament.tournament.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{selectedTournament.tournament.description}</p>

                  {/* Winner Banner */}
                  {selectedTournament.tournament.status === "COMPLETED" && (
                    <div className="mt-4 bg-[#FFD900] text-black p-3 rounded-xl border-2 border-black font-black text-center flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000]">
                      <Trophy className="w-5 h-5 text-[#6500C8]" />
                      CHAMPION: {selectedTournament.tournament.winner_name || "Tournament Winner"}
                    </div>
                  )}

                  {/* Actions for Registration / Start */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTournament.tournament.status === "REGISTRATION" && (
                      <>
                        <button
                          onClick={() => handleJoin(selectedTournament.tournament.id)}
                          className="px-4 py-2 bg-[#9BE52E] text-black font-black text-xs uppercase rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#86CB24]"
                        >
                          Join Tournament ({selectedTournament.participants.length}/{selectedTournament.tournament.max_participants})
                        </button>
                        {user && user.id === selectedTournament.tournament.organizer_id && (
                          <button
                            onClick={() => handleStart(selectedTournament.tournament.id)}
                            className="px-4 py-2 bg-[#FFD900] text-black font-black text-xs uppercase rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#E5C200]"
                          >
                            Start Tournament & Generate Bracket
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Participants Roster */}
                <h4 className="font-black text-xs uppercase text-gray-400 mb-2">Registered Competitors</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                  {selectedTournament.participants.map((p: any) => (
                    <div key={p.id} className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#6500C8] text-white text-[10px] font-black flex items-center justify-center">
                        #{p.seed}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">{p.user_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono truncate">{p.gamer_tag}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fixtures / Bracket View */}
                <h4 className="font-black text-xs uppercase text-gray-400 mb-2">Match Fixtures & Bracket</h4>
                <div className="space-y-3">
                  {selectedTournament.fixtures.length === 0 ? (
                    <div className="text-xs text-gray-500 italic p-3 bg-black/30 rounded">
                      Fixtures will generate as soon as the organizer starts the tournament.
                    </div>
                  ) : (
                    selectedTournament.fixtures.map((f: any) => {
                      const isReady = f.status === "READY" || f.status === "IN_PROGRESS";
                      const isCompleted = f.status === "COMPLETED";

                      return (
                        <div
                          key={f.id}
                          className={`p-3.5 rounded-xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCompleted
                              ? "bg-black/30 border-white/10 opacity-80"
                              : isReady
                              ? "bg-[#1E1E2A] border-[#FFD900] shadow-[3px_3px_0px_#000]"
                              : "bg-[#16161F] border-white/10"
                          }`}
                        >
                          <div>
                            <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1">
                              Round {f.round_number} · Match {f.match_index}
                            </div>
                            <div className="text-sm font-black flex items-center gap-2">
                              <span className={f.winner_id && f.winner_id === f.player_1_id ? "text-[#9BE52E]" : "text-white"}>
                                {f.player_1_name || "TBD"}
                              </span>
                              <span className="text-gray-500 text-xs font-mono">VS</span>
                              <span className={f.winner_id && f.winner_id === f.player_2_id ? "text-[#9BE52E]" : "text-white"}>
                                {f.player_2_name || "TBD"}
                              </span>
                            </div>
                            {f.score_summary && (
                              <div className="text-xs text-[#FFD900] mt-0.5">{f.score_summary}</div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isCompleted ? (
                              <span className="px-2.5 py-1 rounded bg-[#9BE52E]/20 text-[#9BE52E] border border-[#9BE52E] font-black text-xs uppercase">
                                ✓ Completed
                              </span>
                            ) : isReady ? (
                              <button
                                onClick={() => handleLaunchFixture(f.id)}
                                className="px-4 py-2 bg-[#FFD900] text-black font-black text-xs uppercase rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#F0C800] flex items-center gap-1.5"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" /> Play Match
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500 uppercase font-mono">Awaiting Winner</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div>
                {isLoading ? (
                  <div className="text-center py-10 text-gray-400 font-mono text-sm">Loading championships...</div>
                ) : tournaments.length === 0 ? (
                  <div className="text-center py-12 bg-[#1A1A24] border-2 border-dashed border-white/10 rounded-2xl p-6">
                    <Trophy className="w-12 h-12 text-[#6500C8] mx-auto mb-3 opacity-60" />
                    <h3 className="font-bold text-base text-white uppercase">No Active Tournaments</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      Host a knockout championship or round-robin league and crown the ultimate Six Fingers champion!
                    </p>
                    <button
                      onClick={() => setActiveTab("create")}
                      className="mt-4 px-5 py-2.5 bg-[#FFD900] text-black font-black text-xs uppercase rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]"
                    >
                      Host First Tournament
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tournaments.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => fetchTournamentDetail(t.id)}
                        className="p-4 rounded-xl bg-[#1E1E2A] border-2 border-[#2E2E40] hover:border-[#6500C8] cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-black text-sm uppercase text-white">{t.title}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6500C8] text-white font-bold">
                              {t.tournament_format}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                            <span>Host: {t.organizer_name}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[#FFD900]">
                              <Users className="w-3.5 h-3.5" /> {t.current_participants}/{t.max_participants} Players
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border border-black ${
                            t.status === "COMPLETED" ? "bg-[#9BE52E] text-black" : "bg-[#FFD900] text-black"
                          }`}>
                            {t.status}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HOST TOURNAMENT */}
        {activeTab === "create" && (
          <form onSubmit={handleCreate} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-[#E50020]/20 border-2 border-[#E50020] text-[#FF8888] rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Tournament Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={80}
                className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none"
                >
                  <option value="KNOCKOUT">Single Elimination Knockout</option>
                  <option value="ROUND_ROBIN">Round Robin League</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Max Players</label>
                <select
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                  className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none"
                >
                  <option value="4">4 Players (Semifinals & Final)</option>
                  <option value="8">8 Players (Quarterfinals)</option>
                  <option value="16">16 Players (Full Bracket)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Overs Per Match</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={overs}
                  onChange={(e) => setOvers(parseInt(e.target.value) || 2)}
                  className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Wickets Per Innings</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={wickets}
                  onChange={(e) => setWickets(parseInt(e.target.value) || 3)}
                  className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#FFD900] text-black font-black uppercase text-sm rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] hover:bg-[#F0C800] transition-all mt-4"
            >
              {isSubmitting ? "Creating Tournament..." : "Host Tournament & Open Registration"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
