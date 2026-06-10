export interface Message {
  id: string
  sender: "recruiter" | "candidate"
  text: string
  time: string
}

export interface Emotions {
  neutral: number
  confident: number
  engaged: number
}

export interface Question {
  index: number
  type: "excel_mcq" | "ocean" | "16pf" | "resume_technical" | "jd_technical"
  question: string
  scenario?: string
  options: string[]
  role?: string
  round: number
  round_name: string
  input_mode: "mcq" | "free_text"
  difficulty?: string
  skill_area?: string
}

export interface RoundSummary {
  [roundName: string]: {
    round: number
    count: number
    types: string[]
  }
}

export interface SessionData {
  session_id: string
  interview_id: string
  candidate_name: string
  candidate_email?: string
  role: string
  questions: Question[]
  total_questions: number
  total_rounds: number
  round_summary: RoundSummary
  time_minutes: number
}

export interface RoundBreakdown {
  score: number
  out_of: number
  percentage: number
  questions_answered: number
}

export interface QuestionDetail {
  index: number
  round_name: string
  type: string
  question: string
  answer: string
  score: number
  feedback: string
  difficulty?: string
  skill_area?: string
}

export interface FinalResult {
  overall_score: number
  overall_score_pct: number
  total_score?: number
  out_of?: number
  pass_mark?: number
  result: "SELECTED" | "NOT SELECTED"
  round_breakdown: { [roundName: string]: RoundBreakdown }
  breakdown?: { excel_mcq: number; ocean_personality: number; pf16_personality: number }
  answered: number
  total_questions: number
  total_rounds: number
  vitals_report?: any
  question_details?: QuestionDetail[]
}