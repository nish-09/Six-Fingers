import React, { useState, useEffect } from "react";
import { X, Mic, Volume2, Check, RefreshCw, Radio, Headphones } from "lucide-react";
import { soundEngine } from "@/lib/sound";
import {
  VoicePresetId,
  VOICE_PRESETS,
  globalAudioEffects,
} from "@/lib/audioEffects";

interface VoiceEffectsModalProps {
  currentPreset: VoicePresetId;
  onSelectPreset: (presetId: VoicePresetId) => void;
  onClose: () => void;
}

export const VoiceEffectsModal: React.FC<VoiceEffectsModalProps> = ({
  currentPreset,
  onSelectPreset,
  onClose,
}) => {
  const [intensity, setIntensity] = useState<number>(globalAudioEffects.getIntensity());
  const [isMonitoring, setIsMonitoring] = useState<boolean>(globalAudioEffects.getMonitoring());
  const [micLevel, setMicLevel] = useState<number>(0);

  // Poll mic volume meter
  useEffect(() => {
    const interval = setInterval(() => {
      setMicLevel(globalAudioEffects.getMicLevel());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = (id: VoicePresetId) => {
    soundEngine.playClick();
    globalAudioEffects.setPreset(id);
    onSelectPreset(id);
  };

  const handleIntensityChange = (val: number) => {
    setIntensity(val);
    globalAudioEffects.setIntensity(val);
  };

  const toggleMonitoring = () => {
    soundEngine.playClick();
    const next = !isMonitoring;
    setIsMonitoring(next);
    globalAudioEffects.setMonitoring(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-sm">
      <div className="bg-[#16161F] border-4 border-[#111111] max-w-2xl w-full p-5 sm:p-6 my-auto shadow-[8px_8px_0px_#000] relative max-h-[85vh] overflow-y-auto text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-[#2A2A38] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F000A8] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-display text-[#F000A8] uppercase tracking-wide">
                VOICE EFFECTS & DSP
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Real-time Web Audio pipeline · Modulates voice transmitted over WebRTC
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

        {/* Live Controls: Monitor & Volume Meter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 bg-[#1E1E2A] p-3 rounded-xl border-2 border-white/10">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold uppercase text-gray-300 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#9BE52E]" /> MIC INPUT LEVEL
              </span>
              <span className="font-mono text-[#9BE52E] font-bold">{micLevel}%</span>
            </div>
            <div className="w-full bg-[#111111] h-3 rounded-full overflow-hidden border border-white/20">
              <div
                className="h-full bg-gradient-to-r from-[#9BE52E] via-[#FFD900] to-[#E50020] transition-all duration-75"
                style={{ width: `${micLevel}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <button
              onClick={toggleMonitoring}
              className={`px-3 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 border-2 transition-all ${
                isMonitoring
                  ? "bg-[#6500C8] border-[#FFD900] text-white shadow-[2px_2px_0px_#000]"
                  : "bg-[#252535] border-white/20 text-gray-300 hover:bg-[#303045]"
              }`}
            >
              <Headphones className="w-4 h-4" />
              {isMonitoring ? "Mute Local Preview" : "Preview Voice (Headphones)"}
            </button>
          </div>
        </div>

        {/* Intensity Slider */}
        <div className="mb-4 bg-[#1C1C26] p-3 rounded-xl border-2 border-white/10">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase text-gray-300">EFFECT INTENSITY / DEPTH</span>
            <span className="font-mono text-[#FFD900] font-black">{Math.round(intensity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={intensity}
            onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
            className="w-full accent-[#FFD900] h-2 bg-black rounded-lg cursor-pointer"
          />
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
          {VOICE_PRESETS.map((p) => {
            const isSelected = currentPreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className={`p-3 rounded-xl border-3 cursor-pointer transition-all relative select-none ${
                  isSelected
                    ? "bg-[#2A1E38] border-[#F000A8] shadow-[4px_4px_0px_#F000A8] translate-x-[-1px] translate-y-[-1px]"
                    : "bg-[#1E1E2A] border-[#2E2E40] hover:border-gray-400 hover:bg-[#252535]"
                }`}
              >
                {p.badge && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#FFD900] text-black border border-black shadow-[1px_1px_0px_#000]">
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{p.icon}</span>
                  <div className="pr-12">
                    <h4 className="font-display font-black text-sm uppercase text-white flex items-center gap-1.5">
                      {p.name}
                      {isSelected && <Check className="w-4 h-4 text-[#9BE52E]" />}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex justify-between items-center pt-2 border-t-2 border-white/10">
          <button
            onClick={() => handleSelect("normal")}
            className="px-4 py-2 rounded-xl font-black text-xs uppercase bg-[#20202C] hover:bg-[#2E2E40] border-2 border-white/20 text-gray-300 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset to Natural Voice
          </button>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="px-6 py-2 rounded-xl font-black text-xs uppercase bg-[#9BE52E] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#86CB24] transition-all"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
