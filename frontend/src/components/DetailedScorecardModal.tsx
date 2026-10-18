import React, { useState } from "react";
import { X, Award, Shield, User } from "lucide-react";
import { soundEngine } from "@/lib/sound";

interface DetailedScorecardModalProps {
  state: any;
  onClose: () => void;
}

export const DetailedScorecardModal: React.FC<DetailedScorecardModalProps> = ({
  state,
  onClose,
}) => {
  const [selectedInningsIdx, setSelectedInningsIdx] = useState<number>(0);
  const inningsList = state.innings_list || [];
  const currentInnings = inningsList[selectedInningsIdx];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="panel-brutal-white max-w-3xl w-full p-4 sm:p-6 my-auto border-4 border-[#111111] shadow-brutal-xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-display text-[#111111] uppercase tracking-wide">
              OFFICIAL MATCH SCORECARD
            </h2>
            <p className="text-xs text-gray-600 font-bold">
              {state.team_a?.name} vs {state.team_b?.name} • Room {state.room_code}
            </p>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg border-2 border-black hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Innings Tabs */}
        {inningsList.length > 1 && (
          <div className="flex gap-2 mb-4">
            {inningsList.map((inn: any, idx: number) => (
              <button
                key={idx}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedInningsIdx(idx);
                }}
                className={`px-4 py-2 rounded-xl border-3 border-black font-display font-black text-xs uppercase ${
                  selectedInningsIdx === idx
                    ? "bg-[#6500C8] text-white shadow-brutal-sm"
                    : "bg-white text-black hover:bg-yellow-100"
                }`}
              >
                Innings {inn.innings_number}: {inn.batting_team_name} ({inn.total_runs}/{inn.wickets})
              </button>
            ))}
          </div>
        )}

        {currentInnings ? (
          <div className="space-y-5">
            {/* Innings Overview Banner */}
            <div className="bg-[#FFD900] border-3 border-black rounded-xl p-3 flex flex-wrap items-center justify-between shadow-brutal-sm">
              <div>
                <span className="text-[10px] font-black uppercase bg-[#6500C8] text-white px-2 py-0.5 rounded">
                  BATTING
                </span>
                <h3 className="text-xl font-black font-display mt-0.5 text-[#111111]">
                  {currentInnings.batting_team_name}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black font-display text-[#111111]">
                  {currentInnings.total_runs} / {currentInnings.wickets}
                </span>
                <span className="text-xs font-mono font-bold text-gray-700 block">
                  ({Math.floor(currentInnings.balls_bowled / state.rules.balls_per_over)}.{currentInnings.balls_bowled % state.rules.balls_per_over} Overs)
                </span>
              </div>
            </div>

            {/* Batting Table */}
            <div>
              <h4 className="font-display font-black text-sm uppercase text-purple-900 mb-2">
                BATTING PERFORMANCE
              </h4>
              <div className="overflow-x-auto border-3 border-black rounded-xl shadow-brutal-sm">
                <table className="w-full text-left text-xs bg-white">
                  <thead className="bg-[#6500C8] text-white font-mono uppercase text-[11px]">
                    <tr>
                      <th className="p-2.5">Batter</th>
                      <th className="p-2.5">Dismissal</th>
                      <th className="p-2.5 text-center">R</th>
                      <th className="p-2.5 text-center">B</th>
                      <th className="p-2.5 text-center">4s</th>
                      <th className="p-2.5 text-center">6s</th>
                      <th className="p-2.5 text-center">SR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-gray-200 font-medium">
                    {Object.values(currentInnings.batters || {}).map((b: any, i: number) => {
                      const sr = b.balls_faced > 0 ? ((b.runs / b.balls_faced) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={i} className="hover:bg-yellow-50">
                          <td className="p-2.5 font-bold text-[#111111]">{b.name}</td>
                          <td className="p-2.5 text-gray-600 font-mono text-[10px]">
                            {b.is_out ? (b.dismissal_info || "c & b") : "not out"}
                          </td>
                          <td className="p-2.5 text-center font-black font-mono text-sm">{b.runs}</td>
                          <td className="p-2.5 text-center font-mono">{b.balls_faced}</td>
                          <td className="p-2.5 text-center font-mono text-green-700 font-bold">{b.fours}</td>
                          <td className="p-2.5 text-center font-mono text-[#F000A8] font-black">{b.sixes}</td>
                          <td className="p-2.5 text-center font-mono">{sr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bowling Table */}
            <div>
              <h4 className="font-display font-black text-sm uppercase text-purple-900 mb-2">
                BOWLING FIGURES
              </h4>
              <div className="overflow-x-auto border-3 border-black rounded-xl shadow-brutal-sm">
                <table className="w-full text-left text-xs bg-white">
                  <thead className="bg-[#111111] text-white font-mono uppercase text-[11px]">
                    <tr>
                      <th className="p-2.5">Bowler</th>
                      <th className="p-2.5 text-center">O</th>
                      <th className="p-2.5 text-center">M</th>
                      <th className="p-2.5 text-center">R</th>
                      <th className="p-2.5 text-center">W</th>
                      <th className="p-2.5 text-center">Econ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-gray-200 font-medium">
                    {Object.values(currentInnings.bowlers || {}).map((bw: any, i: number) => {
                      const ov = `${Math.floor(bw.balls_bowled / state.rules.balls_per_over)}.${bw.balls_bowled % state.rules.balls_per_over}`;
                      const econ = bw.balls_bowled > 0 ? ((bw.runs_conceded / bw.balls_bowled) * state.rules.balls_per_over).toFixed(2) : "0.00";
                      return (
                        <tr key={i} className="hover:bg-yellow-50">
                          <td className="p-2.5 font-bold text-[#111111]">{bw.name}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{ov}</td>
                          <td className="p-2.5 text-center font-mono">{bw.maidens || 0}</td>
                          <td className="p-2.5 text-center font-mono">{bw.runs_conceded}</td>
                          <td className="p-2.5 text-center font-mono font-black text-red-600 text-sm">{bw.wickets}</td>
                          <td className="p-2.5 text-center font-mono">{econ}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm font-bold text-gray-500 py-6 text-center">
            No innings data available yet. Play a delivery to view scorecard!
          </p>
        )}
      </div>
    </div>
  );
};
