import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Flame, Sparkles, Smile, Shield, Eye } from "lucide-react";
import { soundEngine } from "@/lib/sound";

export interface ChatMessageItem {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string; // "player" | "spectator"
  team_id?: string | null;
  channel: string;
  text: string;
  reaction?: string | null;
  timestamp: number;
}

interface ChatDrawerProps {
  messages: ChatMessageItem[];
  currentUserId: string;
  currentUserRole: string; // "player" | "spectator"
  currentUserTeamId?: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSendMessage: (channel: string, text: string, reaction?: string) => void;
}

const QUICK_REACTIONS = ["🏏", "🚀", "🔥", "👏", "😱", "⚡", "💯", "🎯"];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  currentUserId,
  currentUserRole,
  currentUserTeamId,
  isOpen,
  onToggle,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"all" | "team" | "spectator">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    soundEngine.playClick();
    onSendMessage(selectedChannel, inputText.trim());
    setInputText("");
  };

  const handleReactionClick = (emoji: string) => {
    soundEngine.playClick();
    onSendMessage(selectedChannel, "", emoji);
  };

  return (
    <>
      {/* Floating Toggle Button (if closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-4 right-4 z-40 bg-[#FFD900] text-[#111111] border-3 border-[#111111] rounded-2xl p-3 shadow-brutal flex items-center gap-2 hover:bg-[#9BE52E] transition-all font-display font-black text-sm uppercase group"
          title="Open Match & Spectator Chat"
        >
          <MessageSquare className="w-5 h-5 text-[#6500C8] group-hover:scale-110 transition-transform" />
          <span>CHAT & REACTIONS</span>
          {messages.length > 0 && (
            <span className="bg-[#F000A8] text-white text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full border border-black">
              {messages.length}
            </span>
          )}
        </button>
      )}

      {/* Slide-in Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 w-[95vw] sm:w-96 max-h-[85vh] h-[550px] bg-[#FFF9E8] border-4 border-[#111111] rounded-2xl shadow-brutal-lg flex flex-col overflow-hidden animate-pop">
          {/* Header - Inverted Palette */}
          <div className="bg-[#FFD900] border-b-3 border-[#111111] p-3 text-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#1A0038]" />
              <h3 className="font-display font-black text-sm uppercase text-black tracking-wider">
                LIVE MATCH CHAT
              </h3>
            </div>
            <button
              onClick={onToggle}
              className="p-1 bg-[#FFF9E8] text-[#111111] rounded-lg border-2 border-black hover:bg-red-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Channel Selector Tabs */}
          <div className="bg-[#111111] p-1.5 flex gap-1 border-b-2 border-black">
            <button
              onClick={() => setSelectedChannel("all")}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-display font-black uppercase transition-all ${
                selectedChannel === "all"
                  ? "bg-[#FFD900] text-[#111111] border border-black"
                  : "bg-transparent text-gray-300 hover:bg-white/10"
              }`}
            >
              🌐 ALL CHAT
            </button>
            {currentUserRole === "player" && currentUserTeamId && (
              <button
                onClick={() => setSelectedChannel("team")}
                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-display font-black uppercase transition-all ${
                  selectedChannel === "team"
                    ? "bg-[#9BE52E] text-[#111111] border border-black"
                    : "bg-transparent text-gray-300 hover:bg-white/10"
                }`}
              >
                🛡️ TEAM ONLY
              </button>
            )}
            <button
              onClick={() => setSelectedChannel("spectator")}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-display font-black uppercase transition-all ${
                selectedChannel === "spectator"
                  ? "bg-[#F000A8] text-white border border-black"
                  : "bg-transparent text-gray-300 hover:bg-white/10"
              }`}
            >
              👁️ SPECTATORS
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#FFF9E8]">
            {messages.length === 0 ? (
              <div className="text-center py-10 text-gray-500 font-mono text-xs">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-[#6500C8] animate-bounce" />
                <p className="font-bold">No messages yet!</p>
                <p className="text-[11px] text-gray-400">Cheer for your team or react with emojis below.</p>
              </div>
            ) : (
              messages
                .filter((m) => {
                  if (selectedChannel === "all") return m.channel === "all";
                  if (selectedChannel === "team") return m.channel === "team";
                  if (selectedChannel === "spectator") return m.channel === "spectator";
                  return true;
                })
                .map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  const isSpectator = msg.sender_role === "spectator";

                  return (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-xl border-2 border-[#111111] shadow-brutal-sm text-xs ${
                        isMe
                          ? "bg-[#9BE52E]/30 ml-4 border-[#111111]"
                          : isSpectator
                          ? "bg-[#FFD900]/25 mr-4"
                          : "bg-white mr-4"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-black text-[#111111]">
                            {msg.sender_name}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-black ${
                              isSpectator
                                ? "bg-[#FFD900] text-black"
                                : "bg-[#6500C8] text-white"
                            }`}
                          >
                            {isSpectator ? "SPECTATOR 👁️" : "PLAYER 🏏"}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-gray-500">
                          {new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {msg.text && (
                        <p className="text-gray-900 font-medium break-words">{msg.text}</p>
                      )}

                      {msg.reaction && (
                        <span className="inline-block text-2xl mt-1 animate-bounce">
                          {msg.reaction}
                        </span>
                      )}
                    </div>
                  );
                })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reaction Bar */}
          <div className="bg-[#FFF9E8] border-t-2 border-gray-300 p-2 flex items-center justify-around gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-lg hover:bg-[#FFD900] active:scale-90 transition-all shadow-brutal-sm"
                title={`Send ${emoji} reaction`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-2.5 bg-white border-t-3 border-[#111111] flex gap-2">
            <input
              type="text"
              maxLength={200}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message in ${selectedChannel.toUpperCase()}...`}
              className="flex-1 bg-[#FFF9E8] border-2 border-[#111111] rounded-xl px-3 py-1.5 text-xs font-mono font-bold outline-none focus:bg-white"
            />
            <button
              type="submit"
              className="btn-brutal-pink px-3 py-1.5 rounded-xl text-xs flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
