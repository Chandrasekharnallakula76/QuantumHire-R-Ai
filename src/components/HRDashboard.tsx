import { useState } from "react"
import {
  Send,
  Mail,
  User,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Link,
  Copy,
} from "lucide-react"
import { getApiHeaders, getApiUrl } from "@/lib/api"

interface Props {
  onInterviewSent: () => void
}

export function HRDashboard({ onInterviewSent }: Props) {
  const [candidateEmail, setCandidateEmail] = useState("")
  const [candidateName, setCandidateName] = useState("")
  const [role, setRole] = useState("General")
  const [jobDescription, setJobDescription] = useState("")
  const [resumeText, setResumeText] = useState("")
  const [timeMinutes, setTimeMinutes] = useState(30)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [selectedRounds, setSelectedRounds] = useState<string[]>([
    "psychometrics",
    "softskills",
    "resume",
    "jd",
  ])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{
    ok: boolean
    msg: string
    interviewId?: string
    link?: string
    otp?: string
  } | null>(null)
  const [sentList, setSentList] = useState<
    { name: string; email: string; time: string; id: string; link: string }[]
  >([])
  const [copiedId, setCopiedId] = useState("")

  const toggleRound = (r: string) => {
    setSelectedRounds((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    )
  }

  const handleSend = async () => {
    if (!candidateEmail || !candidateName) return
    setSending(true)
    setResult(null)

    try {
      const res = await fetch(getApiUrl("/api/create-interview"), {
        method: "POST",
        headers: getApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          role,
          job_description: jobDescription,
          resume_text: resumeText,
          time_minutes: timeMinutes,
          webhook_url: webhookUrl,
          rounds: selectedRounds,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({
          ok: true,
          msg: data.message || "Interview created!",
          interviewId: data.interview_id,
          link: data.interview_link,
          otp: data.otp_code,
        })
        setSentList((prev) => [
          {
            name: candidateName,
            email: candidateEmail,
            time: new Date().toLocaleTimeString(),
            id: data.interview_id,
            link: data.interview_link,
          },
          ...prev,
        ])
        onInterviewSent()
      } else {
        setResult({
          ok: false,
          msg: data.detail || "Failed to create interview",
        })
      }
    } catch (e: any) {
      setResult({
        ok: false,
        msg: "Network error: " + (e.message || "Cannot reach server"),
      })
    } finally {
      setSending(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(""), 2000)
  }

  const ROLES = [
    "General",
    "Sales",
    "Project Management",
    "Marketing",
    "Web Design",
    "Computer Science and Engineering",
    "Consulting",
    "Customer Success",
    "Finance",
    "Administration",
    "Data Science",
    "DevOps",
    "Full Stack Developer",
    "Machine Learning Engineer",
    "Product Manager",
  ]

  const ROUNDS = [
    {
      key: "psychometrics",
      label: "Psychometrics",
      desc: "OCEAN + 16PF personality traits",
      activeClass: "bg-sky-50 border-sky-200",
      iconClass: "border-sky-500 bg-sky-500",
    },
    {
      key: "softskills",
      label: "Soft Skills",
      desc: "Scenario-based MCQs",
      activeClass: "bg-blue-50 border-blue-200",
      iconClass: "border-blue-500 bg-blue-500",
    },
    {
      key: "resume",
      label: "Resume Review",
      desc: "AI-generated from resume",
      activeClass: "bg-cyan-50 border-cyan-200",
      iconClass: "border-cyan-500 bg-cyan-500",
    },
    {
      key: "jd",
      label: "Technical / JD",
      desc: "AI-generated from job description",
      activeClass: "bg-indigo-50 border-indigo-200",
      iconClass: "border-indigo-500 bg-indigo-500",
    },
  ]

  const TIME_OPTIONS = [15, 20, 30, 45, 60]

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#eff6ff_0%,_#f8fbff_42%,_#ffffff_100%)] text-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-sky-100 bg-white/92 px-4 py-3 shadow-[0_1px_8px_rgba(15,23,42,0.04)] backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 items-center rounded-xl border border-sky-100 bg-sky-50/70 px-3">
            <img
              src="/logo-light.png"
              alt="CognitiveScreen AI"
              className="h-7 w-auto object-contain"
            />
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-1.5 text-xs text-slate-600 sm:flex">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          System Online
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:p-6">
          <div className="w-full max-w-2xl flex-1">
            <div className="rounded-3xl border border-sky-100 bg-white/95 p-5 shadow-[0_24px_80px_rgba(59,130,246,0.12)] sm:p-6 lg:p-8">
              <div className="mb-6 flex items-start gap-3 sm:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-100">
                  <Send className="size-5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Create Interview
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Configure AI interview with JD, resume, rounds and timing
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                      Candidate Name
                    </label>
                    <div className="relative">
                      <User className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="e.g. Manideep Kumar"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 transition-all outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                      Candidate Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                        placeholder="candidate@example.com"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 transition-all outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                      Interview Role
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 transition-all outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                      Interview Duration
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {TIME_OPTIONS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeMinutes(t)}
                          className={`rounded-lg border py-2.5 text-xs font-bold transition-all ${
                            timeMinutes === t
                              ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-700"
                          }`}
                        >
                          {t}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                    Interview Rounds
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ROUNDS.map((r) => (
                      <button
                        key={r.key}
                        onClick={() => toggleRound(r.key)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                          selectedRounds.includes(r.key)
                            ? `${r.activeClass} shadow-sm`
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selectedRounds.includes(r.key)
                              ? r.iconClass
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {selectedRounds.includes(r.key) && (
                            <CheckCircle className="size-3 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {r.label}
                          </p>
                          <p className="text-[10px] text-slate-500">{r.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedRounds.includes("jd") && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                      <FileText className="mr-1 inline size-3" />
                      Job Description
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the job description here... AI will generate technical questions from this."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 transition-all outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>
                )}

                {selectedRounds.includes("resume") && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                      <FileText className="mr-1 inline size-3" />
                      Resume Text
                    </label>
                    <textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste the candidate's resume text here... AI will generate probing questions from this."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 transition-all outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                    <Link className="mr-1 inline size-3" />
                    Webhook URL (optional)
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-app.com/api/interview-results"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800 transition-all outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                  <p className="mt-1 text-[9px] text-slate-500">
                    Results will be posted to this URL when the interview
                    completes
                  </p>
                </div>

                <button
                  onClick={handleSend}
                  disabled={
                    sending ||
                    !candidateEmail ||
                    !candidateName ||
                    selectedRounds.length === 0
                  }
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:from-sky-700 hover:to-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  {sending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating Interview...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Create Interview
                    </>
                  )}
                </button>

                {result && (
                  <div
                    className={`flex flex-col gap-3 rounded-xl border p-4 text-xs ${
                      result.ok
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50 text-red-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {result.ok ? (
                        <CheckCircle className="size-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="size-4" />
                      )}
                      <span className={result.ok ? "text-emerald-700" : ""}>
                        {result.msg}
                      </span>
                    </div>

                    {result.ok && result.interviewId && (
                      <>
                        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="text-[9px] tracking-wider text-slate-500 uppercase">
                              Interview ID
                            </span>
                            <p className="font-mono text-sm font-bold text-sky-700">
                              {result.interviewId}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                result.interviewId!,
                                "id-" + result.interviewId
                              )
                            }
                            className="self-end rounded-lg p-1.5 transition-colors hover:bg-slate-100 sm:self-auto"
                          >
                            {copiedId === "id-" + result.interviewId ? (
                              <CheckCircle className="size-4 text-emerald-600" />
                            ) : (
                              <Copy className="size-4 text-slate-500" />
                            )}
                          </button>
                        </div>

                        {result.otp && (
                          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <span className="text-[9px] tracking-wider text-slate-500 uppercase">
                                OTP Code
                              </span>
                              <p className="font-mono text-lg font-bold tracking-widest text-emerald-600">
                                {result.otp}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  result.otp!,
                                  "otp-" + result.otp
                                )
                              }
                              className="self-end rounded-lg p-1.5 transition-colors hover:bg-slate-100 sm:self-auto"
                            >
                              {copiedId === "otp-" + result.otp ? (
                                <CheckCircle className="size-4 text-emerald-600" />
                              ) : (
                                <Copy className="size-4 text-slate-500" />
                              )}
                            </button>
                          </div>
                        )}

                        {result.link && (
                          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] tracking-wider text-slate-500 uppercase">
                                Interview Link
                              </span>
                              <p className="font-mono text-[10px] break-all text-sky-700 sm:truncate">
                                {result.link}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  result.link!,
                                  "link-" + result.interviewId
                                )
                              }
                              className="self-end rounded-lg p-1.5 transition-colors hover:bg-slate-100 sm:ml-2 sm:self-auto"
                            >
                              {copiedId === "link-" + result.interviewId ? (
                                <CheckCircle className="size-4 text-emerald-600" />
                              ) : (
                                <Copy className="size-4 text-slate-500" />
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 self-start lg:sticky lg:top-24 lg:w-80">
            <div className="rounded-3xl border border-sky-100 bg-white/95 p-5 shadow-[0_24px_60px_rgba(148,163,184,0.12)] sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Mail className="size-4 text-sky-600" />
                Created Interviews
              </h3>
              {sentList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <Mail className="mx-auto mb-2 size-8 opacity-30" />
                  No interviews created yet
                </div>
              ) : (
                <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
                  {sentList.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-semibold text-slate-800">
                          {s.name}
                        </p>
                        <span className="text-[10px] text-slate-500">
                          {s.time}
                        </span>
                      </div>
                      <p className="mb-2 text-[10px] break-all text-slate-500">
                        {s.email}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-mono text-[9px] break-all text-sky-700">
                          ID: {s.id}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(s.link, "hist-" + s.id)
                          }
                          className="flex items-center gap-1 self-start text-[9px] text-sky-600 hover:text-sky-700"
                        >
                          {copiedId === "hist-" + s.id ? (
                            <>
                              <CheckCircle className="size-3" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" /> Copy Link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1.5 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 text-[11px] leading-5 text-slate-600">
              <p>
                <strong className="text-slate-800">How it works:</strong>
              </p>
              <p>1. Fill in candidate details, JD, resume</p>
              <p>2. Select interview rounds and duration</p>
              <p>3. Click Create Interview → get link + OTP</p>
              <p>4. Send link and OTP to candidate via your mailing system</p>
              <p>5. Candidate consents → authenticates → takes interview</p>
              <p>6. Results are sent to your webhook URL automatically</p>
              <p>7. Or fetch results via GET /api/get-results/&#123;id&#125;</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
