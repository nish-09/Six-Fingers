import React, { useState, useEffect } from "react";
import { X, Trophy, Swords, Plus, ArrowRight, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { useAuth } from "@/lib/authContext";

interface SeriesItem {
  id: string;
  title: string;
  creator_id: string;
  creator_name: string;
  opponent_id?: string;
  opponent_name: string;
  series_format: string;
  total_scheduled_matches: number;
  target_wins: number;
  overs_per_match: number;
  wickets_per_match: number;
  creator_wins: number;
  opponent_wins: number;
  draws: number;
  matches_played: number;
  status: string;
  winner_id?: string;
  winner_name?: string;
  current_room_code?: string;
  created_at: number;
}

interface SeriesModalProps {
  onClose: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const SeriesModal: React.FC<SeriesModalProps> = ({ onClose, onJoinRoom }) => {
  const { token, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Creation form state
  const [title, setTitle] = useState("Neon Rivals Derby");
  const [seriesFormat, setSeriesFormat] = useState("BEST_OF_3");
  const [targetWins, setTargetWins] = useState(2);
  const [fixedMatches, setFixedMatches] = useState(3);
  const [overs, setOvers] = useState(2);
  const [wickets, setWickets] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSeries = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/series/user/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSeriesList(data.series || []);
      }
    } catch (err) {
      console.error("Error fetching series:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
  }, [token]);

  const fetchSeriesDetail = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/series/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedSeries(data);
      }
    } catch (err) {
      console.error("Error fetching series detail:", err);
    }
  };

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/series/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          series_format: seriesFormat,
          target_wins: targetWins,
          total_scheduled_matches: seriesFormat === "FIXED_MATCHES" ? fixedMatches : 3,
          overs_per_match: overs,
          wickets_per_match: wickets,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        soundEngine.playVictory();
        onClose();
        if (data.room_code) {
          onJoinRoom(data.room_code);
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.detail || "Failed to create series");
      }
    } catch (err: any) {
      setErrorMsg("Network error connecting to series service");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNextMatch = async (seriesId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/series/${seriesId}/next-match`, {
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
      console.error("Error starting next match:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-[#16161F] border-4 border-[#111111] max-w-2xl w-full p-5 sm:p-6 my-auto shadow-[8px_8px_0px_#000] relative max-h-[85vh] overflow-y-auto text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-[#2A2A38] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD900] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
              <Trophy className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-display text-[#FFD900] uppercase tracking-wide">
                MULTI-MATCH SERIES HUB
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Compete across Best-of-3, 5, or 7 matches with friends
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
              setActiveTab("list");
              setSelectedSeries(null);
            }}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wide border-2 transition-all ${
              activeTab === "list"
                ? "bg-[#6500C8] border-white text-white shadow-[2px_2px_0px_#000]"
                : "bg-[#20202C] border-transparent text-gray-400 hover:text-white"
            }`}
          >
            My Series ({seriesList.length})
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wide border-2 transition-all flex items-center gap-2 ${
              activeTab === "create"
                ? "bg-[#FFD900] border-black text-black shadow-[2px_2px_0px_#000]"
                : "bg-[#20202C] border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Plus className="w-4 h-4" /> Create New Series
          </button>
        </div>

        {/* TAB 1: LIST / DETAILS */}
        {activeTab === "list" && (
          <div>
            {selectedSeries ? (
              <div>
                <button
                  onClick={() => setSelectedSeries(null)}
                  className="mb-4 text-xs font-bold text-[#FFD900] hover:underline flex items-center gap-1"
                >
                  ← Back to all series
                </button>

                <div className="bg-[#1C1C26] border-3 border-[#6500C8] rounded-xl p-4 shadow-[4px_4px_0px_#000] mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono uppercase bg-[#6500C8] px-2 py-0.5 rounded font-bold text-white">
                      {selectedSeries.series.series_format.replace("_", " ")}
                    </span>
                    <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                      selectedSeries.series.status === "COMPLETED" ? "bg-[#9BE52E] text-black" : "bg-[#FFD900] text-black"
                    }`}>
                      {selectedSeries.series.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-black font-display text-white">{selectedSeries.series.title}</h3>

                  {/* Scoreline */}
                  <div className="my-4 bg-black/60 rounded-xl p-4 border border-white/10 flex items-center justify-around text-center">
                    <div>
                      <div className="text-sm font-bold text-gray-300">{selectedSeries.series.creator_name}</div>
                      <div className="text-4xl font-black text-[#FFD900]">{selectedSeries.series.creator_wins}</div>
                    </div>
                    <div className="text-xl font-black text-gray-500 font-mono">VS</div>
                    <div>
                      <div className="text-sm font-bold text-gray-300">{selectedSeries.series.opponent_name}</div>
                      <div className="text-4xl font-black text-[#F000A8]">{selectedSeries.series.opponent_wins}</div>
                    </div>
                  </div>

                  {/* Winner Banner */}
                  {selectedSeries.series.status === "COMPLETED" && (
                    <div className="bg-[#FFD900] text-black p-3 rounded-xl border-2 border-black font-black text-center mb-4 flex items-center justify-center gap-2">
                      <Trophy className="w-5 h-5 text-[#6500C8]" />
                      SERIES CHAMPION: {selectedSeries.series.winner_name || "Winner"}
                    </div>
                  )}

                  {/* Matches History */}
                  <h4 className="font-black text-xs uppercase text-gray-400 mb-2">Played Matches ({selectedSeries.matches.length})</h4>
                  <div className="space-y-2 mb-4">
                    {selectedSeries.matches.length === 0 ? (
                      <div className="text-xs text-gray-500 italic p-3 bg-black/30 rounded">No matches completed yet in this series.</div>
                    ) : (
                      selectedSeries.matches.map((m: any) => (
                        <div key={m.id} className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex justify-between items-center text-xs">
                          <span className="font-bold text-[#FFD900]">Match {m.match_number}</span>
                          <span className="text-gray-300">{m.score_summary}</span>
                          <span className="font-bold text-[#9BE52E]">{m.winner_name || "Draw"}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Action */}
                  {selectedSeries.series.status === "ACTIVE" && (
                    <button
                      onClick={() => handleStartNextMatch(selectedSeries.series.id)}
                      className="w-full py-3 bg-[#9BE52E] text-black font-black uppercase rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#86CB24] flex items-center justify-center gap-2 transition-all"
                    >
                      <Play className="w-4 h-4 fill-current" /> Start Next Match (Match {selectedSeries.series.matches_played + 1})
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {isLoading ? (
                  <div className="text-center py-10 text-gray-400 font-mono text-sm">Loading series records...</div>
                ) : seriesList.length === 0 ? (
                  <div className="text-center py-12 bg-[#1A1A24] border-2 border-dashed border-white/10 rounded-2xl p-6">
                    <Swords className="w-12 h-12 text-[#FFD900] mx-auto mb-3 opacity-60" />
                    <h3 className="font-bold text-base text-white uppercase">No Series Created Yet</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      Challenge your friends to a multi-match rivalry. Play Best of 3 or 5 with automatic scorecard tracking!
                    </p>
                    <button
                      onClick={() => setActiveTab("create")}
                      className="mt-4 px-5 py-2.5 bg-[#FFD900] text-black font-black text-xs uppercase rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]"
                    >
                      Start First Series
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {seriesList.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => fetchSeriesDetail(s.id)}
                        className="p-4 rounded-xl bg-[#1E1E2A] border-2 border-[#2E2E40] hover:border-[#FFD900] cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-black text-sm uppercase text-white">{s.title}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6500C8] text-white font-bold">
                              {s.series_format.replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {s.creator_name} <span className="text-[#FFD900] font-black">[{s.creator_wins}]</span> - <span className="text-[#F000A8] font-black">[{s.opponent_wins}]</span> {s.opponent_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border border-black ${
                            s.status === "COMPLETED" ? "bg-[#9BE52E] text-black" : "bg-[#FFD900] text-black"
                          }`}>
                            {s.status}
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

        {/* TAB 2: CREATE SERIES */}
        {activeTab === "create" && (
          <form onSubmit={handleCreateSeries} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-[#E50020]/20 border-2 border-[#E50020] text-[#FF8888] rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Series Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={80}
                className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Format</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "BEST_OF_3", label: "Best of 3", desc: "First to 2 wins" },
                  { id: "BEST_OF_5", label: "Best of 5", desc: "First to 3 wins" },
                  { id: "BEST_OF_7", label: "Best of 7", desc: "First to 4 wins" },
                  { id: "FIXED_MATCHES", label: "Fixed Games", desc: "Set match count" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSeriesFormat(f.id)}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                      seriesFormat === f.id
                        ? "bg-[#6500C8] border-white text-white shadow-[2px_2px_0px_#000]"
                        : "bg-[#1E1E2A] border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <div className="font-black text-xs uppercase">{f.label}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Overs Per Match</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={overs}
                    onChange={(e) => setOvers(parseInt(e.target.value) || 2)}
                    className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none font-mono"
                  />
                  <span className="text-xs text-gray-400">overs</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1.5">Wickets Per Innings</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={wickets}
                    onChange={(e) => setWickets(parseInt(e.target.value) || 3)}
                    className="w-full bg-[#111116] border-2 border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-[#FFD900] outline-none font-mono"
                  />
                  <span className="text-xs text-gray-400">wickets</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#FFD900] text-black font-black uppercase text-sm rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] hover:bg-[#F0C800] transition-all mt-4"
            >
              {isSubmitting ? "Generating Series..." : "Create Series & Launch Match 1"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
