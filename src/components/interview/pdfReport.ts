/**
 * PDF Report Generator for CognitiveScreen AI Interview Results v3.2
 * Updated: Light theme matching RecruiterAi SCREEN Assessment style.
 */
import { jsPDF } from "jspdf"
import type { Question } from "./types"

interface RoundBreakdown {
  score: number
  out_of: number
  percentage: number
  questions_answered: number
}

interface FinalResult {
  overall_score?: number
  overall_score_pct?: number
  total_score?: number
  out_of?: number
  pass_mark?: number
  result: "SELECTED" | "NOT SELECTED"
  round_breakdown?: { [roundName: string]: RoundBreakdown }
  breakdown?: { excel_mcq: number; ocean_personality: number; pf16_personality: number }
  answered: number
  total_questions: number
  total_rounds?: number
  vitals_report?: any
  question_details?: {
    index: number
    round_name: string
    type: string
    question: string
    answer: string
    score: number
    feedback: string
    difficulty?: string
    skill_area?: string
  }[]
}

interface ReportParams {
  candidateName: string
  role: string
  finalResult: FinalResult | null
  avgHeartRate: number
  avgStress: number
  avgAttention: number
  notesText: string
  questions?: Question[]
  answeredQuestions?: Record<number, number | string>
}

// RecruiterAi Theme Colors
const GOLD = [251, 191, 36] as const
const SLATE_900 = [15, 23, 42] as const
const SLATE_600 = [71, 85, 105] as const
const SLATE_200 = [226, 232, 240] as const
const SLATE_100 = [241, 245, 249] as const
const RecruiterAi_BLUE = [37, 99, 235] as const
const RED = [239, 68, 68] as const
const ORANGE = [249, 115, 22] as const

function drawRoundedRect(
  doc: jsPDF, x: number, y: number, w: number, h: number, r: number,
  fill: readonly [number, number, number], stroke?: readonly [number, number, number]
) {
  doc.setFillColor(fill[0], fill[1], fill[2])
  if (stroke) {
    doc.setDrawColor(stroke[0], stroke[1], stroke[2])
    doc.setLineWidth(0.1)
    doc.roundedRect(x, y, w, h, r, r, "FD")
  } else {
    doc.roundedRect(x, y, w, h, r, r, "F")
  }
}

function drawYellowLine(doc: jsPDF, x: number, y: number, w: number) {
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2])
  doc.setLineWidth(0.8)
  doc.line(x, y, x + w, y)
}

function ensureSpace(doc: jsPDF, cy: number, needed: number, mx: number, candidateName: string, dateStr: string): number {
  const ph = doc.internal.pageSize.getHeight()
  const pw = doc.internal.pageSize.getWidth()
  if (cy + needed > ph - 25) {
    doc.addPage()
    // Footer on every page
    drawFooter(doc, pw, ph, mx, candidateName, dateStr)
    return 25
  }
  return cy
}

function drawFooter(doc: jsPDF, pw: number, ph: number, mx: number, candidateName: string, dateStr: string) {
  const fy = ph - 15
  doc.setDrawColor(SLATE_200[0], SLATE_200[1], SLATE_200[2])
  doc.setLineWidth(0.2)
  doc.line(mx, fy, pw - mx, fy)
  
  doc.setFontSize(7)
  doc.setTextColor(SLATE_600[0], SLATE_600[1], SLATE_600[2])
  doc.setFont("helvetica", "normal")
  const footerText = `Prepared For: ${candidateName} | Assessment Completed On: ${dateStr} | Generated On: ${new Date().toLocaleDateString()}`
  doc.text(footerText, pw / 2, fy + 5, { align: "center" })
  doc.text(`Contact Us: 2000 Argentia Rd, plaza 5, Unit 105, Mississauga, L5N 1W1, connect@RecruiterAi.com | RecruiterAi.com`, pw / 2, fy + 8, { align: "center" })
  
  const pageNum = doc.internal.pages.length - 1
  doc.text(`Page: ${pageNum} / ${pageNum}`, pw - mx, fy + 10, { align: "right" })
}

export function generateReportPDF(params: ReportParams) {
  const {
    candidateName, role, finalResult,
    avgHeartRate, avgStress, avgAttention,
  } = params

  const scorePct = finalResult?.overall_score_pct ?? (finalResult?.total_score ? Math.round((finalResult.total_score / (finalResult.out_of || 20)) * 100) : 0)
  const result = finalResult?.result ?? "NOT SELECTED"
  const isSelected = result === "SELECTED"
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "numeric", year: "numeric" })

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const mx = 15
  const cw = pw - mx * 2

  // Page 1
  // Header with Logo Placeholder
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2])
  doc.text("RecruiterAi SCREEN Assessment", pw / 2, 25, { align: "center" })
  
  // Blue Circle Logo Placeholder
  doc.setFillColor(RecruiterAi_BLUE[0], RecruiterAi_BLUE[1], RecruiterAi_BLUE[2])
  doc.circle(pw - mx - 10, 20, 4, "F")
  doc.setFontSize(10)
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2])
  doc.text("RecruiterAi", pw - mx - 5, 21, { align: "left" })

  doc.setDrawColor(SLATE_200[0], SLATE_200[1], SLATE_200[2])
  doc.setLineWidth(0.2)
  doc.line(mx, 30, pw - mx, 30)

  let cy = 45

  // Section: About This Assessment
  doc.setFontSize(14)
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2])
  doc.text("About This Assessment", mx, cy)
  cy += 2
  drawYellowLine(doc, mx, cy, cw)
  cy += 8

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(SLATE_600[0], SLATE_600[1], SLATE_600[2])
  const aboutText = `This RecruiterAI Screen was administered for ${candidateName}. This assessment is based on a targeted set of evaluation criteria designed to identify candidate strengths, competencies, and potential areas for further review. RecruiterAI Screen is intended to provide an initial assessment of role alignment, skills, experience, and overall suitability for the position. The results are designed to support recruitment and hiring decisions and may indicate whether a more comprehensive evaluation is warranted. Interpretation of these results and any recommendations should be completed by authorized recruitment professionals in accordance with their organization's hiring practices and guidelines.`
  const aboutLines = doc.splitTextToSize(aboutText, cw)
  doc.text(aboutLines, mx, cy)
  cy += aboutLines.length * 5 + 5

  // Section: Assessment Information
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2])
  doc.text("Assessment Information", mx, cy)
  cy += 2
  drawYellowLine(doc, mx, cy, cw)
  cy += 10

  // Two column details
  const col1X = mx
  const col2X = pw / 2 + 5
  
  doc.setFontSize(10)
  doc.text("Assessment Details", col1X, cy)
  doc.text("Assessor and Report Details", col2X, cy)
  cy += 6

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const details = [
    { label: "Candidate Name:", value: candidateName },
    { label: "Role:", value: role },
    { label: "Assessment Date:", value: dateStr },
    { label: "Total Questions:", value: finalResult?.total_questions?.toString() || "20" },
    { label: "Questions Answered:", value: finalResult?.answered?.toString() || "0" }
  ]

  let dy = cy
  details.forEach(d => {
    doc.setFont("helvetica", "bold")
    doc.text(d.label, col1X, dy)
    doc.setFont("helvetica", "normal")
    doc.text(d.value, col1X + 40, dy)
    dy += 5
  })

  doc.setFont("helvetica", "bold")
  doc.text("Assessor:", col2X, cy)
  doc.setFont("helvetica", "normal")
  doc.text("Recruiter AI System", col2X + 40, cy)
  doc.setFont("helvetica", "bold")
  doc.text("Report Status:", col2X, cy + 5)
  doc.setFont("helvetica", "normal")
  doc.text(isSelected ? "COMPLETED - SELECTED" : "COMPLETED - NOT SELECTED", col2X + 40, cy + 5)

  cy = dy + 15

  // Section: Performance Overview
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("Functional Cognitive Skill Performance", mx, cy)
  cy += 2
  drawYellowLine(doc, mx, cy, cw)
  cy += 10

  // Result Card
  drawRoundedRect(doc, mx, cy, cw, 40, 2, SLATE_100, SLATE_200)
  
  doc.setFontSize(10)
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2])
  doc.text("Overall Performance Result", mx + 5, cy + 8)
  
  // Bar Graph Representation
  const graphX = mx + 10
  const graphY = cy + 20
  const graphW = cw - 20
  const graphH = 8

  // Background bar
  doc.setFillColor(SLATE_200[0], SLATE_200[1], SLATE_200[2])
  doc.rect(graphX, graphY, graphW, graphH, "F")
  
  // Score bar
  const scoreBarW = (scorePct / 100) * graphW
  doc.setFillColor(RecruiterAi_BLUE[0], RecruiterAi_BLUE[1], RecruiterAi_BLUE[2])
  doc.rect(graphX, graphY, scoreBarW, graphH, "F")

  // Average marker (Standard RecruiterAi Style)
  const avgX = graphX + (0.75 * graphW) // Assuming 75% is average
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2])
  doc.rect(avgX - 0.5, graphY - 2, 1, graphH + 4, "F")

  doc.setFontSize(8)
  doc.setTextColor(SLATE_600[0], SLATE_600[1], SLATE_600[2])
  doc.text("0", graphX, graphY + graphH + 4)
  doc.text("100", graphX + graphW, graphY + graphH + 4, { align: "right" })
  doc.text(`Score: ${scorePct}`, graphX + scoreBarW, graphY - 2, { align: "center" })

  cy += 50

  // Vitals Section
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Biometric Session Summary", mx, cy)
  cy += 8

  const vitals = [
    { label: "Heart Rate", value: `${avgHeartRate} BPM`, color: RED },
    { label: "Stress Index", value: `${avgStress}%`, color: ORANGE },
    { label: "Attention Score", value: `${avgAttention}%`, color: RecruiterAi_BLUE }
  ]

  vitals.forEach((v, i) => {
    const vx = mx + (i * (cw / 3))
    drawRoundedRect(doc, vx, cy, (cw / 3) - 5, 20, 1, SLATE_100, SLATE_200)
    doc.setFontSize(8)
    doc.setTextColor(SLATE_600[0], SLATE_600[1], SLATE_600[2])
    doc.text(v.label, vx + 5, cy + 7)
    doc.setFontSize(12)
    doc.setTextColor(v.color[0], v.color[1], v.color[2])
    doc.text(v.value, vx + 5, cy + 15)
  })

  drawFooter(doc, pw, ph, mx, candidateName, dateStr)

  // Questions and Answers Section (Starts on New Page)
  doc.addPage()
  cy = 25
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2])
  doc.text("Detailed Assessment Responses", mx, cy)
  cy += 2
  drawYellowLine(doc, mx, cy, cw)
  cy += 10

  const qDetails = finalResult?.question_details || []
  qDetails.forEach((qd, idx) => {
    const qLines = doc.splitTextToSize(`${idx + 1}. ${qd.question}`, cw - 10)
    const aLines = doc.splitTextToSize(`Response: ${qd.answer}`, cw - 15)
    const fLines = qd.feedback ? doc.splitTextToSize(`Feedback: ${qd.feedback}`, cw - 15) : []
    
    const needed = (qLines.length + aLines.length + fLines.length) * 5 + 15
    cy = ensureSpace(doc, cy, needed, mx, candidateName, dateStr)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(SLATE_900[0], SLATE_900[1], SLATE_900[2])
    doc.text(qLines, mx, cy)
    cy += qLines.length * 5

    doc.setFont("helvetica", "normal")
    doc.setTextColor(SLATE_600[0], SLATE_600[1], SLATE_600[2])
    doc.text(aLines, mx + 5, cy)
    cy += aLines.length * 5

    if (fLines.length > 0) {
      doc.setFont("helvetica", "italic")
      doc.setTextColor(RecruiterAi_BLUE[0], RecruiterAi_BLUE[1], RecruiterAi_BLUE[2])
      doc.text(fLines, mx + 5, cy)
      cy += fLines.length * 5
    }
    
    cy += 5
  })

  drawFooter(doc, pw, ph, mx, candidateName, dateStr)

  // Save the PDF
  const filename = `CognitiveScreen_Report_${candidateName.replace(/\s+/g, "_")}.pdf`
  doc.save(filename)
}
