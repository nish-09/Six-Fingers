import React, { useState } from "react";
import { Sparkles, Trophy, ArrowRight } from "lucide-react";
import { soundEngine } from "@/lib/sound";

interface TossModalProps {
  state: any;
  playerId: string;
  isHost: boolean;
  onDoToss: (callChoice: "heads" | "tails") => void;
  onTossDecision: (decision: "bat" | "bowl") => void;
}

export const TossModal: React.FC<TossModalProps> = ({
  state,
  playerId,
  isHost,
  onDoToss,
  onTossDecision,
}) => {
  const [selectedCall, setSelectedCall] = useState<"heads" | "tails">("heads");
  const [isFlipping, setIsFlipping] = useState(false);

  const isSpectator = Boolean(
    state.spectators?.includes(playerId) ||
    (state.participants && state.participants[playerId]?.role === "spectator")
  );

  const teamB = state.team_b;
  const teamA = state.team_a;
  const tossCallerId = teamB?.captain_id || teamB?.human_player_ids?.[0] || state.player_2_id;
  const canCallToss = !isSpectator && (playerId === tossCallerId || (!isHost && !isSpectator));

  const winnerTeam = state.toss_winner_id === teamA?.id ? teamA : state.toss_winner_id === teamB?.id ? teamB : null;
  const isTossWinner = !isSpectator && (
    state.toss_winner_id === playerId ||
    winnerTeam?.captain_id === playerId ||
    (winnerTeam?.human_player_ids && winnerTeam.human_player_ids[0] === playerId)
  );

  const tossWinnerName = winnerTeam?.name || (state.toss_winner_id === state.player_1_id ? state.player_1_name : state.player_2_name) || "Winner";


  const handleFlip = () => {
    soundEngine.playTossCoin();
    setIsFlipping(true);
    setTimeout(() => {
      setIsFlipping(false);
      onDoToss(selectedCall);
    }, 1200);
  };

  const handleDecision = (decision: "bat" | "bowl") => {
    soundEngine.playClick();
    onTossDecision(decision);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="panel-brutal-purple max-w-lg w-full p-6 text-center text-white animate-pop border-4 border-[#111111] shadow-brutal-xl">
        <span className="bg-[#FFD900] text-[#111111] text-xs font-black uppercase px-3 py-1 rounded-full border-2 border-black inline-block mb-3">
          MATCH PRE-GAME
        </span>

        <h2 className="text-3xl sm:text-4xl font-black font-display text-[#FFD900] uppercase tracking-wide">
          THE OFFICIAL COIN TOSS
        </h2>

        {/* Phase 1: Coin Flip Call */}
        {!state.toss_winner_id ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm font-bold text-[#FFF9E8]">
              {canCallToss
                ? "You have the call! Choose Heads or Tails and flip the coin:"
                : `Waiting for ${state.player_2_name || "Guest"} to call the toss...`}
            </p>

            {/* Coin Graphic */}
            <div className="flex justify-center my-4">
              <div
                className={`w-28 h-28 rounded-full bg-[#FFD900] border-4 border-[#111111] shadow-brutal flex items-center justify-center text-3xl font-black font-display text-[#111111] uppercase ${
                  isFlipping ? "animate-spin" : ""
                }`}
              >
                {selectedCall === "heads" ? "🪙 H" : "🪙 T"}
              </div>
            </div>

            {canCallToss ? (
              <div className="space-y-4">
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedCall("heads");
                    }}
                    className={`px-6 py-2.5 rounded-xl border-3 border-[#111111] font-display font-black text-sm uppercase ${
                      selectedCall === "heads" ? "bg-[#9BE52E] text-black shadow-brutal-sm" : "bg-white text-black"
                    }`}
                  >
                    CALL HEADS
                  </button>

                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedCall("tails");
                    }}
                    className={`px-6 py-2.5 rounded-xl border-3 border-[#111111] font-display font-black text-sm uppercase ${
                      selectedCall === "tails" ? "bg-[#9BE52E] text-black shadow-brutal-sm" : "bg-white text-black"
                    }`}
                  >
                    CALL TAILS
                  </button>
                </div>

                <button
                  disabled={isFlipping}
                  onClick={handleFlip}
                  className="btn-brutal-pink text-base px-8 py-3 rounded-xl w-full"
                >
                  {isFlipping ? "FLIPPING COIN IN THE AIR..." : "FLIP COIN NOW! 🚀"}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-[#470094] rounded-xl border-2 border-[#FFD900] animate-pulse">
                <span className="text-sm font-mono font-bold">Calling in progress...</span>
              </div>
            )}
          </div>
        ) : (
          /* Phase 2: Winner Decision (Bat or Bowl) */
          <div className="mt-6 space-y-5 animate-pop">
            <div className="bg-[#9BE52E] text-[#111111] border-3 border-black p-4 rounded-xl shadow-brutal-sm">
              <Trophy className="w-8 h-8 mx-auto mb-1 text-[#6500C8]" />
              <h3 className="font-display font-black text-2xl uppercase">
                {tossWinnerName} WON THE TOSS!
              </h3>
            </div>

            {isTossWinner ? (
              <div className="space-y-3">
                <p className="text-sm font-bold text-[#FFF9E8]">
                  Make your tactical decision for the match:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleDecision("bat")}
                    className="btn-brutal-yellow py-4 rounded-xl text-lg flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-2xl">🏏</span>
                    <span>BAT FIRST</span>
                  </button>

                  <button
                    onClick={() => handleDecision("bowl")}
                    className="btn-brutal-green py-4 rounded-xl text-lg flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-2xl">🎯</span>
                    <span>BOWL FIRST</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#470094] rounded-xl border-2 border-[#FFD900] animate-pulse">
                <p className="text-sm font-mono font-bold">
                  Waiting for {tossWinnerName} to choose Bat or Bowl...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
