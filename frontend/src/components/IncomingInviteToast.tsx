"use client";

import React from "react";
import { usePresence } from "@/lib/presenceContext";
import { AvatarIcon } from "./Avatars";
import { Swords, Check, X } from "lucide-react";

export const IncomingInviteToast: React.FC = () => {
  const { activeInvite, dismissInvite, acceptInvite } = usePresence();

  if (!activeInvite) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#FFD900] border-4 border-black shadow-[6px_6px_0px_#111] p-4 max-w-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <AvatarIcon id={activeInvite.sender_avatar} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase text-[#6500C8] flex items-center gap-1">
              <Swords className="w-3.5 h-3.5" /> Match Challenge!
            </div>
            <div className="font-extrabold text-sm truncate text-black">
              {activeInvite.sender_tag}
            </div>
            <div className="text-xs font-bold text-gray-800">
              Invited you to room <span className="font-mono font-black">{activeInvite.room_code}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => acceptInvite(activeInvite)}
            className="py-2 px-3 bg-[#9BE52E] hover:bg-[#83c721] text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_#111] flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" /> Accept
          </button>
          <button
            onClick={dismissInvite}
            className="py-2 px-3 bg-white hover:bg-gray-100 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_#111] flex items-center justify-center gap-1"
          >
            <X className="w-4 h-4" /> Decline
          </button>
        </div>
      </div>
    </div>
  );
};
