import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, RefreshCw, ListOrdered, Home, Sparkles } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { CricketBallIcon } from "./Stickers";

interface MatchResultViewProps {
  state: any;
  playerId: string;
  onRematch: () => void;
  onOpenDetailedScorecard: () => void;
  onReturnToLobby: () => void;
}

export const MatchResultView: React.FC<MatchResultViewProps> = ({
  state,
  playerId,
  onRematch,
  onOpenDetailedScorecard,
  onReturnToLobby,
}) => {
  useEffect(() => {
    soundEngine.playVictory();
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
    });
  }, []);

  const inn1 = state.innings_list?.[0];
  const inn2 = state.innings_list?.[1];

  const winnerTeam = state.winner_team_id === state.team_a?.id ? state.team_a : state.team_b;
  const isMyTeamWinner = (state.player_1_id === playerId
    ? state.winner_team_id === state.team_a?.id
    : state.winner_team_id === state.team_b?.id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Trophy & Victory Card */}
      <div className="panel-brutal-purple p-6 sm:p-8 text-center text-white relative overflow-hidden">
        <div className="w-20 h-20 bg-[#FFD900] border-4 border-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-brutal animate-bounce">
          <Trophy className="w-12 h-12 text-[#111111]" />
        </div>

        <span className="bg-[#9BE52E] text-black text-xs font-black uppercase px-4 py-1 rounded-full border-2 border-black inline-block mb-2 shadow-brutal-sm">
          MATCH CONCLUDED
        </span>

        <h1 className="text-4xl sm:text-5xl font-black font-display text-[#FFD900] uppercase tracking-wide">
          {state.win_margin_description || "MATCH FINISHED!"}
        </h1>

        <p className="text-sm sm:text-base font-bold text-[#FFF9E8] mt-2 max-w-lg mx-auto">
          {isMyTeamWinner
            ? "Congratulations! You emerged victorious in this fierce Hand Cricket battle! 🏆"
            : "Tough match! A brilliant hand-cricket duel between friends."}
        </p>

        {/* Score summaries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {inn1 && (
            <div className="bg-[#FFF9E8] text-[#111111] border-3 border-black rounded-xl p-4 shadow-brutal-sm text-left">
              <span className="text-[10px] font-black uppercase bg-[#6500C8] text-white px-2 py-0.5 rounded">
                1ST INNINGS
              </span>
              <div className="text-lg font-black font-display mt-1 text-[#111111]">
                {inn1.batting_team_name}
              </div>
              <div className="text-3xl font-black font-display text-[#F000A8]">
                {inn1.total_runs}/{inn1.wickets}
              </div>
              <div className="text-xs font-bold text-gray-600 font-mono">
                {Math.floor(inn1.balls_bowled / state.rules.balls_per_over)}.{inn1.balls_bowled % state.rules.balls_per_over} Overs
              </div>
            </div>
          )}

          {inn2 && (
            <div className="bg-[#FFF9E8] text-[#111111] border-3 border-black rounded-xl p-4 shadow-brutal-sm text-left">
              <span className="text-[10px] font-black uppercase bg-[#F000A8] text-white px-2 py-0.5 rounded">
                2ND INNINGS (CHASE)
              </span>
              <div className="text-lg font-black font-display mt-1 text-[#111111]">
                {inn2.batting_team_name}
              </div>
              <div className="text-3xl font-black font-display text-[#9BE52E] text-stroke">
                {inn2.total_runs}/{inn2.wickets}
              </div>
              <div className="text-xs font-bold text-gray-600 font-mono">
                {Math.floor(inn2.balls_bowled / state.rules.balls_per_over)}.{inn2.balls_bowled % state.rules.balls_per_over} Overs (Target: {inn2.target})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => {
            soundEngine.playClick();
            onRematch();
          }}
          className="btn-brutal-green text-base px-8 py-3.5 rounded-xl flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          <span>INSTANT REMATCH! 🔄</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            onOpenDetailedScorecard();
          }}
          className="btn-brutal-yellow text-base px-6 py-3.5 rounded-xl flex items-center gap-2"
        >
          <ListOrdered className="w-5 h-5" />
          <span>FULL SCORECARD 📊</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            onReturnToLobby();
          }}
          className="btn-brutal-white text-base px-6 py-3.5 rounded-xl flex items-center gap-2"
        >
          <Home className="w-5 h-5" />
          <span>LOBBY</span>
        </button>
      </div>
    </div>
  );
};
