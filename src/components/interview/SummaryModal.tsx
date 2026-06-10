import { Brain, CheckCircle, XCircle, Heart, Activity, Eye, Trophy, BarChart3 } from "lucide-react"
import { Button } from "../ui/button"

interface FinalResult {
  total_score: number
  out_of: number
  pass_mark: number
  result: "SELECTED" | "NOT SELECTED"
  breakdown: { excel_mcq: number; ocean_personality: number; pf16_personality: number }
  answered: number
  total_questions: number
  vitals_report?: any
}

interface SummaryModalProps {
  notesText: string
  candidateName: string
  role: string
  finalResult: FinalResult | null
  heartRate: number
  stressLevel: number
  attentionScore: number
  onRestart: () => void
  onClose: () => void
}

export function SummaryModal({
  notesText, candidateName, role, finalResult,
  heartRate, stressLevel, attentionScore,
  onRestart, onClose,
}: SummaryModalProps) {
  const score = finalResult?.total_score ?? 0
  const outOf = finalResult?.out_of ?? 20
  const passMark = finalResult?.pass_mark ?? 15
  const result = finalResult?.result ?? "NOT SELECTED"
  const breakdown = finalResult?.breakdown
  const isSelected = result === "SELECTED"
  const pct = Math.round((score / outOf) * 100)

  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Brain className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Interview Complete</h2>
              <p className="text-xs text-slate-600">CognitiveScreen AI — Final Assessment Report</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 border text-xs font-bold ${
            isSelected
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              : "bg-red-500/10 border-red-500/20 text-red-500"
          }`}>
            {isSelected ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
            {result}
          </div>
        </div>

        {/* Candidate + Score hero */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Candidate</p>
            <h3 className="text-base font-bold text-slate-800">{candidateName}</h3>
            <p className="text-xs text-slate-500">{role}</p>
          </div>

          {/* Score ring */}
          <div className="flex flex-col items-center">
            <div className={`relative flex h-24 w-24 items-center justify-center rounded-full border-4 ${
              isSelected ? "border-emerald-500" : "border-red-500"
            }`}>
              <div className="text-center">
                <p className={`text-2xl font-black ${isSelected ? "text-emerald-500" : "text-red-500"}`}>{score}</p>
                <p className="text-[9px] text-slate-500 font-bold">/ {outOf}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 font-semibold">{pct}% • Pass: {passMark}+</p>
          </div>
        </div>

        {/* Score breakdown */}
        {breakdown && (
          <div className="rounded-2xl border border-slate-200 p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="size-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Score Breakdown</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { label: "Excel MCQ (10 questions)", value: breakdown.excel_mcq, max: 10, color: "bg-indigo-500" },
                { label: "OCEAN Personality (5 questions)", value: breakdown.ocean_personality, max: 5, color: "bg-emerald-500" },
                { label: "16PF Behavioral (5 questions)", value: breakdown.pf16_personality, max: 5, color: "bg-amber-500" },
              ].map(({ label, value, max, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                    <span>{label}</span>
                    <span className="font-bold text-slate-700">{value.toFixed(1)} / {max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vitals summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 p-3 bg-white flex flex-col">
            <div className="flex items-center gap-1.5 text-red-500 mb-1">
              <Heart className="size-3.5 fill-red-500/10" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Avg Pulse</span>
            </div>
            <span className="font-mono text-lg font-extrabold text-slate-800">
              {heartRate > 0 ? heartRate : "—"} <span className="text-[10px] font-normal text-slate-500">BPM</span>
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 bg-white flex flex-col">
            <div className="flex items-center gap-1.5 text-amber-500 mb-1">
              <Activity className="size-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Stress</span>
            </div>
            <span className="font-mono text-lg font-extrabold text-slate-800">
              {stressLevel > 0 ? `${stressLevel}%` : "—"}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 bg-white flex flex-col">
            <div className="flex items-center gap-1.5 text-indigo-500 mb-1">
              <Eye className="size-3.5" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Focus</span>
            </div>
            <span className="font-mono text-lg font-extrabold text-slate-800">
              {attentionScore > 0 ? `${attentionScore}%` : "—"}
            </span>
          </div>
        </div>

        {/* Notes */}
        {notesText && (
          <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Session Notes</span>
            <p className="text-xs text-slate-700 leading-relaxed mt-1 italic whitespace-pre-wrap">"{notesText}"</p>
          </div>
        )}

        {/* Result banner */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${
          isSelected
            ? "bg-emerald-500/10 border border-emerald-500/20"
            : "bg-red-500/10 border border-red-500/20"
        }`}>
          <Trophy className={`size-6 shrink-0 ${isSelected ? "text-emerald-500" : "text-red-500"}`} />
          <div>
            <p className={`text-sm font-bold ${isSelected ? "text-emerald-500" : "text-red-500"}`}>
              {isSelected ? "🎉 Congratulations! You are SELECTED." : "Thank you for your time. Result: NOT SELECTED."}
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Score: {score}/{outOf} — Pass mark is {passMark}/{outOf}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Button
            variant="outline"
            onClick={onRestart}
            className="h-10 px-4 border-slate-200 font-semibold text-slate-700"
          >
            Back to HR Dashboard
          </Button>
          <Button
            onClick={onClose}
            className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow"
          >
            Close
          </Button>
        </div>

      </div>
    </div>
  )
}

export default SummaryModal
