import { useState, useRef, useEffect } from "react"
import { ShieldCheck, Loader2, AlertCircle, KeyRound, Mail } from "lucide-react"
import { getApiHeaders, getApiUrl } from "@/lib/api"

interface Props {
  onVerified: (sessionData: any) => void
}

export function OTPVerification({ onVerified }: Props) {
  const hashQuery = window.location.hash.split("?")[1] || ""
  const params = new URLSearchParams(hashQuery)
  const emailFromUrl = params.get("email") || ""
  const nameFromUrl = params.get("name") || "Candidate"
  const roleFromUrl = params.get("role") || "General"
  const interviewIdFromUrl = params.get("interview_id") || ""

  const [email, setEmail] = useState(emailFromUrl)
  const [candidateName] = useState(nameFromUrl)
  const [candidateRole] = useState(roleFromUrl)
  const [interviewId] = useState(interviewIdFromUrl)
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState("")
  const [requestingOtp, setRequestingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(!!emailFromUrl)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (otpSent && inputRefs.current[0]) {
      inputRefs.current[0]?.focus()
    }
  }, [otpSent])

  const handleOtpChange = (idx: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[idx] = value.slice(-1)
    setOtp(newOtp)
    if (value && idx < 5) {
      inputRefs.current[idx + 1]?.focus()
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (!verifying && otp.join("").length === 6) {
        verifyOTP()
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(""))
      inputRefs.current[5]?.focus()
    }
  }

  const requestOTP = async () => {
    if (!email) return
    setRequestingOtp(true)
    setError("")
    try {
      const res = await fetch(getApiUrl("/api/send-interview"), {
        method: "POST",
        headers: getApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          candidate_email: email,
          candidate_name: "Candidate",
          role: "General",
          interview_url: window.location.href,
        }),
      })
      if (res.ok) {
        setOtpSent(true)
      } else {
        const data = await res.json()
        setError(data.detail || "Failed to send OTP")
      }
    } catch {
      setError("Cannot reach server")
    } finally {
      setRequestingOtp(false)
    }
  }

  const verifyOTP = async () => {
    const otpStr = otp.join("")
    if (otpStr.length !== 6) {
      setError("Please enter the complete 6-digit OTP")
      return
    }

    // FIX 1: Validate interview_id before sending request
    if (!interviewId || interviewId.trim() === "") {
      setError("Interview ID is missing. Please use the link sent by HR.")
      return
    }

    setVerifying(true)
    setError("")
    try {
      const res = await fetch(getApiUrl("/api/verify-otp"), {
        method: "POST",
        headers: getApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          email,
          otp: otpStr,
          candidate_name: candidateName,
          role: candidateRole,
          interview_id: interviewId,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onVerified(data)
      } else {
        setError(data.detail || "Verification failed")
        setOtp(["", "", "", "", "", ""])
        inputRefs.current[0]?.focus()
      }
    } catch {
      setError("Cannot reach server")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 text-slate-900">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <img
            src="/logo-light.png"
            alt="QuantumHire Interview Verification Portal"
            className="h-14 w-auto object-contain"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
              <ShieldCheck className="size-7 text-emerald-500" />
            </div>
          </div>

          <h2 className="mb-1 text-center text-lg font-bold text-black">
            {otpSent ? "Enter Verification Code" : "Request OTP"}
          </h2>
          <p className="mb-6 text-center text-xs text-slate-500">
            {otpSent
              ? `A 6-digit code was sent to ${email}`
              : "Enter your email to receive the OTP"}
          </p>

          {/* Interview ID badge if present */}
          {interviewId && (
            <div className="mb-4 flex items-center justify-center">
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 font-mono text-[9px] text-indigo-400">
                Interview: {interviewId}
              </span>
            </div>
          )}

          {!otpSent ? (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !requestingOtp && email) {
                      e.preventDefault()
                      requestOTP()
                    }
                  }}
                  placeholder="your.email@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-10 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={requestOTP}
                disabled={requestingOtp || !email}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 disabled:bg-slate-800"
              >
                {requestingOtp ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                {requestingOtp ? "Sending..." : "Send OTP"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex justify-center gap-3" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`h-14 w-12 rounded-xl border-2 bg-slate-50 text-center font-mono text-xl font-bold transition-all outline-none ${
                      digit
                        ? "border-emerald-500 text-emerald-600"
                        : "border-slate-200 text-slate-700 focus:border-emerald-500"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={verifyOTP}
                disabled={verifying || otp.join("").length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
              >
                {verifying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" /> Verify & Continue
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setOtpSent(false)
                  setOtp(["", "", "", "", "", ""])
                  setError("")
                }}
                className="text-center text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                Didn't receive the code? Try again
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-600">
          Secured with end-to-end encryption • CognitiveScreen AI v3.0
        </p>
      </div>
    </div>
  )
}
