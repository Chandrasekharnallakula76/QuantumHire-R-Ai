import { useState } from "react"
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Loader2,
  Mic,
  Monitor,
  ShieldCheck,
} from "lucide-react"
import { getApiHeaders, getApiUrl } from "@/lib/api"

interface Props {
  interviewId: string
  candidateEmail: string
  candidateName: string
  role: string
  onConsentGiven: () => void
}

export function ConsentScreen({
  interviewId,
  candidateEmail,
  candidateName,
  role,
  onConsentGiven,
}: Props) {
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const consentIntro = `I, ${candidateName}, consent to participate in this AI-powered interview for the ${role} role. I understand and agree that:`
  const consentPoints = [
    "My webcam and microphone will be used during the interview for biometric analysis.",
    "My responses will be evaluated using AI-based scoring systems.",
    "Interview data may be collected, processed, and shared with the hiring organization.",
    "I am voluntarily participating and can exit the interview at any time.",
  ]
  const consentText = `${consentIntro}\n\n${consentPoints.map((point) => `- ${point}`).join("\n")}`

  const handleSubmit = async () => {
    if (!agreed) return

    setSubmitting(true)
    setError("")

    try {
      const res = await fetch(getApiUrl("/api/consent"), {
        method: "POST",
        headers: getApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          interview_id: interviewId,
          candidate_email: candidateEmail,
          consent_given: true,
          consent_text: consentText,
        }),
      })

      if (res.ok) {
        onConsentGiven()
      } else {
        const data = await res.json()
        setError(data.detail || "Failed to record consent")
      }
    } catch {
      if (!interviewId) onConsentGiven()
      else setError("Cannot reach server")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-4 text-slate-800">
      <div className="absolute inset-x-0 top-0 h-11 bg-gradient-to-b from-[#1d4ed8] to-[#2563eb]" />
      <div className="absolute inset-x-0 top-11 h-4 bg-[#dbeafe]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#ffffff_42%,#eaf3ff_100%)]" />

      <div className="relative w-full max-w-2xl">
        <div className="rounded-[26px] border border-blue-100 bg-white/95 p-5 shadow-[0_22px_55px_rgba(37,99,235,0.14)] backdrop-blur md:p-6">
          <div className="mb-3 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50">
              <ShieldCheck className="size-5 text-blue-600" />
            </div>
          </div>

          <h2 className="text-center text-xl font-bold text-slate-800">
            Interview Consent Required
          </h2>

          <p className="mx-auto mt-1 mb-4 max-w-lg text-center text-xs text-slate-500">
            Please review and accept the terms before starting your interview.
          </p>

          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-800">
                {candidateName}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {candidateEmail}
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-blue-200 bg-white px-3 py-1 text-[10px] font-bold text-blue-700">
              {role}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <InfoItem
              icon={<Camera className="size-4 text-blue-500" />}
              text="Webcam"
            />
            <InfoItem
              icon={<Mic className="size-4 text-emerald-500" />}
              text="Microphone"
            />
            <InfoItem
              icon={<Monitor className="size-4 text-blue-600" />}
              text="AI Analysis"
            />
          </div>

          <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-4">
            <p className="text-[11px] leading-6 text-slate-600">
              {consentIntro}
            </p>

            <ul className="mt-3 space-y-2 text-[11px] leading-6 text-slate-600">
              {consentPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="mt-[2px] text-slate-400">-</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-white p-3 shadow-[0_4px_14px_rgba(37,99,235,0.06)]">
            <button
              type="button"
              onClick={() => setAgreed((prev) => !prev)}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                agreed
                  ? "border-[#1d5bd8] bg-[#1d5bd8]"
                  : "border-slate-300 bg-white"
              }`}
            >
              {agreed && <CheckCircle className="size-3.5 text-white" />}
            </button>

            <span className="text-[11px] leading-6 text-slate-600">
              I have read and understood the above terms. I voluntarily consent
              to participate in this AI-powered interview and agree to the
              collection and processing of my data as described.
            </span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={!agreed || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d5bd8] py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-[#194fc0] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Recording Consent...
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />I Agree - Continue to
                Interview
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-[10px] text-slate-500">
          Your consent is recorded securely | CognitiveScreen AI v3.0
        </p>
      </div>
    </div>
  )
}

function InfoItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-2 py-2.5 shadow-[0_4px_12px_rgba(37,99,235,0.05)]">
      {icon}
      <span className="text-[10px] font-semibold text-slate-600">{text}</span>
    </div>
  )
}
