import React from "react";
import { Sparkles, Shield, User, CircleDot } from "lucide-react";
import { CricketBallIcon } from "./Stickers";

interface ScoreboardProps {
  currentInningsNum: number;
  battingTeamName: string;
  bowlingTeamName: string;
  totalRuns: number;
  wickets: number;
  ballsBowled: number;
  ballsPerOver: number;
  totalOvers: number;
  target?: number | null;
  strikerName?: string;
  strikerRuns?: number;
  strikerBalls?: number;
  strikerFours?: number;
  strikerSixes?: number;
  nonStrikerName?: string;
  nonStrikerRuns?: number;
  nonStrikerBalls?: number;
  bowlerName?: string;
  bowlerOvers?: string;
  bowlerRuns?: number;
  bowlerWickets?: number;
  activeBattingControllerName?: string;
  activeBowlingControllerName?: string;
  nextBattingControllerName?: string;
  nextBowlingControllerName?: string;
  spectatorCount?: number;
  recentDeliveries?: Array<{
    runs: number;
    isWicket: boolean;
    ballNum: number;
  }>;
  latestCommentary?: string;
  onOpenDetailedScorecard?: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  currentInningsNum,
  battingTeamName,
  bowlingTeamName,
  totalRuns,
  wickets,
  ballsBowled,
  ballsPerOver = 6,
  totalOvers = 2,
  target,
  strikerName = "Striker",
  strikerRuns = 0,
  strikerBalls = 0,
  strikerFours = 0,
  strikerSixes = 0,
  nonStrikerName = "Non-Striker",
  nonStrikerRuns = 0,
  nonStrikerBalls = 0,
  bowlerName = "Bowler",
  bowlerOvers = "0.0",
  bowlerRuns = 0,
  bowlerWickets = 0,
  activeBattingControllerName,
  activeBowlingControllerName,
  nextBattingControllerName,
  nextBowlingControllerName,
  spectatorCount = 0,
  recentDeliveries = [],
  latestCommentary,
  onOpenDetailedScorecard,
}) => {
  const completedOvers = Math.floor(ballsBowled / ballsPerOver);
  const ballsInCurrentOver = ballsBowled % ballsPerOver;
  const oversFormatted = `${completedOvers}.${ballsInCurrentOver}`;
  const totalPossibleBalls = totalOvers * ballsPerOver;
  const remainingBalls = Math.max(0, totalPossibleBalls - ballsBowled);
  const runsNeeded = target ? Math.max(0, target - totalRuns) : null;
  const runRate = ballsBowled > 0 ? ((totalRuns / ballsBowled) * ballsPerOver).toFixed(1) : "0.0";
  const reqRunRate = runsNeeded !== null && remainingBalls > 0 ? ((runsNeeded / remainingBalls) * ballsPerOver).toFixed(1) : null;

  return (
    <div className="w-full bg-[#6500C8] border-4 border-[#111111] rounded-2xl shadow-brutal p-3 sm:p-4 text-white">
      {/* Top Header: Innings & Target / RRR Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-3 border-[#111111] pb-2 mb-3 bg-[#470094] -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 p-3 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="bg-[#FFD900] text-[#111111] text-xs font-black uppercase px-2.5 py-1 rounded-lg border-2 border-[#111111] shadow-brutal-sm">
            INNINGS {currentInningsNum}
          </span>
          <span className="font-display font-black text-sm sm:text-base tracking-wide text-[#FFF9E8]">
            {battingTeamName} vs {bowlingTeamName}
          </span>
        </div>

        {/* Spectator Count Badge */}
        {spectatorCount > 0 && (
          <div className="bg-[#FFD900] text-[#111111] px-2.5 py-1 rounded-xl border-2 border-[#111111] font-mono font-black text-xs shadow-brutal-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>👁️ {spectatorCount} SPECTATING</span>
          </div>
        )}

        {target && (
          <div className="flex items-center gap-2 bg-[#9BE52E] text-[#111111] px-3 py-1 rounded-xl border-2 border-[#111111] font-display font-black text-xs sm:text-sm shadow-brutal-sm">
            <span>TARGET: {target}</span>
            <span className="text-[10px] bg-[#111111] text-white px-1.5 py-0.5 rounded">
              NEED {runsNeeded} OFF {remainingBalls}B (RRR {reqRunRate})
            </span>
          </div>
        )}

        {onOpenDetailedScorecard && (
          <button
            onClick={onOpenDetailedScorecard}
            className="btn-brutal-pink text-[11px] px-2.5 py-1 rounded-lg"
          >
            SCORECARD
          </button>
        )}
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        {/* Total Score & Overs */}
        <div className="bg-[#FFF9E8] text-[#111111] border-3 border-[#111111] rounded-xl p-3 shadow-brutal-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
              {battingTeamName}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black font-display tracking-tight text-[#111111]">
                {totalRuns}
              </span>
              <span className="text-2xl font-bold text-gray-500">/</span>
              <span className="text-3xl font-black font-display text-[#F000A8]">
                {wickets}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-gray-600">OVERS</div>
            <div className="text-2xl font-black font-mono">
              {oversFormatted}
              <span className="text-xs font-bold text-gray-500">/{totalOvers}</span>
            </div>
            <div className="text-[10px] font-bold text-purple-800">CRR: {runRate}</div>
          </div>
        </div>

        {/* Batsmen On Strike + Controller */}
        <div className="bg-[#FFF9E8] text-[#111111] border-3 border-[#111111] rounded-xl p-2.5 shadow-brutal-sm space-y-1.5">
          <div className="flex items-center justify-between border-b-2 border-gray-200 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9BE52E] border border-black animate-ping" />
              <span className="text-xs font-black truncate max-w-[130px]" title={strikerName}>
                {strikerName}*
              </span>
            </div>
            <div className="text-xs font-mono font-black">
              {strikerRuns} <span className="text-[10px] font-normal text-gray-600">({strikerBalls}b, 4s:{strikerFours}, 6s:{strikerSixes})</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-700">
              <span className="text-xs font-bold truncate max-w-[130px]" title={nonStrikerName}>
                {nonStrikerName}
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-gray-700">
              {nonStrikerRuns} <span className="text-[10px] font-normal text-gray-500">({nonStrikerBalls}b)</span>
            </div>
          </div>

          {activeBattingControllerName && (
            <div className="pt-1 border-t border-gray-200 flex items-center justify-between text-[10px]">
              <span className="font-mono font-bold text-purple-900">
                BAT CONTROL: <span className="font-black text-black">{activeBattingControllerName}</span>
              </span>
              {nextBattingControllerName && (
                <span className="text-gray-500 font-mono text-[9px]">
                  Next: {nextBattingControllerName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Current Bowler & Over Deliveries + Controller */}
        <div className="bg-[#FFF9E8] text-[#111111] border-3 border-[#111111] rounded-xl p-2.5 shadow-brutal-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CricketBallIcon className="w-4 h-4" />
              <span className="text-xs font-black truncate max-w-[120px]" title={bowlerName}>
                {bowlerName}
              </span>
            </div>
            <div className="text-xs font-mono font-black text-purple-900">
              {bowlerWickets}/{bowlerRuns} <span className="text-[10px] text-gray-500">({bowlerOvers} ov)</span>
            </div>
          </div>

          {activeBowlingControllerName && (
            <div className="flex items-center justify-between text-[10px] text-purple-900">
              <span className="font-mono font-bold">
                BOWL CONTROL: <span className="font-black text-black">{activeBowlingControllerName}</span>
              </span>
              {nextBowlingControllerName && (
                <span className="text-gray-500 font-mono text-[9px]">
                  Next: {nextBowlingControllerName}
                </span>
              )}
            </div>
          )}

          {/* Recent Deliveries Ball Badges */}
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
            <span className="text-[10px] font-black uppercase text-gray-600 mr-1">THIS OVER:</span>
            {recentDeliveries.length === 0 ? (
              <span className="text-[10px] text-gray-400 font-bold italic">Waiting for 1st ball...</span>
            ) : (
              recentDeliveries.map((deliv, idx) => {
                let badgeBg = "bg-white text-black";
                let label = `${deliv.runs}`;
                if (deliv.isWicket) {
                  badgeBg = "bg-red-500 text-white animate-bounce";
                  label = "W";
                } else if (deliv.runs === 6) {
                  badgeBg = "bg-[#F000A8] text-white font-black";
                } else if (deliv.runs === 4) {
                  badgeBg = "bg-[#9BE52E] text-black font-black";
                } else if (deliv.runs > 0) {
                  badgeBg = "bg-[#FFD900] text-black";
                }
                return (
                  <span
                    key={idx}
                    className={`w-6 h-6 rounded-full border-2 border-[#111111] flex items-center justify-center text-xs font-black font-mono shadow-sm flex-shrink-0 ${badgeBg}`}
                  >
                    {label}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Live Commentary Ticker */}
      {latestCommentary && (
        <div className="mt-3 bg-[#111111] border-2 border-[#FFD900] rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-inner">
          <span className="bg-[#F000A8] text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-white">
            COMM
          </span>
          <p className="text-xs font-medium text-[#FFF9E8] font-mono truncate">
            {latestCommentary}
          </p>
        </div>
      )}
    </div>
  );
};
