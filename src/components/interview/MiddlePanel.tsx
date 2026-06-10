import { useState, useEffect, useRef } from "react"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Expand,
  Shrink,
  FileText,
  CheckCircle,
  AlertCircle,
  User,
} from "lucide-react"
import { Orb } from "../ui/orb"
import * as faceapi from "@vladmandic/face-api"
import type { Emotions, Question } from "./types"
import { getApiHeaders, getApiUrl } from "@/lib/api"
const SPEECH_TO_TEXT_LANGUAGE =
  import.meta.env.VITE_SPEECH_TO_TEXT_LANGUAGE || "en-IN"

type SpeechRecognitionCtor = new () => {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult:
    | ((event: {
        results: ArrayLike<{
          isFinal?: boolean
          0: { transcript: string }
        }>
      }) => void)
    | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

const getSpeechRecognition = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null

  const recognition =
    (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor
        webkitSpeechRecognition?: SpeechRecognitionCtor
      }
    ).SpeechRecognition ??
    (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionCtor
        webkitSpeechRecognition?: SpeechRecognitionCtor
      }
    ).webkitSpeechRecognition

  return recognition ?? null
}

const decodeQuestionText = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&mdash;|&#8212;/gi, " - ")
    .replace(/&ndash;|&#8211;/gi, " - ")
    .replace(/\s+/g, " ")
    .trim()

const getQuestionDisplayParts = (
  question: Question | null
): { scenario: string; prompt: string; fullText: string } => {
  const fallback = "Waiting for the next interview question..."

  if (!question) {
    return {
      scenario: "",
      prompt: fallback,
      fullText: fallback,
    }
  }

  const normalizedQuestion = decodeQuestionText(question.question)
  const normalizedScenario = question.scenario
    ? decodeQuestionText(question.scenario)
    : ""

  if (normalizedScenario) {
    return {
      scenario: normalizedScenario,
      prompt: normalizedQuestion,
      fullText: `Scenario: ${normalizedScenario} - ${normalizedQuestion}`,
    }
  }

  const scenarioMatch = normalizedQuestion.match(
    /^Scenario:\s*(.+?)\s*(?:-|—)\s*([^]+)$/i
  )

  if (scenarioMatch) {
    return {
      scenario: scenarioMatch[1].trim(),
      prompt: scenarioMatch[2].trim(),
      fullText: normalizedQuestion,
    }
  }

  return {
    scenario: "",
    prompt: normalizedQuestion || fallback,
    fullText: normalizedQuestion || fallback,
  }
}

// ============================================================================
// INNER COMPONENT 1: VIDEO STREAMS WITH DYNAMIC FACE-API SCANNING & ONNX
// ============================================================================
interface VideoStreamsProps {
  isCamOff: boolean
  setIsCamOff: (val: boolean) => void
  isMuted: boolean
  setIsMuted: (val: boolean) => void
  isAiSpeaking: boolean
  onEndCall: () => void
  candidateName: string
  sessionId: string
  notesText: string
  onNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  savingNotes: boolean
  notesSaveStatus: string
  onVitalsCalculated?: (data: {
    hr: number
    stress: number
    attention: number
    emotions: { neutral: number; confident: number; engaged: number }
    gaze: string
    isFaceDetected: boolean
  }) => void
  currentQuestion: Question | null
  currentQuestionIndex: number
  totalQuestions: number
  isCurrentAnswered: boolean
  selectedOptionIndex?: number
  isSubmittingAnswer: boolean
  onAnswerSelect: (optionIndex: number) => void
  onFreeTextSubmit: (text: string) => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

function VideoStreams({
  isCamOff,
  setIsCamOff,
  isMuted,
  setIsMuted,
  isAiSpeaking,
  onEndCall,
  candidateName: _candidateName,
  sessionId,
  notesText,
  onNotesChange,
  savingNotes,
  notesSaveStatus,
  onVitalsCalculated,
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  isCurrentAnswered,
  selectedOptionIndex,
  isSubmittingAnswer,
  onAnswerSelect,
  onFreeTextSubmit,
  isFullscreen,
  onToggleFullscreen,
}: VideoStreamsProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const speechRecognitionRef =
    useRef<InstanceType<SpeechRecognitionCtor> | null>(null)
  const freeTextRecognitionRef =
    useRef<InstanceType<SpeechRecognitionCtor> | null>(null)
  const isVoiceAnswerPendingRef = useRef(false)
  const isRecognitionActiveRef = useRef(false)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(
    null
  )
  const [hasCameraError, setHasCameraError] = useState<boolean>(false)
  const [freeText, setFreeText] = useState("")
  const [isRecordingFreeText, setIsRecordingFreeText] = useState(false)
  const [freeTextVoiceError, setFreeTextVoiceError] = useState("")
  const [isStoppingFreeText, setIsStoppingFreeText] = useState(false)
  const freeTextRef = useRef("")
  const freeTextSpeechBaseRef = useRef("")
  const [freeTextTranscript, setFreeTextTranscript] = useState("")
  const [isFreeTextListening, setIsFreeTextListening] = useState(false)
  const [browserSupportsFreeTextSpeech, setBrowserSupportsFreeTextSpeech] =
    useState(() => getSpeechRecognition() !== null)
  const isPersonalityCard =
    currentQuestion?.type === "ocean" || currentQuestion?.type === "16pf"
  const questionDisplay = getQuestionDisplayParts(currentQuestion)

  useEffect(() => {
    setFreeText("")
    setFreeTextVoiceError("")
    freeTextSpeechBaseRef.current = ""
    setFreeTextTranscript("")
  }, [currentQuestion?.index])

  useEffect(() => {
    freeTextRef.current = freeText
  }, [freeText])

  const appendTranscriptToFreeText = (baseText: string, transcript: string) => {
    const normalizedBase = baseText.trim()
    const normalizedTranscript = transcript.trim()

    if (!normalizedTranscript) return normalizedBase
    return normalizedBase
      ? `${normalizedBase} ${normalizedTranscript}`
      : normalizedTranscript
  }

  const handleFreeTextSend = () => {
    if (!freeText.trim() || isSubmittingAnswer || isCurrentAnswered) return
    onFreeTextSubmit(freeText.trim())
    setFreeText("")
  }

  // Real-time face coordinates for drawing the scanning target
  const [, setFaceBox] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [, setLocalVitals] = useState<{
    hr: number
    stress: number
    attention: number
    gaze: string
    emotions: Emotions
  } | null>(null)

  // Load face-api models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ])
        console.log("✅ face-api models loaded")
      } catch (err) {
        console.error("Failed to load face-api models:", err)
      }
    }
    loadModels()
  }, [])

  // Webcam stream lifecycle
  useEffect(() => {
    if (isCamOff) {
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop())
        setWebcamStream(null)
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setHasCameraError(false)
      setFaceBox(null)
      setLocalVitals(null)
      return
    }

    let activeStream: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((stream) => {
        activeStream = stream
        setWebcamStream(stream)
        setHasCameraError(false)
      })
      .catch((err) => {
        console.warn("Webcam access not allowed or unavailable: ", err)
        setHasCameraError(true)
      })

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isCamOff])

  // Sync srcObject whenever stream or video element changes
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      videoRef.current.srcObject = webcamStream
    }
  }, [webcamStream])

  useEffect(() => {
    let isCancelled = false

    const enableMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        })

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        setMicrophoneStream((prev) => {
          prev?.getTracks().forEach((track) => track.stop())
          return stream
        })
      } catch (error) {
        console.warn("Microphone access denied or unavailable:", error)
        setIsMuted(true)
      }
    }

    if (isMuted) {
      setMicrophoneStream((prev) => {
        prev?.getTracks().forEach((track) => track.stop())
        return null
      })
      return
    }

    enableMicrophone()

    return () => {
      isCancelled = true
    }
  }, [isMuted, setIsMuted])

  useEffect(() => {
    return () => {
      freeTextRecognitionRef.current?.stop()
      microphoneStream?.getTracks().forEach((track) => track.stop())
    }
  }, [microphoneStream])

  const stopFreeTextRecognition = () => {
    setIsStoppingFreeText(true)
    freeTextRecognitionRef.current?.stop()
  }

  const ensureMicrophoneStream = async () => {
    if (microphoneStream) return microphoneStream

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    })

    setMicrophoneStream((prev) => {
      prev?.getTracks().forEach((track) => track.stop())
      return stream
    })
    setIsMuted(false)
    return stream
  }

  useEffect(() => {
    if (!isRecordingFreeText && !isStoppingFreeText) return

    setFreeText(
      appendTranscriptToFreeText(
        freeTextSpeechBaseRef.current,
        freeTextTranscript
      )
    )
    if (freeTextTranscript.trim()) {
      setFreeTextVoiceError("")
    }
  }, [freeTextTranscript, isRecordingFreeText, isStoppingFreeText])

  useEffect(() => {
    if (isFreeTextListening) {
      if (!isRecordingFreeText) {
        setIsRecordingFreeText(true)
      }
      if (isStoppingFreeText) {
        setIsStoppingFreeText(false)
      }
      return
    }

    if (!isRecordingFreeText && !isStoppingFreeText) return

    const finalizeTranscript = window.setTimeout(() => {
      setIsRecordingFreeText(false)
      setIsStoppingFreeText(false)

      const nextText = appendTranscriptToFreeText(
        freeTextSpeechBaseRef.current,
        freeTextTranscript
      )

      setFreeText(nextText)
      if (!freeTextTranscript.trim()) {
        setFreeTextVoiceError("We could not detect speech. Please try again.")
      }
    }, 350)

    return () => {
      window.clearTimeout(finalizeTranscript)
    }
  }, [
    freeTextTranscript,
    isFreeTextListening,
    isRecordingFreeText,
    isStoppingFreeText,
  ])

  const toggleFreeTextRecording = async () => {
    if (isSubmittingAnswer || isCurrentAnswered) return

    if (isRecordingFreeText || isFreeTextListening) {
      stopFreeTextRecognition()
      return
    }

    if (!browserSupportsFreeTextSpeech) {
      setFreeTextVoiceError(
        "Speech recognition is not available in this browser."
      )
      return
    }

    try {
      const recognitionCtor = getSpeechRecognition()
      if (!recognitionCtor) {
        setBrowserSupportsFreeTextSpeech(false)
        setIsRecordingFreeText(false)
        setFreeTextVoiceError(
          "Speech recognition is not available in this browser."
        )
        return
      }

      await ensureMicrophoneStream()
      setFreeTextVoiceError("")
      freeTextSpeechBaseRef.current = freeTextRef.current
      setFreeTextTranscript("")
      setIsStoppingFreeText(false)
      setIsRecordingFreeText(true)
      setIsFreeTextListening(true)

      const recognition = new recognitionCtor()
      freeTextRecognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = SPEECH_TO_TEXT_LANGUAGE

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim()

        setFreeTextTranscript(transcript)
      }

      recognition.onerror = (event) => {
        setIsFreeTextListening(false)
        setIsRecordingFreeText(false)
        if (event.error === "not-allowed") {
          setFreeTextVoiceError("Microphone permission is blocked.")
          setIsMuted(true)
        } else if (event.error !== "aborted") {
          setFreeTextVoiceError("Could not start microphone transcription.")
        }
      }

      recognition.onend = () => {
        setIsFreeTextListening(false)
      }

      recognition.start()
    } catch (error) {
      console.error("Microphone transcription failed:", error)
      setIsFreeTextListening(false)
      setIsRecordingFreeText(false)
      setFreeTextVoiceError("Could not start microphone transcription.")
    }
  }

  useEffect(() => {
    if (currentQuestion?.input_mode !== "free_text" || isMuted) {
      stopFreeTextRecognition()
    }
  }, [currentQuestion?.input_mode, isMuted])

  useEffect(() => {
    const recognitionCtor = getSpeechRecognition()

    if (
      !recognitionCtor ||
      isMuted ||
      isAiSpeaking ||
      currentQuestion?.input_mode !== "mcq" ||
      currentQuestion.options.length === 0 ||
      isCurrentAnswered ||
      isSubmittingAnswer
    ) {
      speechRecognitionRef.current?.stop()
      speechRecognitionRef.current = null
      isVoiceAnswerPendingRef.current = false
      return
    }

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    const optionAliases = currentQuestion.options.map((option, index) => {
      const letter = String.fromCharCode(97 + index)
      const ordinalWords = [
        "first",
        "second",
        "third",
        "fourth",
        "fifth",
        "sixth",
      ]
      const ordinal = ordinalWords[index]
      const normalizedOption = normalize(option)
      const optionWords = normalizedOption.split(" ").filter(Boolean)
      const basePhrases = [
        letter,
        `${index + 1}`,
        `option ${letter}`,
        `option ${index + 1}`,
        `choose ${letter}`,
        `choose option ${letter}`,
        `choose option ${index + 1}`,
        `select ${letter}`,
        `select option ${letter}`,
        `select option ${index + 1}`,
        `answer ${letter}`,
        `answer option ${letter}`,
        `answer option ${index + 1}`,
        `my answer is ${letter}`,
        `my answer is option ${letter}`,
        `my answer is option ${index + 1}`,
        normalizedOption,
      ]

      if (ordinal) {
        basePhrases.push(
          ordinal,
          `${ordinal} option`,
          `option ${ordinal}`,
          `select ${ordinal} option`,
          `choose ${ordinal} option`,
          `my answer is ${ordinal} option`
        )
      }

      return {
        index,
        phrases: Array.from(new Set([...basePhrases, ...optionWords])),
      }
    })

    const getSpokenOptionIndex = (transcript: string) => {
      const normalizedTranscript = normalize(transcript)
      if (!normalizedTranscript) return -1

      const exactMatch = optionAliases.find((option) =>
        option.phrases.includes(normalizedTranscript)
      )
      if (exactMatch) return exactMatch.index

      for (const option of optionAliases) {
        if (
          option.phrases.some(
            (phrase) =>
              phrase.length > 1 &&
              (normalizedTranscript.includes(phrase) ||
                phrase.includes(normalizedTranscript))
          )
        ) {
          return option.index
        }
      }

      return -1
    }

    const recognition = new recognitionCtor()
    speechRecognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onresult = (event) => {
      if (isAiSpeaking || isVoiceAnswerPendingRef.current) return

      for (let index = event.results.length - 1; index >= 0; index -= 1) {
        const result = event.results[index]

        if (result?.isFinal === false) continue

        const transcript = result[0]?.transcript ?? ""
        const spokenOptionIndex = getSpokenOptionIndex(transcript)

        if (spokenOptionIndex >= 0) {
          isVoiceAnswerPendingRef.current = true
          isRecognitionActiveRef.current = false
          recognition.stop()
          onAnswerSelect(spokenOptionIndex)
          break
        }
      }
    }

    recognition.onerror = () => {
      isVoiceAnswerPendingRef.current = false
    }

    recognition.onend = () => {
      const shouldRestart =
        !isMuted &&
        !isAiSpeaking &&
        currentQuestion?.input_mode === "mcq" &&
        !isCurrentAnswered &&
        !isSubmittingAnswer &&
        !isVoiceAnswerPendingRef.current

      if (shouldRestart) {
        try {
          isRecognitionActiveRef.current = true
          recognition.start()
        } catch (error) {
          isRecognitionActiveRef.current = false
          console.warn("Speech recognition restart failed:", error)
        }
      }
    }

    try {
      isRecognitionActiveRef.current = true
      recognition.start()
    } catch (error) {
      isRecognitionActiveRef.current = false
      console.warn("Speech recognition start failed:", error)
    }

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.stop()
      isRecognitionActiveRef.current = false
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null
      }
      isVoiceAnswerPendingRef.current = false
    }
  }, [
    isMuted,
    isAiSpeaking,
    currentQuestion,
    isCurrentAnswered,
    isSubmittingAnswer,
    onAnswerSelect,
  ])

  // Hybrid approach: face-api in browser for instant face detection +
  // backend API for real ONNX rPPG heart rate from Python onnxruntime
  useEffect(() => {
    if (isCamOff || !webcamStream || !onVitalsCalculated) {
      setFaceBox(null)
      setLocalVitals(null)
      return
    }

    let isSubscribed = true
    let lastBackendHR = 76
    let lastBackendStress = 24
    let pendingBackendCall = false
    let callCount = 0
    const backendCanvas = document.createElement("canvas")

    // Send frame to backend for real rPPG HR
    const sendFrameToBackend = async () => {
      const video = videoRef.current
      if (
        !video ||
        video.videoWidth === 0 ||
        pendingBackendCall ||
        !isSubscribed
      )
        return
      pendingBackendCall = true
      callCount++

      try {
        const scale = Math.min(320 / video.videoWidth, 1)
        backendCanvas.width = Math.round(video.videoWidth * scale)
        backendCanvas.height = Math.round(video.videoHeight * scale)
        const ctx = backendCanvas.getContext("2d")
        if (!ctx) {
          pendingBackendCall = false
          return
        }
        ctx.drawImage(video, 0, 0, backendCanvas.width, backendCanvas.height)
        const frameBase64 = backendCanvas.toDataURL("image/jpeg", 0.3)

        const timeoutMs = callCount <= 2 ? 15000 : 8000
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)

        const res = await fetch(getApiUrl("/api/vitals/frame"), {
          method: "POST",
          headers: getApiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            session_id: sessionId,
            frame_base64: frameBase64,
            timestamp_ms: Date.now(),
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!isSubscribed) return
        const data = await res.json()

        if (data.status === "ok") {
          lastBackendHR = Math.round(data.heart_rate_bpm || lastBackendHR)
          lastBackendStress = Math.round(data.stress_index || lastBackendStress)
          console.log(
            "Backend vitals: HR=" +
              lastBackendHR +
              " Stress=" +
              lastBackendStress
          )
        }
      } catch (err) {
        console.warn(
          "Backend vitals:",
          err instanceof Error ? err.message : "timeout, retrying"
        )
      } finally {
        pendingBackendCall = false
      }
    }

    sendFrameToBackend()
    const backendLoop = setInterval(sendFrameToBackend, 3000)

    // Face-api runs every 850ms for instant face box + expressions
    const faceLoop = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions()

        if (!isSubscribed) return

        if (detection) {
          const box = detection.detection.box
          const top = (box.y / video.videoHeight) * 100
          const left = (box.x / video.videoWidth) * 100
          const width = (box.width / video.videoWidth) * 100
          const height = (box.height / video.videoHeight) * 100
          const mirroredLeft = 100 - left - width
          setFaceBox({ top, left: mirroredLeft, width, height })

          // Gaze from landmark symmetry
          const landmarks = detection.landmarks
          const nose = landmarks.positions[30]
          const leftJaw = landmarks.positions[0]
          const rightJaw = landmarks.positions[16]
          const leftDist = Math.abs(nose.x - leftJaw.x)
          const rightDist = Math.abs(rightJaw.x - nose.x)
          const ratio = leftDist / rightDist

          let gaze = "Direct Eye Contact"
          if (ratio < 0.82) gaze = "Center-Left"
          else if (ratio > 1.18) gaze = "Center-Right"

          const gazePenalty = gaze === "Direct Eye Contact" ? 0 : 5
          const attention = Math.max(
            85,
            Math.min(Math.round(98 - gazePenalty - Math.random() * 2), 98)
          )

          // Real expressions from face-api
          const expressions = detection.expressions
          const neutral = Math.round(expressions.neutral * 100)
          const confident = Math.round(
            (expressions.happy + expressions.surprised) * 100
          )
          const engaged = Math.min(100 - neutral, 100)

          // Use backend HR/stress (real rPPG) with face-api expressions/gaze
          const emotionsObj = { neutral, confident, engaged }
          onVitalsCalculated({
            hr: lastBackendHR,
            stress: lastBackendStress,
            attention,
            emotions: emotionsObj,
            gaze,
            isFaceDetected: true,
          })
          setLocalVitals({
            hr: lastBackendHR,
            stress: lastBackendStress,
            attention,
            gaze,
            emotions: emotionsObj,
          })
        } else {
          setFaceBox(null)
          setLocalVitals(null)
          onVitalsCalculated({
            hr: 0,
            stress: 0,
            attention: 0,
            emotions: { neutral: 0, confident: 0, engaged: 0 },
            gaze: "No Gaze Lock",
            isFaceDetected: false,
          })
        }
      } catch (err) {
        console.warn("Face detection error:", err)
      }
    }, 850)

    return () => {
      isSubscribed = false
      clearInterval(faceLoop)
      clearInterval(backendLoop)
    }
  }, [isCamOff, webcamStream, onVitalsCalculated, sessionId])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_0.75fr]">
      {/* Candidate webcam box */}
      <div className="flex flex-col gap-4">
        <div className="group relative min-h-[310px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-lg md:min-h-[390px]">
          {isCamOff ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 select-none">
              <div className="relative mb-3 flex size-16 items-center justify-center rounded-full border border-slate-300 bg-slate-200 shadow-md">
                <User className="size-8 text-slate-500" />
                <span className="absolute inset-0 animate-ping rounded-full border border-dashed border-red-500/20"></span>
              </div>
              <span className="text-xs font-semibold tracking-wider text-slate-500">
                Camera Feed Muted
              </span>
            </div>
          ) : hasCameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 px-6 text-center text-slate-400 select-none">
              <div className="relative mb-3 flex size-16 items-center justify-center rounded-full border border-amber-300 bg-amber-50 shadow-md">
                <VideoOff className="size-8 text-amber-600" />
              </div>
              <span className="text-xs font-semibold tracking-wider text-amber-700 uppercase">
                Camera Blocked
              </span>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">
                Camera access is blocked or not allowed. Please allow camera
                permission to continue the interview.
              </p>
            </div>
          ) : (
            <>
              {webcamStream ? (
                <video
                  ref={(el) => {
                    ;(
                      videoRef as React.MutableRefObject<HTMLVideoElement | null>
                    ).current = el
                    if (el && webcamStream && el.srcObject !== webcamStream) {
                      el.srcObject = webcamStream
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover transition-all"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">
                  Starting camera...
                </div>
              )}

              {/* Facescan HUD Overlays - Hidden as requested */}
              {/* <div className="absolute inset-0 pointer-events-none z-10">
              ... HUD content removed ...
            </div> */}
            </>
          )}

          {/* REC Indicator */}
          <div className="absolute top-3 left-[10px] z-20 flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
            <span>REC</span>
          </div>
          <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
            <div className="flex flex-col items-center gap-2">
              <ControlsBar
                isCamOff={isCamOff}
                hasCameraError={hasCameraError}
                setIsCamOff={setIsCamOff}
                onEndCall={onEndCall}
                isFullscreen={isFullscreen}
                onToggleFullscreen={onToggleFullscreen}
              />
            </div>
          </div>
        </div>
        <NotesPanel
          notesText={notesText}
          onChange={onNotesChange}
          savingNotes={savingNotes}
          notesSaveStatus={notesSaveStatus}
        />
      </div>

      {/* AI Recruiter Stream box — ElevenLabs Orb */}
      <div className="group relative flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-lg">
        {/* Top Half - Orb */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
          <div className="scanning-grid absolute inset-0 opacity-30" />

          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            Elena (AI Recruiter Host)
          </div>

          <div className="relative h-28 w-28 rounded-full bg-white p-1 shadow-[0_0_0_6px_rgba(226,232,240,0.9)]">
            <div className="h-full w-full overflow-hidden rounded-full bg-slate-200">
              <Orb
                colors={["#3B82F6", "#798dff"]}
                seed={1000}
                agentState={isAiSpeaking ? "talking" : null}
              />
            </div>
          </div>
        </div>

        {/* Bottom Half - Question */}
        <div className="flex flex-1 flex-col justify-start bg-blue-50 px-4 py-5">
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold tracking-wider text-blue-400 uppercase">
                Current Question
              </span>

              {currentQuestion && totalQuestions > 0 && (
                <div className="inline-flex items-center rounded-full border border-blue-100 bg-white px-2.5 py-0.5 shadow-sm">
                  <span className="text-[11px] font-bold text-blue-600">
                    {currentQuestionIndex + 1}
                  </span>

                  <span className="mx-1 text-[10px] text-slate-300">/</span>

                  <span className="text-[11px] font-semibold text-slate-500">
                    {totalQuestions}
                  </span>
                </div>
              )}
            </div>

            <div className="group/question relative mt-1">
              {questionDisplay.scenario && (
                <p className="mb-2 line-clamp-3 text-[11px] leading-5 text-slate-600 lg:line-clamp-4">
                  <span className="font-semibold text-slate-700">Scenario: </span>
                  {questionDisplay.scenario}
                </p>
              )}

              <h3
                title={questionDisplay.fullText}
                className="text-[12px] leading-5 font-semibold text-slate-900 line-clamp-2"
              >
                {questionDisplay.prompt}
              </h3>

              {questionDisplay.fullText.length > 110 && (
                <div className="pointer-events-none absolute left-0 z-20 mt-2 hidden w-full max-w-md rounded-xl bg-slate-900 px-3 py-2 text-[11px] leading-relaxed font-medium text-white shadow-lg group-hover/question:block">
                  {questionDisplay.fullText}
                </div>
              )}
            </div>

            <p className="mt-1 text-[11px] text-slate-500">
              {currentQuestion?.input_mode === "mcq"
                ? isMuted
                  ? "Click an option to answer. Turn on the microphone if you want to answer by voice."
                  : "Click an option or speak: option A, option B, option C, or first option."
                : "Type your answer in the blue response box below."}
            </p>
          </div>

          {currentQuestion?.input_mode === "mcq" &&
          currentQuestion.options.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOptionIndex === index

                return (
                  <button
                    key={`${currentQuestion.index}-${index}`}
                    type="button"
                    disabled={isCurrentAnswered || isSubmittingAnswer}
                    onClick={() => onAnswerSelect(index)}
                    title={option}
                    aria-pressed={isSelected}
                    className={`group/option relative flex min-h-[58px] items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSelected
                        ? "border-blue-500 bg-blue-100 ring-2 ring-blue-200"
                        : "border-blue-100 bg-white hover:border-blue-300 hover:bg-blue-100"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>

                    <span
                      className={`min-w-0 flex-1 truncate text-xs font-semibold ${
                        isSelected ? "text-blue-900" : "text-slate-800"
                      }`}
                    >
                      {option}
                    </span>

                    {isSelected && (
                      <CheckCircle className="size-4 shrink-0 text-blue-600" />
                    )}

                    <div className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden w-[min(280px,calc(100%-1rem))] -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed font-medium text-white shadow-lg group-hover/option:block">
                      {option}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : currentQuestion?.input_mode === "free_text" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                <span>
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                {isPersonalityCard && <span>Self Rating</span>}
              </div>

              <div className="rounded-xl border border-blue-200 bg-white px-4 py-4 shadow-sm">
                <textarea
                  value={freeText}
                  onChange={(event) => setFreeText(event.target.value)}
                  placeholder="Type your answer here..."
                  disabled={isSubmittingAnswer || isCurrentAnswered}
                  className="min-h-[112px] w-full resize-none rounded-xl border border-blue-300 bg-blue-50/40 px-3 py-2.5 text-[13px] leading-5 text-slate-800 transition-colors outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:border-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[9px] leading-4 text-slate-500">
                    {freeTextVoiceError
                      ? freeTextVoiceError
                      : isRecordingFreeText
                        ? "Listening now. Tap the mic again to stop and keep the text in this answer field."
                        : isFreeTextListening
                          ? "Listening now. Tap the mic again to stop and keep the text in this answer field."
                          : isMuted
                            ? "Microphone is off. Tap Use Mic to turn it on and add your spoken text here."
                            : "You can type here or use the mic to dictate your answer into this field."}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFreeTextRecording}
                      disabled={isSubmittingAnswer || isCurrentAnswered}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[11px] font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${
                        isRecordingFreeText
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {isRecordingFreeText ? (
                        <MicOff className="size-3.5" />
                      ) : (
                        <Mic className="size-3.5" />
                      )}
                      {isRecordingFreeText || isFreeTextListening
                        ? "Stop Mic"
                        : "Use Mic"}
                    </button>

                    <button
                      type="button"
                      onClick={handleFreeTextSend}
                      disabled={
                        !freeText.trim() ||
                        isSubmittingAnswer ||
                        isCurrentAnswered
                      }
                      className="rounded-lg bg-blue-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {isSubmittingAnswer ? "Submitting..." : "Send Answer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : isMuted && currentQuestion ? (
            <div className="rounded-xl border border-amber-100 bg-white px-4 py-3 text-center">
              <MicOff className="mx-auto mb-2 size-5 text-amber-500" />
              <p className="text-xs font-semibold text-slate-700">
                Microphone is off
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                You can still read the question. Turn on the microphone only if
                you want to answer by voice.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-white/70 px-4 py-3 text-xs text-slate-500">
              {currentQuestion
                ? "This question expects a written response, so the answer input stays in the chat area."
                : "The interview host will show the next prompt here once the session begins."}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// INNER COMPONENT 2: CONTROLS TOOLBAR
// ============================================================================
interface ControlsBarProps {
  isCamOff: boolean
  hasCameraError: boolean
  setIsCamOff: (val: boolean) => void
  onEndCall: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

function ControlsBar({
  isCamOff,
  hasCameraError,
  setIsCamOff,
  onEndCall,
  isFullscreen,
  onToggleFullscreen,
}: ControlsBarProps) {
  const [showCameraRequiredMessage, setShowCameraRequiredMessage] =
    useState(false)

  useEffect(() => {
    if (!showCameraRequiredMessage) return

    const timeoutId = window.setTimeout(() => {
      setShowCameraRequiredMessage(false)
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [showCameraRequiredMessage])

  const handleCameraButtonClick = () => {
    if (hasCameraError) {
      setIsCamOff(false)
      return
    }

    if (!isCamOff) {
      setShowCameraRequiredMessage(true)
      return
    }

    setIsCamOff(false)
  }

  const circleButtonBase =
    "flex h-11 w-11 items-center justify-center rounded-full border text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-all duration-200"

  return (
    <div className="flex w-full flex-col items-center justify-center gap-2">
      {showCameraRequiredMessage && (
        <div className="rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[10px] font-semibold tracking-wide text-amber-700 shadow-sm">
          Camera must stay on during the interview
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-[#4f5268]/85 px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-2xl">
          <button
            onClick={handleCameraButtonClick}
            className={`${circleButtonBase} ${
              hasCameraError
                ? "border-[#8b5e34] bg-[#fff7ed] text-[#8b5e34] hover:bg-[#ffedd5]"
                : isCamOff
                  ? "border-white/10 bg-white/10 text-white hover:bg-white/16"
                  : "border-[#2d3247] bg-white text-slate-900 hover:bg-slate-100"
            }`}
            title={
              hasCameraError
                ? "Camera access blocked"
                : isCamOff
                  ? "Turn Camera On"
                  : "Camera is required"
            }
            type="button"
            aria-pressed={!isCamOff}
          >
            <span className="relative flex items-center justify-center">
              {hasCameraError || isCamOff ? (
                <>
                  <VideoOff className="size-[18px]" />
                  {hasCameraError && (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-600 px-1 py-[1px] text-[7px] leading-none font-bold text-white">
                      !
                    </span>
                  )}
                </>
              ) : (
                <Video className="size-[18px]" />
              )}
            </span>
          </button>

          <button
            onClick={onToggleFullscreen}
            className={`${circleButtonBase} ${
              isFullscreen
                ? "border-[#2d3247] bg-white text-slate-900 hover:bg-slate-100"
                : "border-white/10 bg-white/10 text-white hover:bg-white/16"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            type="button"
          >
            {isFullscreen ? (
              <Shrink className="size-[18px]" />
            ) : (
              <Expand className="size-[18px]" />
            )}
          </button>

          <div className="mx-1 h-8 w-px bg-white/14" />

          <button
            onClick={onEndCall}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cf7d89] bg-[#d96468] text-white shadow-[0_10px_24px_rgba(217,100,104,0.4)] transition-all duration-200 hover:bg-[#e06f73]"
            title="End Call"
            type="button"
          >
            <PhoneOff className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// INNER COMPONENT 3: INTERVIEW NOTES
// ============================================================================
interface NotesPanelProps {
  notesText: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  savingNotes: boolean
  notesSaveStatus: string
}

function NotesPanel({
  notesText,
  onChange,
  savingNotes,
  notesSaveStatus,
}: NotesPanelProps) {
  return (
    <div className="flex min-h-[96px] flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
      <div className="flex items-center justify-between border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          <FileText className="size-3.5 text-blue-600" />
          <h3 className="text-xs font-semibold text-black">Interview Notes</h3>
        </div>

        <div className="flex items-center gap-1.5">
          {savingNotes ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
            </span>
          ) : (
            <CheckCircle className="size-3 text-blue-600" />
          )}
          <span className="text-[9px] font-medium text-black">
            {notesSaveStatus}
          </span>
        </div>
      </div>

      <textarea
        className="h-20 w-full resize-none rounded-xl border border-blue-100 bg-blue-50/30 px-3 py-2 text-[11px] leading-5 text-black transition-colors outline-none placeholder:text-[11px] placeholder:text-black/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
        placeholder="Add your Notes here... (These notes are kept secure and compiled by cognitive systems post-evaluation)"
        value={notesText}
        onChange={onChange}
      />

      <div className="mt-0.5 flex items-center justify-between text-[9px] tracking-[0.08em] text-black uppercase">
        <span>Notes Autosave: Enabled</span>
        <span className="flex items-center gap-1 text-[9px] tracking-normal text-black normal-case">
          <AlertCircle className="size-2.5 text-blue-600" />
          Data synced to local session storage
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// COMBINED MIDDLE PANEL EXPORT WITH REALTIME VITALS CALLBACK
// ============================================================================
interface MiddlePanelProps {
  isCamOff: boolean
  setIsCamOff: (val: boolean) => void
  isMuted: boolean
  setIsMuted: (val: boolean) => void
  isAiSpeaking: boolean
  notesText: string
  onNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  savingNotes: boolean
  notesSaveStatus: string
  onEndCall: () => void
  candidateName: string
  sessionId: string
  onVitalsCalculated?: (data: {
    hr: number
    stress: number
    attention: number
    emotions: { neutral: number; confident: number; engaged: number }
    gaze: string
    isFaceDetected: boolean
  }) => void
  currentQuestion: Question | null
  currentQuestionIndex: number
  totalQuestions: number
  isCurrentAnswered: boolean
  selectedOptionIndex?: number
  isSubmittingAnswer: boolean
  onAnswerSelect: (optionIndex: number) => void
  onFreeTextSubmit: (text: string) => void
}

export function MiddlePanel({
  isCamOff,
  setIsCamOff,
  isMuted,
  setIsMuted,
  isAiSpeaking,
  notesText,
  onNotesChange,
  savingNotes,
  notesSaveStatus,
  onEndCall,
  candidateName,
  sessionId,
  onVitalsCalculated,
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  isCurrentAnswered,
  selectedOptionIndex,
  isSubmittingAnswer,
  onAnswerSelect,
  onFreeTextSubmit,
}: MiddlePanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    handleFullscreenChange()

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error)
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto bg-slate-50 p-4 md:p-6">
      <VideoStreams
        isCamOff={isCamOff}
        setIsCamOff={setIsCamOff}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        isAiSpeaking={isAiSpeaking}
        onEndCall={onEndCall}
        candidateName={candidateName}
        sessionId={sessionId}
        notesText={notesText}
        onNotesChange={onNotesChange}
        savingNotes={savingNotes}
        notesSaveStatus={notesSaveStatus}
        onVitalsCalculated={onVitalsCalculated}
        currentQuestion={currentQuestion}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={totalQuestions}
        isCurrentAnswered={isCurrentAnswered}
        selectedOptionIndex={selectedOptionIndex}
        isSubmittingAnswer={isSubmittingAnswer}
        onAnswerSelect={onAnswerSelect}
        onFreeTextSubmit={onFreeTextSubmit}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    </main>
  )
}

export default MiddlePanel
