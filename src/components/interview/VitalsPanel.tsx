import { Heart, Activity, Eye } from "lucide-react"
import type { Emotions } from "./types"

interface VitalsPanelProps {
  heartRate: number
  stressLevel: number
  attentionScore: number
  respirationRate: number
  spo2: number
  blinkCount: number
  gazePosition: string
  waveformBars: number[]
  emotions: Emotions
  isPaused: boolean
  isMuted: boolean
}

export function VitalsPanel({
  heartRate,
  stressLevel,
  attentionScore,
  respirationRate,
  spo2,
  blinkCount,
  gazePosition,
  waveformBars,
  emotions,
  isPaused,
  isMuted
}: VitalsPanelProps) {
  return (
    <aside className="w-80 border-r border-slate-200 bg-white/50 p-4 dark:border-slate-800/80 dark:bg-[#0f1322]/40 overflow-y-auto shrink-0 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800/5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Live Vitals Scan</h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider">ACTIVE HUD</span>
        </div>
      </div>

      {/* Core Scanner Diagnostic Panel */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm dark:border-slate-800/40 dark:bg-[#141b2e]/60 flex flex-col gap-3 relative overflow-hidden group min-h-[160px]">
        <div className="absolute top-0 right-0 p-1 text-[9px] font-mono text-slate-400 select-none">SCAN_LN04</div>
        
        {/* Heart Rate Metric */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Heart Rate</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-3xl font-extrabold text-red-500 transition-all tracking-tighter">
                {heartRate}
              </span>
              <span className="text-xs font-bold text-slate-400">BPM</span>
            </div>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
            <Heart className="size-5 fill-red-500/30 animate-heartbeat" />
          </div>
        </div>

        {/* ECG Waveform */}
        <div className="mt-1 h-12 w-full bg-slate-900 rounded-lg border border-slate-800/80 p-1 flex items-center justify-between overflow-hidden relative">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:10px_100%]"></div>
          <svg className="w-full h-full text-emerald-500 stroke-2 fill-none drop-shadow-[0_0_3px_rgba(16,185,129,0.7)]" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d={`M 0 15 
              Q 10 15 20 15 
              T 25 15 
              Q 27 5 29 25 
              T 32 15 
              Q 38 15 45 15 
              T 50 15 
              Q 52 -1 54 28 
              T 57 15 
              Q 65 15 75 15 
              T 80 15 
              Q 82 8 84 20 
              T 87 15 
              L 100 15`} 
              strokeDasharray="200" 
              strokeDashoffset={isPaused ? "0" : (Date.now() / 25) % 200}
              className="transition-all duration-300"
            />
          </svg>
        </div>
        
        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
          <span>ECG LEAD III: LIVE</span>
          <span>DEV: 0.14s</span>
        </div>
      </div>

      {/* Stress Metric */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm dark:border-slate-800/40 dark:bg-[#141b2e]/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Stress Index</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            stressLevel < 28 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
          }`}>
            {stressLevel}% - {stressLevel < 28 ? 'Optimal (Calm)' : 'Mild Reactivity'}
          </span>
        </div>
        
        <div className="relative h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, stressLevel))}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-medium">
          <span>20% (CALM)</span>
          <span>50% (ALERT)</span>
          <span>80% (STRESSED)</span>
        </div>
      </div>

      {/* Attention & Gaze Metric */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm dark:border-slate-800/40 dark:bg-[#141b2e]/60 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Attention Focus</span>
            <span className="font-mono text-xl font-extrabold text-indigo-500 mt-0.5">{attentionScore}%</span>
          </div>

          <div className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 overflow-hidden">
            <div className="absolute inset-1 rounded-full border border-indigo-500/20 border-dashed animate-gaze-spin"></div>
            <Eye className="size-5 absolute z-10" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800/40 text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Eye Gaze Lock:</span>
            <span className="font-semibold text-indigo-400">{gazePosition}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Blinks Count:</span>
            <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">{blinkCount} / min</span>
          </div>
        </div>
      </div>

      {/* Respiration & SpO2 double metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm dark:border-slate-800/40 dark:bg-[#141b2e]/60 flex flex-col">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Respiration</span>
          <span className="font-mono text-lg font-bold text-cyan-500 mt-0.5">{respirationRate} <span className="text-[10px] text-slate-400 font-normal">RPM</span></span>
          
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden dark:bg-slate-800">
            <div 
              className="h-full bg-cyan-400 rounded-full transition-all duration-1000 ease-in-out" 
              style={{ width: `${Math.max(0, Math.min(100, (respirationRate - 12) * 15))}%` }}
            ></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm dark:border-slate-800/40 dark:bg-[#141b2e]/60 flex flex-col">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">SpO2 Oxygen</span>
          <span className="font-mono text-lg font-bold text-teal-400 mt-0.5">{spo2}% <span className="text-[10px] text-slate-400 font-normal">O2</span></span>
          
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden dark:bg-slate-800">
            <div 
              className="h-full bg-teal-400 rounded-full transition-all duration-500" 
              style={{ width: `${Math.max(0, Math.min(100, spo2))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Micro-Metrics (Emotional Composure Breakdown) */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm dark:border-slate-800/40 dark:bg-[#141b2e]/60 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Emotional Composure</span>
        
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex flex-col">
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-slate-600 dark:text-slate-400">Neutral Stability</span>
              <span className="font-semibold">{emotions.neutral}%</span>
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-full dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${emotions.neutral}%` }}></div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-slate-600 dark:text-slate-400">Confidence Index</span>
              <span className="font-semibold text-amber-500">{emotions.confident}%</span>
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-full dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${emotions.confident}%` }}></div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-slate-600 dark:text-slate-400">Interactivity / Gaze Engagement</span>
              <span className="font-semibold text-indigo-400">{emotions.engaged}%</span>
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-full dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${emotions.engaged}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Acoustic Stress Waveform */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm dark:border-slate-800/40 dark:bg-[#141b2e]/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Acoustic / Speech Stress</span>
          <span className="text-[9px] font-semibold text-emerald-400">LOW</span>
        </div>
        
        <div className="flex h-8 items-end gap-1 px-1 bg-slate-950/65 rounded-lg border border-slate-900 justify-between overflow-hidden py-1">
          {waveformBars.map((val, idx) => (
            <div 
              key={idx} 
              className="w-1.5 bg-emerald-500 rounded-full transition-all duration-300"
              style={{ 
                height: `${val}%`,
                opacity: isMuted ? 0.1 : 0.75 + (idx % 3) * 0.1 
              }}
            ></div>
          ))}
        </div>
      </div>
    </aside>
  )
}
export default VitalsPanel