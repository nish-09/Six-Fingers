import React from "react";

export const RetroController: React.FC<{ className?: string }> = ({ className = "w-16 h-12" }) => (
  <svg viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Body */}
    <rect x="5" y="10" width="90" height="50" rx="16" fill="#F000A8" stroke="#111111" strokeWidth="4" />
    {/* Left Grip */}
    <rect x="12" y="18" width="28" height="34" rx="8" fill="#9BE52E" stroke="#111111" strokeWidth="3" />
    {/* D-Pad */}
    <path d="M26 24V46M15 35H37" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
    {/* Face Eyes */}
    <circle cx="45" cy="30" r="3" fill="#111111" />
    <circle cx="55" cy="30" r="3" fill="#111111" />
    {/* Smile */}
    <path d="M46 38C48 42 52 42 54 38" stroke="#111111" strokeWidth="3" strokeLinecap="round" />
    {/* Action Buttons */}
    <circle cx="72" cy="28" r="5" fill="#FFD900" stroke="#111111" strokeWidth="3" />
    <circle cx="82" cy="38" r="5" fill="#6500C8" stroke="#111111" strokeWidth="3" />
  </svg>
);

export const CricketBallIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="45" fill="#F000A8" stroke="#111111" strokeWidth="6" />
    {/* Seam stitches */}
    <path d="M50 8C30 30 30 70 50 92" stroke="#FFFFFF" strokeWidth="5" strokeDasharray="6 4" />
    <path d="M50 8C70 30 70 70 50 92" stroke="#111111" strokeWidth="3" />
  </svg>
);

export const BarrelRollBadge: React.FC<{ className?: string }> = ({ className = "w-20 h-20" }) => (
  <div className={`relative flex items-center justify-center rounded-full bg-[#6500C8] border-4 border-[#111111] shadow-brutal text-white ${className}`}>
    <div className="text-[10px] font-black uppercase text-center leading-tight tracking-tighter">
      SIX<br /><span className="text-[#9BE52E]">FINGERS</span><br />CRICKET
    </div>
  </div>
);

export const StarSticker: React.FC<{ className?: string; color?: string }> = ({ className = "w-6 h-6", color = "#FFD900" }) => (
  <svg viewBox="0 0 24 24" fill={color} stroke="#111111" strokeWidth="2.5" className={className}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export const GameBannerTitle: React.FC<{ title?: string }> = ({ title = "LET THE GAME BEGIN" }) => (
  <div className="inline-block relative">
    <div className="bg-[#9BE52E] border-4 border-[#111111] px-6 py-3 rounded-2xl shadow-brutal-lg transform -rotate-1 hover:rotate-0 transition-transform">
      <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-[#111111] font-display uppercase">
        {title}
      </h2>
    </div>
  </div>
);
