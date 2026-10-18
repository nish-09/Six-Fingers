import React from "react";

export interface AvatarProps {
  id?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24"
};

export const AVATAR_OPTIONS = [
  { id: "avatar_1", name: "Cyber Striker", color: "#6500C8" },
  { id: "avatar_2", name: "Electric Sixer", color: "#FFD900" },
  { id: "avatar_3", name: "Neon Bowler", color: "#F000A8" },
  { id: "avatar_4", name: "Golden Palm", color: "#FFD900" },
  { id: "avatar_5", name: "Viper Spinner", color: "#9BE52E" },
  { id: "avatar_6", name: "Titan Keeper", color: "#111111" },
  { id: "avatar_7", name: "Phoenix Finisher", color: "#FF5500" },
  { id: "avatar_8", name: "Crown Champion", color: "#FFD900" }
];

export const AvatarIcon: React.FC<AvatarProps> = ({ id = "avatar_1", size = "md", className = "" }) => {
  const sizeCls = sizeClasses[size];

  switch (id) {
    case "avatar_2":
      // Electric Sixer
      return (
        <div className={`${sizeCls} rounded-full bg-[#FFD900] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <rect width="40" height="40" rx="20" fill="#FFD900" />
            <path d="M12 28V16C12 14.5 13.5 13 15 13C16.5 13 18 14.5 18 16V28" stroke="#111" strokeWidth="3" strokeLinecap="round" />
            <path d="M22 28V12C22 10.5 23.5 9 25 9C26.5 9 28 10.5 28 12V28" stroke="#111" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 24C8 21 11 19 12 19" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="15" cy="10" r="2.5" fill="#F000A8" />
            <circle cx="25" cy="6" r="2.5" fill="#6500C8" />
            <path d="M10 32C10 30 14 28 20 28C26 28 30 30 30 32" stroke="#111" strokeWidth="3" fill="#6500C8" />
          </svg>
        </div>
      );
    case "avatar_3":
      // Neon Bowler
      return (
        <div className={`${sizeCls} rounded-full bg-[#F000A8] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <circle cx="20" cy="20" r="17" fill="#F000A8" stroke="#111" strokeWidth="3" />
            <path d="M10 10C15 15 15 25 10 30" stroke="#FFF" strokeWidth="2.5" strokeDasharray="2 2" />
            <path d="M30 10C25 15 25 25 30 30" stroke="#FFF" strokeWidth="2.5" strokeDasharray="2 2" />
            <line x1="20" y1="3" x2="20" y2="37" stroke="#111" strokeWidth="2.5" />
            <path d="M16 8L24 12M16 16L24 20M16 24L24 28M16 32L24 36" stroke="#9BE52E" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case "avatar_4":
      // Golden Palm
      return (
        <div className={`${sizeCls} rounded-full bg-[#FFD900] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <circle cx="20" cy="20" r="17" fill="#FFD900" stroke="#111" strokeWidth="3" />
            <path d="M11 26V18C11 16.5 13 16.5 13 18V26" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            <path d="M15 26V13C15 11.5 17 11.5 17 13V26" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M19 26V10C19 8.5 21 8.5 21 10V26" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M23 26V13C23 11.5 25 11.5 25 13V26" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M27 26V17C27 15.5 29 15.5 29 17V26" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            <path d="M11 26C11 31 16 33 20 33C24 33 29 31 29 26" fill="#F000A8" stroke="#111" strokeWidth="2.5" />
          </svg>
        </div>
      );
    case "avatar_5":
      // Viper Spinner
      return (
        <div className={`${sizeCls} rounded-full bg-[#9BE52E] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <circle cx="20" cy="20" r="17" fill="#9BE52E" stroke="#111" strokeWidth="3" />
            <path d="M8 20C12 12 28 12 32 20C28 28 12 28 8 20Z" fill="#111" />
            <circle cx="16" cy="20" r="3" fill="#FFD900" />
            <circle cx="24" cy="20" r="3" fill="#FFD900" />
            <circle cx="16" cy="20" r="1" fill="#111" />
            <circle cx="24" cy="20" r="1" fill="#111" />
            <path d="M20 23V27L22 29M20 27L18 29" stroke="#F000A8" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    case "avatar_6":
      // Titan Keeper
      return (
        <div className={`${sizeCls} rounded-full bg-[#111111] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <circle cx="20" cy="20" r="17" fill="#111" stroke="#FFD900" strokeWidth="3" />
            <rect x="12" y="14" width="16" height="14" rx="4" fill="#6500C8" stroke="#FFF" strokeWidth="2" />
            <line x1="16" y1="14" x2="16" y2="28" stroke="#FFD900" strokeWidth="2" />
            <line x1="20" y1="14" x2="20" y2="28" stroke="#FFD900" strokeWidth="2" />
            <line x1="24" y1="14" x2="24" y2="28" stroke="#FFD900" strokeWidth="2" />
            <circle cx="20" cy="8" r="3" fill="#F000A8" />
          </svg>
        </div>
      );
    case "avatar_7":
      // Phoenix Finisher
      return (
        <div className={`${sizeCls} rounded-full bg-[#FF5500] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <circle cx="20" cy="20" r="17" fill="#FF5500" stroke="#111" strokeWidth="3" />
            <path d="M20 6C20 6 25 14 21 20C25 18 29 23 27 28C25 32 15 32 13 28C11 23 15 18 19 20C15 14 20 6 20 6Z" fill="#FFD900" stroke="#111" strokeWidth="2" />
            <path d="M20 16C20 16 22 19 21 22C23 21 25 23 24 26C23 28 17 28 16 26C15 23 17 21 19 22C17 19 20 16 20 16Z" fill="#F000A8" />
          </svg>
        </div>
      );
    case "avatar_8":
      // Crown Champion
      return (
        <div className={`${sizeCls} rounded-full bg-[#FFD900] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <circle cx="20" cy="20" r="17" fill="#6500C8" stroke="#111" strokeWidth="3" />
            <path d="M10 24L12 14L16 19L20 11L24 19L28 14L30 24H10Z" fill="#FFD900" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="1.5" fill="#F000A8" />
            <circle cx="20" cy="10" r="2" fill="#F000A8" />
            <circle cx="28" cy="13" r="1.5" fill="#F000A8" />
            <rect x="10" y="24" width="20" height="4" fill="#9BE52E" stroke="#111" strokeWidth="1.5" />
          </svg>
        </div>
      );
    case "avatar_1":
    default:
      // Cyber Striker
      return (
        <div className={`${sizeCls} rounded-full bg-[#6500C8] border-2 border-black flex items-center justify-center p-1 overflow-hidden shadow-[2px_2px_0px_#000] ${className}`}>
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
            <circle cx="20" cy="20" r="17" fill="#6500C8" stroke="#111" strokeWidth="3" />
            <path d="M10 24C10 15 15 9 20 9C25 9 30 15 30 24V28C30 30 27 32 20 32C13 32 10 30 10 28V24Z" fill="#111" />
            <rect x="12" y="17" width="16" height="6" rx="3" fill="#FFD900" stroke="#111" strokeWidth="1.5" />
            <path d="M20 9V14" stroke="#F000A8" strokeWidth="3" strokeLinecap="round" />
            <circle cx="20" cy="7" r="2" fill="#9BE52E" />
          </svg>
        </div>
      );
  }
};
