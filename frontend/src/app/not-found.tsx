import React from "react";
import Link from "next/link";
import { CricketBallIcon } from "@/components/Stickers";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FFD900] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#16161F] border-4 border-[#111111] p-8 text-center text-white shadow-[8px_8px_0px_#111111] rounded-2xl space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-[#6500C8] border-3 border-black flex items-center justify-center shadow-[4px_4px_0px_#FFD900]">
          <CricketBallIcon className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <div className="inline-block bg-[#F000A8] text-white text-xs font-black uppercase px-3 py-1 rounded-full border-2 border-black">
            ERROR 404
          </div>
          <h1 className="text-4xl font-black font-display text-[#FFD900] uppercase tracking-wide">
            OUT! CLEAN BOWLED
          </h1>
          <p className="text-sm font-bold text-gray-300">
            The delivery went wide of the pitch. This crease does not exist or has moved!
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="w-full py-3.5 px-6 bg-[#9BE52E] hover:bg-[#88d420] text-black border-3 border-black shadow-[4px_4px_0px_#111] font-display font-black text-sm uppercase flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 rounded-xl"
          >
            <Home className="w-4 h-4" />
            <span>Return to Pavilion (Home)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
