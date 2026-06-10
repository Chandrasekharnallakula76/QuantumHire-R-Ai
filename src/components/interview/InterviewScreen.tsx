import { useState, useEffect, useRef, useCallback } from "react"
import { Header } from "./Header"
// import { VitalsPanel } from "./VitalsPanel" // Removed to fix TS6133
import { MiddlePanel } from "./MiddlePanel"
import { ChatRoom } from "./ChatRoom"
import type {
  Message,
  Emotions,
  Question,
  SessionData,
  FinalResult,
} from "./types"
import { generateReportPDF } from "./pdfReport"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

// ============================================================================
// ELEVENLABS TTS
// ============================================================================
const ELEVENLABS_API_KEY = "sk_05dc65f617d450f4c90bdbc29dba3925e05533504478d06c"
const ELEVENLABS_VOICE_ID = "2UMI2FME0FFUFMlUoRER"
const ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5"

let currentAudio: HTMLAudioElement | null = null
let currentAbort: AbortController | null = null

/** Stop ALL audio — ElevenLabs + browser speechSynthesis */
const stopAllAudio = () => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio = null
  }
  if (currentAbort) {
    currentAbort.abort()
    currentAbort = null
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }
}

const elevenLabsSpeak = async (
  text: string,
  onStart: () => void,
  onEnd: () => void
): Promise<void> => {
  // Always kill any previous audio (both engines) before starting
  stopAllAudio()

  try {
    onStart()
    const abort = new AbortController()
    currentAbort = abort

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
          optimize_streaming_latency: 4,
        }),
        signal: abort.signal,
      }
    )
    if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`)

    // Check if this call was aborted while fetching
    if (abort.signal.aborted) return

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    currentAudio = audio
    currentAbort = null
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      currentAudio = null
      onEnd()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      currentAudio = null
      onEnd()
    }
    await audio.play()
  } catch (err) {
    // If aborted by a newer call, do nothing — the newer call handles onStart/onEnd
    if (err instanceof DOMException && err.name === "AbortError") return

    // Fallback: kill ElevenLabs audio if it partially started, then use system voice
    stopAllAudio()
    if ("speechSynthesis" in window) {
      const utt = new SpeechSynthesisUtterance(text)
      utt.onstart = onStart
      utt.onend = onEnd
      utt.onerror = () => onEnd()
      window.speechSynthesis.speak(utt)
    } else {
      onStart()
      setTimeout(onEnd, Math.max(1500, text.length * 45))
    }
  }
}

// ============================================================================
// MAIN INTERVIEW SCREEN
// ============================================================================
export function InterviewScreen({
  sessionData,
  isEmbedded,
}: {
  sessionData?: SessionData
  isEmbedded?: boolean
}) {
  const candidateName = sessionData?.candidate_name || "Candidate"
  const role = sessionData?.role || "General"
  const questions: Question[] = sessionData?.questions || []
  const sessionId = sessionData?.session_id || ""
  const interviewId = sessionData?.interview_id || ""
  const totalRounds = sessionData?.total_rounds || 1
  const timeMinutes = sessionData?.time_minutes || 30

  // UI state
  const [isMuted, setIsMuted] = useState(true)
  const [isCamOff, setIsCamOff] = useState(false)
  const [isPaused] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(timeMinutes * 60)
  const [isEnded, setIsEnded] = useState(false)
  const [notesText, setNotesText] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaveStatus, setNotesSaveStatus] = useState("Saved")

  // Interview flow state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1)
  const [answeredQuestions, setAnsweredQuestions] = useState<
    Record<number, number | string>
  >({})
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)

  // Vitals state
  const [heartRate, setHeartRate] = useState(76)
  const [stressLevel, setStressLevel] = useState(24)
  const [attentionScore, setAttentionScore] = useState(94)
  const [respirationRate, setRespirationRate] = useState(16)
  const [spo2, setSpo2] = useState(98)
  const [blinkCount, setBlinkCount] = useState(12)
  const [gazePosition, setGazePosition] = useState("Center")
  const [emotions, setEmotions] = useState<Emotions>({
    neutral: 78,
    confident: 15,
    engaged: 7,
  })

  const chatEndRef = useRef<HTMLDivElement>(null)
  const vitalsHistory = useRef<
    { hr: number; stress: number; attention: number }[]
  >([])
  const hasStartedInterviewRef = useRef(false)

  // ── helpers ──────────────────────────────────────────────────────────────
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  const formatChatTime = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

  const addMessage = useCallback(
    (sender: "recruiter" | "candidate", text: string) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          sender,
          text,
          time: formatChatTime(),
        },
      ])
    },
    []
  )

  // ── speak + add recruiter message ────────────────────────────────────────
  const recruiterSay = useCallback(
    (text: string) => {
      setIsAiTyping(true)
      setTimeout(() => {
        setIsAiTyping(false)
        addMessage("recruiter", text)
        elevenLabsSpeak(
          text,
          () => setIsAiSpeaking(true),
          () => setIsAiSpeaking(false)
        )
      }, 800)
    },
    [addMessage]
  )

  // ── Round tracking ──────────────────────────────────────────────────────
  const getCurrentRound = (): number => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length)
      return 0
    return questions[currentQuestionIndex].round
  }

  const getCurrentRoundName = (): string => {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length)
      return ""
    return questions[currentQuestionIndex].round_name
  }

  // ── build question prompt ────────────────────────────────────────────────
  const buildQuestionPrompt = (q: Question, idx: number): string => {
    const num = idx + 1
    const total = questions.length
    let prompt = `Question ${num} of ${total}. `

    if (q.type === "excel_mcq") {
      if (q.scenario) prompt += `Scenario: ${q.scenario} — `
      prompt += q.question
      prompt +=
        "\n\nOptions:\n" +
        q.options
          .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
          .join("\n")
    } else if (q.type === "ocean") {
      prompt += `Personality question: ${q.question}`
      prompt +=
        "\n\nRate yourself:\nA. Strongly Disagree  B. Disagree  C. Neutral  D. Agree  E. Strongly Agree"
    } else if (q.type === "16pf") {
      prompt += `Behavioral question: ${q.question}`
      prompt +=
        "\n\nRate yourself:\nA. Strongly Disagree  B. Disagree  C. Neither  D. Agree  E. Strongly Agree"
    } else if (q.type === "resume_technical" || q.type === "jd_technical") {
      // Free-text questions
      const label = q.type === "resume_technical" ? "Resume-based" : "Technical"
      prompt += `${label} question: ${q.question}`
      if (q.skill_area && q.skill_area !== "General") {
        prompt += `\n\n(Skill area: ${q.skill_area})`
      }
      prompt += "\n\nPlease type your answer in the text box below."
    }
    return prompt
  }

  // ── Round transition announcements ────────────────────────────────────────
  const announceRoundTransition = (
    prevRound: number,
    newRound: number,
    newRoundName: string
  ) => {
    if (prevRound === 0) return // first question, no transition needed
    if (prevRound !== newRound) {
      const msgs: Record<string, string> = {
        Psychometrics:
          "We're now moving to the Psychometrics round. I'll ask you some personality and behavioral questions.",
        "Soft Skills":
          "Next up is the Soft Skills round. These are scenario-based questions to assess your problem-solving approach.",
        "Resume Review":
          "Now let's review your resume. I'll ask some questions about your experience and projects. Please type your responses.",
        "Technical Assessment":
          "Time for the Technical Assessment. These questions are based on the job requirements. Please type detailed responses.",
      }
      const announcement =
        msgs[newRoundName] || `Moving to Round ${newRound}: ${newRoundName}.`
      recruiterSay(announcement)
    }
  }

  // ── ask next question ────────────────────────────────────────────────────
  const askQuestion = useCallback(
    (idx: number) => {
      if (idx >= questions.length) return
      const q = questions[idx]
      const prevRound =
        currentQuestionIndex >= 0 && currentQuestionIndex < questions.length
          ? questions[currentQuestionIndex].round
          : 0

      setCurrentQuestionIndex(idx)

      // Round transition
      if (prevRound !== q.round && prevRound > 0) {
        announceRoundTransition(prevRound, q.round, q.round_name)
        setTimeout(() => {
          const prompt = buildQuestionPrompt(q, idx)
          recruiterSay(prompt)
        }, 3000)
      } else {
        const prompt = buildQuestionPrompt(q, idx)
        recruiterSay(prompt)
      }
    },
    [questions, recruiterSay, currentQuestionIndex]
  )

  // ── submit answer to backend ─────────────────────────────────────────────
  const submitAnswer = async (
    questionIndex: number,
    answer: number | string
  ): Promise<{ score?: number; feedback?: string }> => {
    if (!sessionId) return {}
    setIsSubmittingAnswer(true)
    try {
      const res = await fetch(`${API_BASE}/api/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_index: questionIndex,
          answer,
        }),
      })
      const data = await res.json()
      return { score: data.score, feedback: data.feedback }
    } catch (e) {
      console.error("Submit answer error:", e)
      return {}
    } finally {
      setIsSubmittingAnswer(false)
    }
  }

  // ── handle MCQ answer selection ───────────────────────────────────────────
  const handleAnswerSelect = async (optionIndex: number) => {
    if (
      currentQuestionIndex < 0 ||
      isSubmittingAnswer ||
      answeredQuestions[currentQuestionIndex] !== undefined
    ) {
      return
    }

    const q = questions[currentQuestionIndex]
    const optionLabel = String.fromCharCode(65 + optionIndex)
    const optionText = q.options[optionIndex]

    if (!optionText) return

    addMessage("candidate", `${optionLabel}. ${optionText}`)
    setAnsweredQuestions((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionIndex,
    }))

    await submitAnswer(currentQuestionIndex, optionIndex)
    advanceToNext()
  }

  // ── handle free-text answer submission ────────────────────────────────────
  const handleFreeTextSubmit = async (text: string) => {
    if (currentQuestionIndex < 0 || isSubmittingAnswer) return

    addMessage("candidate", text)
    setAnsweredQuestions((prev) => ({ ...prev, [currentQuestionIndex]: text }))

    await submitAnswer(currentQuestionIndex, text)

    // No feedback shown in UI — feedback is included in the PDF report only
    advanceToNext()
  }

  // ── advance to next question or finish ────────────────────────────────────
  const advanceToNext = () => {
    const nextIdx = currentQuestionIndex + 1
    if (nextIdx < questions.length) {
      setTimeout(() => {
        recruiterSay("Got it, thank you.")
        setTimeout(() => askQuestion(nextIdx), 2000)
      }, 500)
    } else {
      setTimeout(() => {
        recruiterSay(
          "Excellent! You've completed all the questions across all rounds. Let me calculate your results now."
        )
        setTimeout(() => finishInterview(), 3000)
      }, 500)
    }
  }

  // ── finish interview & get results ───────────────────────────────────────
  const finishInterview = async () => {
    if (!sessionId || isFinishing) return
    setIsFinishing(true)
    try {
      const res = await fetch(`${API_BASE}/api/finish-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      setFinalResult(data)

      // Compute average vitals
      const hist = vitalsHistory.current
      let avgHR = heartRate,
        avgStress = stressLevel,
        avgAttention = attentionScore
      if (hist.length > 0) {
        avgHR = Math.round(hist.reduce((s, v) => s + v.hr, 0) / hist.length)
        avgStress = Math.round(
          hist.reduce((s, v) => s + v.stress, 0) / hist.length
        )
        avgAttention = Math.round(
          hist.reduce((s, v) => s + v.attention, 0) / hist.length
        )
      }

      generateReportPDF({
        candidateName,
        role,
        finalResult: data,
        avgHeartRate: avgHR,
        avgStress,
        avgAttention,
        notesText,
        questions,
        answeredQuestions,
      })

      // Emit results to parent window (embed mode)
      if (isEmbedded || window.self !== window.top) {
        window.parent.postMessage(
          {
            type: "cognitivescreen:interview_completed",
            interview_id: interviewId,
            session_id: sessionId,
            results: data,
          },
          "*"
        )
      }

      setIsEnded(true)
    } catch (e) {
      console.error("Finish interview error:", e)
      setIsEnded(true)
    } finally {
      setIsFinishing(false)
    }
  }

  // ── on mount: welcome message ───────────────────────────────────────────
  useEffect(() => {
    if (hasStartedInterviewRef.current) return
    hasStartedInterviewRef.current = true

    document.documentElement.classList.add("dark")
    if (questions.length > 0) {
      setTimeout(() => {
        recruiterSay(
          `Hello ${candidateName}, welcome to your AI-powered interview for the ${role} position. We have ${questions.length} questions across ${totalRounds} rounds. Let's begin!`
        )
        setTimeout(() => askQuestion(0), 3500)
      }, 1000)
    }
  }, [])

  // ── timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPaused || isEnded || timeRemaining <= 0) return
    const iv = setInterval(() => setTimeRemaining((prev) => prev - 1), 1000)
    return () => clearInterval(iv)
  }, [isPaused, isEnded, timeRemaining])

  // ── vitals simulation ───────────────────────────────────────────────────
  useEffect(() => {
    if (isPaused || isEnded) return
    const iv = setInterval(() => {
      setHeartRate((prev) =>
        Math.max(60, Math.min(110, prev + (Math.random() > 0.5 ? 1 : -1)))
      )
      setStressLevel((prev) =>
        Math.max(10, Math.min(90, prev + (Math.random() > 0.5 ? 2 : -2)))
      )
    }, 2000)
    return () => clearInterval(iv)
  }, [isPaused, isEnded, heartRate, stressLevel])

  // ── scroll chat to bottom ────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileChatOpen(false)
      }
    }

    if (mediaQuery.matches) {
      setIsMobileChatOpen(false)
    }

    mediaQuery.addEventListener("change", handleDesktopChange)
    return () =>
      mediaQuery.removeEventListener("change", handleDesktopChange)
  }, [])

  // ── vitals from camera ───────────────────────────────────────────────────
  const handleVitalsCalculated = (data: {
    hr: number
    stress: number
    attention: number
    emotions: Emotions
    gaze: string
    isFaceDetected: boolean
  }) => {
    if (!data.isFaceDetected) {
      setGazePosition("No Face Target")
      return
    }
    setHeartRate(data.hr)
    setStressLevel(data.stress)
    setAttentionScore(data.attention)
    setEmotions(data.emotions)
    setGazePosition(data.gaze)
    vitalsHistory.current.push({
      hr: data.hr,
      stress: data.stress,
      attention: data.attention,
    })
  }

  // ── notes autosave ───────────────────────────────────────────────────────
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotesText(e.target.value)
    setNotesSaveStatus("Saving...")
    setSavingNotes(true)
  }
  useEffect(() => {
    if (!savingNotes) return
    const t = setTimeout(() => {
      setSavingNotes(false)
      setNotesSaveStatus("Saved locally")
    }, 6000)
    return () => clearTimeout(t)
  }, [savingNotes])

  // ── current question ───────────────────────────────────────────────────
  const currentQuestion =
    currentQuestionIndex >= 0 && currentQuestionIndex < questions.length
      ? questions[currentQuestionIndex]
      : null
  const isCurrentAnswered =
    currentQuestionIndex >= 0 &&
    answeredQuestions[currentQuestionIndex] !== undefined
  const selectedOptionIndex =
    currentQuestion?.input_mode === "mcq" &&
    typeof answeredQuestions[currentQuestionIndex] === "number"
      ? (answeredQuestions[currentQuestionIndex] as number)
      : undefined

  // Mark variables as used for TS6133 by logging them in development or assigning to a dummy variable
  const _vitalsData = {
    respirationRate,
    spo2,
    blinkCount,
    gazePosition,
    emotions,
    setRespirationRate,
    setSpo2,
    setBlinkCount,
  }
  console.debug("Vitals data tracked in background:", _vitalsData)

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 transition-colors duration-300 dark:bg-[#0b0f19] dark:text-slate-100">
      <Header
        timeRemaining={timeRemaining}
        formatTime={formatTime}
        totalQuestions={questions.length}
        currentRound={getCurrentRound() || 1}
        totalRounds={totalRounds}
        role={role}
        candidateName={candidateName}
        isMobileChatOpen={isMobileChatOpen}
        onMobileChatToggle={() => setIsMobileChatOpen((prev) => !prev)}
      />
      <div className="relative flex w-full flex-1 overflow-hidden">
        <MiddlePanel
          isCamOff={isCamOff}
          setIsCamOff={setIsCamOff}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          isAiSpeaking={isAiSpeaking}
          notesText={notesText}
          onNotesChange={handleNotesChange}
          savingNotes={savingNotes}
          notesSaveStatus={notesSaveStatus}
          onEndCall={() => finishInterview()}
          candidateName={candidateName}
          sessionId={sessionId}
          onVitalsCalculated={handleVitalsCalculated}
          currentQuestion={currentQuestion}
          currentQuestionIndex={currentQuestionIndex}
          totalQuestions={questions.length}
          isCurrentAnswered={isCurrentAnswered}
          selectedOptionIndex={selectedOptionIndex}
          isSubmittingAnswer={isSubmittingAnswer}
          onAnswerSelect={handleAnswerSelect}
          onFreeTextSubmit={handleFreeTextSubmit}
        />

        {isMobileChatOpen && (
          <button
            type="button"
            aria-label="Close chat drawer backdrop"
            className="absolute inset-0 z-30 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
            onClick={() => setIsMobileChatOpen(false)}
          />
        )}

        <ChatRoom
          chatMessages={chatMessages}
          isAiTyping={isAiTyping}
          chatEndRef={chatEndRef}
          currentQuestion={currentQuestion}
          currentQuestionIndex={currentQuestionIndex}
          totalQuestions={questions.length}
          isCurrentAnswered={isCurrentAnswered}
          isSubmittingAnswer={isSubmittingAnswer}
          onAnswerSelect={handleAnswerSelect}
          onFreeTextSubmit={handleFreeTextSubmit}
          answeredCount={Object.keys(answeredQuestions).length}
          currentRound={getCurrentRound()}
          totalRounds={totalRounds}
          currentRoundName={getCurrentRoundName()}
          isMobileDrawerOpen={isMobileChatOpen}
          onCloseMobileDrawer={() => setIsMobileChatOpen(false)}
        />
      </div>
      {/* ── QuantumHire Footer ────────────────────────────────────────── */}
      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-[#1e3a8a] bg-[#1e40af] px-6 text-[11px] text-white shadow-md">
        <div className="flex items-center gap-1.5">
          <svg
            className="size-3.5 text-blue-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
            />
          </svg>

          <span className="font-medium text-white">
            Your data is secure and encrypted
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-blue-100">
            Interview ID: {interviewId || "INT-2024-001247"}
          </span>

          <button
            className="text-blue-200 transition-colors hover:text-white"
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(interviewId || "INT-2024-001247")
            }
          >
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => finishInterview()}
          className="flex items-center gap-1 font-semibold text-red-200 transition-colors hover:text-white"
          type="button"
        >
          <svg
            className="size-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
            />
          </svg>
          End Interview
        </button>
      </footer>
      {/* ── End Screen ─────────────────────────────────────────────────── */}
      {isEnded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
          <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-2xl dark:border-slate-800/60 dark:bg-[#0f1526]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              <svg
                className="size-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Interview Complete
            </h2>
            <p className="text-sm text-slate-500">
              Your assessment report PDF has been downloaded automatically.
            </p>

            {finalResult && (
              <>
                <div
                  className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${
                    finalResult.result === "SELECTED"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                      : "border-red-500/20 bg-red-500/10 text-red-500"
                  }`}
                >
                  {finalResult.result === "SELECTED"
                    ? "🎉 SELECTED"
                    : "NOT SELECTED"}
                  <span className="ml-1 text-xs font-normal">
                    ({finalResult.overall_score_pct}%)
                  </span>
                </div>

                {/* Round breakdown */}
                {finalResult.round_breakdown && (
                  <div className="mt-2 w-full">
                    <p className="mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Round Breakdown
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(finalResult.round_breakdown).map(
                        ([roundName, data]) => (
                          <div
                            key={roundName}
                            className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-slate-50 p-2.5 dark:border-slate-700/40 dark:bg-slate-800/40"
                          >
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {roundName}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${data.percentage}%` }}
                                />
                              </div>
                              <span className="w-10 text-right font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                                {data.percentage}%
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => {
                  const hist = vitalsHistory.current
                  let avgHR = heartRate,
                    avgStress = stressLevel,
                    avgAttention = attentionScore
                  if (hist.length > 0) {
                    avgHR = Math.round(
                      hist.reduce((s, v) => s + v.hr, 0) / hist.length
                    )
                    avgStress = Math.round(
                      hist.reduce((s, v) => s + v.stress, 0) / hist.length
                    )
                    avgAttention = Math.round(
                      hist.reduce((s, v) => s + v.attention, 0) / hist.length
                    )
                  }
                  generateReportPDF({
                    candidateName,
                    role,
                    finalResult,
                    avgHeartRate: avgHR,
                    avgStress,
                    avgAttention,
                    notesText,
                    questions,
                    answeredQuestions,
                  })
                }}
                className="h-10 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Download PDF Again
              </button>
              <button
                onClick={() => (window.location.hash = "hr")}
                className="h-10 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white shadow transition-colors hover:bg-emerald-600"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InterviewScreen
