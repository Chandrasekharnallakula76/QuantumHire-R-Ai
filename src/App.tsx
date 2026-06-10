import { useState, useEffect } from "react"
import { InterviewScreen } from "./components/interview/InterviewScreen"
import { OTPVerification } from "./components/OTPVerification"
import { HRDashboard } from "./components/HRDashboard"
import { ConsentScreen } from "./components/ConsentScreen"

export function App() {
  const [currentPage, setCurrentPage] = useState<"hr" | "otp" | "consent" | "interview">("hr")
  const [sessionData, setSessionData] = useState<any>(null)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const [urlParams, setUrlParams] = useState<{
    interviewId: string; email: string; name: string; role: string
  }>({ interviewId: "", email: "", name: "Candidate", role: "General" })

  // Use a state to track the hash so it can be used as a dependency
  const [currentHash, setCurrentHash] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash)
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  // FIX 2: Add currentHash to useEffect dependencies and improve navigation logic
  useEffect(() => {
    const hash = currentHash
    const inIframe = window.self !== window.top
    setIsEmbedded(inIframe)

    const hashQuery = hash.split("?")[1] || ""
    const params = new URLSearchParams(hashQuery)
    setUrlParams({
      interviewId: params.get("interview_id") || "",
      email: params.get("email") || "",
      name: params.get("name") || "Candidate",
      role: params.get("role") || "General",
    })

    // Determine page based on hash and session state
    if (hash.startsWith("#/embed")) {
      setCurrentPage("otp")
    } else if (hash.startsWith("#/hr-embed") || hash.startsWith("#/hr")) {
      setCurrentPage("hr")
    } else if (hash.startsWith("#/otp")) {
      setCurrentPage("otp")
    } else if (hash.startsWith("#/consent")) {
      // Only show consent if we have session data
      if (sessionData) {
        setCurrentPage("consent")
      }
    } else if (hash.startsWith("#/interview")) {
      // Only show interview if we have session data
      if (sessionData) {
        setCurrentPage("interview")
      }
    } else {
      setCurrentPage("hr")
    }
  }, [currentHash, sessionData]) // FIX: Use currentHash state as dependency

  const handleOTPVerified = (data: any) => {
    setSessionData(data)
    const interviewId = data.interview_id || urlParams.interviewId
    
    // FIX: Update hash FIRST, then state will react to hash change
    if (interviewId) {
      window.location.hash = "#/consent"
    } else {
      window.location.hash = "#/interview"
    }
  }

  const handleConsentGiven = () => {
    window.location.hash = "#/interview"
  }

  const handleInterviewSent = () => {}

  useEffect(() => {
    if (currentPage === "interview" && sessionData && isEmbedded) {
      window.parent.postMessage({
        type: "cognitivescreen:interview_started",
        session_id: sessionData.session_id,
        interview_id: sessionData.interview_id || "",
      }, "*")
    }
  }, [currentPage, sessionData, isEmbedded])

  return (
    <>
      {currentPage === "hr" && !isEmbedded && <HRDashboard onInterviewSent={handleInterviewSent} />}
      {currentPage === "hr" && isEmbedded && <OTPVerification onVerified={handleOTPVerified} />}
      {currentPage === "otp" && <OTPVerification onVerified={handleOTPVerified} />}
      {currentPage === "consent" && sessionData && (
        <ConsentScreen
          interviewId={sessionData.interview_id || urlParams.interviewId}
          candidateEmail={sessionData.candidate_email || urlParams.email}
          candidateName={sessionData.candidate_name || urlParams.name}
          role={sessionData.role || urlParams.role}
          onConsentGiven={handleConsentGiven}
        />
      )}
      {currentPage === "interview" && sessionData && (
        <InterviewScreen sessionData={sessionData} isEmbedded={isEmbedded} />
      )}
    </>
  )
}

export default App
