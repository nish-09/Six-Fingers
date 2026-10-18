import React, { useState } from "react";
import { X, Sparkles, Check, Video, Eye, ShieldAlert } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import {
  WebcamEffectId,
  EFFECT_CATEGORIES,
} from "@/lib/webcamEffects";

interface WebcamEffectsModalProps {
  currentEffect: WebcamEffectId;
  onSelectEffect: (effectId: WebcamEffectId) => void;
  onClose: () => void;
}

export const WebcamEffectsModal: React.FC<WebcamEffectsModalProps> = ({
  currentEffect,
  onSelectEffect,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>("face");

  const handleSelect = (id: WebcamEffectId) => {
    soundEngine.playClick();
    onSelectEffect(id);
  };

  const currentCat = EFFECT_CATEGORIES.find((c) => c.id === activeCategory) || EFFECT_CATEGORIES[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-[#16161F] border-4 border-[#111111] max-w-2xl w-full p-5 sm:p-6 my-auto shadow-[8px_8px_0px_#000] relative max-h-[85vh] overflow-y-auto text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-[#2A2A38] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD900] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-display text-[#FFD900] uppercase tracking-wide">
                WEBCAM EFFECTS & FILTERS
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Streamed in real-time to opponent via WebRTC · Hand tracking isolated
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg border-2 border-white/20 hover:bg-white/10 text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
          {EFFECT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                soundEngine.playClick();
                setActiveCategory(cat.id);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide border-2 transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-[#6500C8] border-white text-white shadow-[2px_2px_0px_#000]"
                  : "bg-[#20202C] border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {cat.name}
            </button>
          ))}
          <button
            onClick={() => handleSelect("none")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide border-2 transition-all ml-auto ${
              currentEffect === "none"
                ? "bg-[#E50020] border-white text-white"
                : "bg-[#2A2A38] border-transparent text-gray-300 hover:bg-[#353545]"
            }`}
          >
            🚫 Disable All
          </button>
        </div>

        {/* Effects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {currentCat.effects.map((fx) => {
            const isSelected = currentEffect === fx.id;
            return (
              <div
                key={fx.id}
                onClick={() => handleSelect(fx.id)}
                className={`p-3 rounded-xl border-3 cursor-pointer transition-all relative select-none ${
                  isSelected
                    ? "bg-[#252538] border-[#FFD900] shadow-[4px_4px_0px_#FFD900] translate-x-[-1px] translate-y-[-1px]"
                    : "bg-[#1E1E2A] border-[#2E2E40] hover:border-gray-400 hover:bg-[#252535]"
                }`}
              >
                {fx.badge && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#F000A8] text-white border border-black shadow-[1px_1px_0px_#000]">
                    {fx.badge}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{fx.icon}</span>
                  <div className="pr-12">
                    <h4 className="font-display font-black text-sm uppercase text-white flex items-center gap-1.5">
                      {fx.name}
                      {isSelected && <Check className="w-4 h-4 text-[#9BE52E]" />}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{fx.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notice */}
        <div className="bg-[#1C1C26] border-2 border-white/10 rounded-xl p-3 flex items-start gap-3">
          <Eye className="w-4 h-4 text-[#9BE52E] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-white">Computer Vision Guarantee:</strong> Decorative filters only apply to your display video output and opponent's WebRTC screen. Raw video frames continue feeding into MediaPipe AI without interference so your hand cricket gestures register instantly.
          </p>
        </div>
      </div>
    </div>
  );
};
