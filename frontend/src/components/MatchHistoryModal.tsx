import React, { useState, useEffect } from "react";
import { X, History, Trophy, Calendar } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import { getApiBaseUrl } from "@/lib/config";

interface MatchHistoryModalProps {
  onClose: () => void;
}

export const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({ onClose }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const apiUrl = getApiBaseUrl();
        const res = await fetch(`${apiUrl}/api/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch (err) {
        console.warn("Could not fetch match history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="panel-brutal-white max-w-2xl w-full p-4 sm:p-6 my-auto border-4 border-[#111111] shadow-brutal-xl relative max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#6500C8]" />
            <h2 className="text-2xl font-black font-display text-[#111111] uppercase tracking-wide">
              RECENT MATCH HISTORY
            </h2>
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

        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500 animate-pulse">
            Loading match records...
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="font-bold">No saved matches yet.</p>
            <p className="text-xs">Complete a 2-player hand cricket game to see records here!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((record) => (
              <div
                key={record.id}
                className="bg-[#FFF9E8] border-3 border-black rounded-xl p-3 shadow-brutal-sm flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#6500C8] text-white text-[10px] font-black px-1.5 py-0.5 rounded font-mono">
                      ROOM: {record.room_code}
                    </span>
                    <span className="text-xs font-bold text-gray-500 font-mono">
                      {new Date(record.created_at * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-display font-black text-base text-[#111111] mt-0.5">
                    {record.team_a_name} vs {record.team_b_name}
                  </h4>
                  <p className="text-xs font-bold text-green-700">
                    {record.win_description || "Match Completed"}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-purple-900">
                    Inn 1: <span className="font-black">{record.first_innings}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-pink-700">
                    Inn 2: <span className="font-black">{record.second_innings}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold">
                    {record.total_deliveries} deliveries
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
