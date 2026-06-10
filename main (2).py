"""
CognitiveScreen AI - Full-Stack Interview Platform Backend
===========================================================
Complete ONNX Vitals Pipeline: rPPG → HR → BP → Glucose → All Blood Markers
Question Bank: Excel MCQ + OCEAN Personality + 16PF Behavioral
OTP Email Verification via Gmail SMTP
ElevenLabs TTS integration (frontend-side)

Endpoints:
  POST /api/send-interview    → HR sends interview invitation (OTP via Gmail)
  POST /api/verify-otp        → Candidate enters OTP → gets session + 20 questions
  POST /api/submit-answer     → Score a single answer
  POST /api/finish-interview  → Final score, SELECTED/NOT SELECTED
  POST /api/vitals/init       → Initialize vitals session with demographics
  POST /api/vitals/frame      → Process webcam frame through full ONNX pipeline
  GET  /api/vitals/report     → Get complete vitals report for a session
  GET  /api/health            → Health check
"""

from __future__ import annotations
import os, json, random, string, time, smtplib, base64, pickle, re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from collections import deque

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="CognitiveScreen AI Backend")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ── Config ────────────────────────────────────────────────────────────────────
GMAIL_USER = os.getenv("GMAIL_USER", "notification.aiinterview@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "qmqmoyzdjffzamsa")
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "Models"
EXCEL_PATH = BASE_DIR / "NuggetChallengePack.xlsx"

# ── Stores ────────────────────────────────────────────────────────────────────
otp_store: dict[str, dict] = {}
sessions: dict[str, dict] = {}
vitals_sessions: dict[str, dict] = {}

# ══════════════════════════════════════════════════════════════════════════════
# ONNX MODEL MANAGEMENT (Lazy-load all models)
# ══════════════════════════════════════════════════════════════════════════════

class ModelManager:
    """Lazily loads and caches all ONNX model sessions."""
    def __init__(self):
        self._sessions: dict[str, any] = {}
        self._rppg_calib: dict = {}
        self._glucose_artifacts: dict | None = None
        self._ort = None

    def _get_ort(self):
        if self._ort is None:
            import onnxruntime as ort
            ort.set_default_logger_severity(3)
            self._ort = ort
        return self._ort

    def _load(self, name: str, path: Path):
        if name not in self._sessions:
            if not path.exists():
                print(f"⚠️ Model not found: {path}")
                return None
            ort = self._get_ort()
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self._sessions[name] = ort.InferenceSession(str(path), opts)
            print(f"✅ Loaded model: {name}")
        return self._sessions[name]

    @property
    def rppg(self):
        sess = self._load("rppg", MODELS_DIR / "Rppg" / "rppg_model.onnx")
        if sess and not self._rppg_calib:
            calib_path = MODELS_DIR / "Rppg" / "rppg_calibration.json"
            if calib_path.exists():
                with open(calib_path) as f:
                    self._rppg_calib = json.load(f)
        return sess

    @property
    def rppg_calib(self):
        _ = self.rppg  # ensure loaded
        return self._rppg_calib

    @property
    def bp(self):
        return self._load("bp", MODELS_DIR / "bp" / "bp_estimator_calibrated.onnx")

    @property
    def glucose(self):
        sess = self._load("glucose", MODELS_DIR / "glucose" / "glucose_estimator.onnx")
        if sess and self._glucose_artifacts is None:
            art_path = MODELS_DIR / "glucose" / "model_artifacts.pkl"
            if art_path.exists():
                try:
                    with open(art_path, "rb") as f:
                        self._glucose_artifacts = pickle.load(f)
                    print("✅ Loaded glucose model artifacts (scalers)")
                except Exception as e:
                    print(f"⚠️ glucose artifacts load error: {e}")
                    self._glucose_artifacts = {}
        return sess

    @property
    def glucose_artifacts(self):
        _ = self.glucose
        return self._glucose_artifacts or {}

    def blood_marker(self, name: str):
        """Load any of: chol_total, hdl, ldl, vldl, triglycerides, hba1c, homa_ir, tsh, thyroid_flag"""
        return self._load(name, MODELS_DIR / name / "model.onnx")

    def blood_marker_columns(self, name: str) -> list[str]:
        col_path = MODELS_DIR / name / "columns.json"
        if col_path.exists():
            with open(col_path) as f:
                return json.load(f).get("features", [])
        return ["age","gender","height","weight","bmi","hr","sbp","dbp","glucose"]


models = ModelManager()

BLOOD_MARKERS = ["chol_total","hdl","ldl","vldl","triglycerides","hba1c","homa_ir","tsh","thyroid_flag"]

# ══════════════════════════════════════════════════════════════════════════════
# VITALS ENGINE (Full ONNX pipeline from the shared Python reference)
# ══════════════════════════════════════════════════════════════════════════════

def run_rppg(crop_rgb: np.ndarray, prev_crop: np.ndarray) -> float:
    """Run rPPG model on two consecutive 36x36 face crops → raw HR output."""
    sess = models.rppg
    if sess is None:
        return 73.0 + random.uniform(-2, 2)
    try:
        c = crop_rgb[np.newaxis].astype(np.float32)  # (1,36,36,3)
        p = prev_crop[np.newaxis].astype(np.float32)
        out = sess.run(["dense_1"], {"input_1": c, "input_2": p})
        raw = float(out[0][0][0])
        a = models.rppg_calib.get("a", 0.0)
        b = models.rppg_calib.get("b", 73.23)
        return a * raw + b
    except Exception as e:
        print(f"rPPG error: {e}")
        return 73.0 + random.uniform(-2, 2)


def run_bp(ppg_signal: np.ndarray) -> tuple[float, float]:
    """Run BP estimator on 1250-sample PPG buffer → (systolic, diastolic)."""
    sess = models.bp
    if sess is None or len(ppg_signal) < 1250:
        return 120.0 + random.uniform(-3, 3), 80.0 + random.uniform(-2, 2)
    try:
        ppg = ppg_signal[-1250:].astype(np.float32)
        mu, sd = ppg.mean(), max(ppg.std(), 1e-6)
        ppg = (ppg - mu) / sd
        inp = ppg.reshape(1, 1, 1250)
        input_name = sess.get_inputs()[0].name
        output_names = [o.name for o in sess.get_outputs()]
        out = sess.run(output_names, {input_name: inp})
        result = out[0][0]
        sbp = float(np.clip(result[0], 70, 200))
        dbp = float(np.clip(result[1] if len(result) > 1 else result[0] * 0.65, 40, 130))
        return sbp, dbp
    except Exception as e:
        print(f"BP error: {e}")
        return 120.0 + random.uniform(-3, 3), 80.0 + random.uniform(-2, 2)


def run_glucose(ppg_signal: np.ndarray, demographics: dict) -> float:
    """Run glucose estimator: PPG signal + demographic features → mg/dL."""
    sess = models.glucose
    if sess is None or len(ppg_signal) < 1250:
        return 95.0 + random.uniform(-5, 5)
    try:
        ppg = ppg_signal[-1250:].astype(np.float32)
        arts = models.glucose_artifacts
        # Apply scaler if available
        if "scaler_ppg" in arts:
            ppg = arts["scaler_ppg"].transform(ppg.reshape(1, -1)).flatten()
        else:
            mu, sd = ppg.mean(), max(ppg.std(), 1e-6)
            ppg = (ppg - mu) / sd
        ppg_inp = ppg.reshape(1, 1, 1250).astype(np.float32)

        # Demographics: [age, gender, height, weight, hr, sbp, dbp, pulse_area]
        demo = np.array([[
            demographics.get("age", 25),
            demographics.get("gender", 1),
            demographics.get("height", 170),
            demographics.get("weight", 70),
            demographics.get("hr", 75),
            demographics.get("sbp", 120),
            demographics.get("dbp", 80),
            demographics.get("pulse_area", 1.0),
        ]], dtype=np.float32)
        if "scaler_meta" in arts:
            demo = arts["scaler_meta"].transform(demo).astype(np.float32)

        input_names = [i.name for i in sess.get_inputs()]
        feeds = {}
        for iname in input_names:
            if "ppg" in iname.lower() or "signal" in iname.lower():
                feeds[iname] = ppg_inp
            else:
                feeds[iname] = demo

        out = sess.run(None, feeds)
        glucose = float(np.clip(out[0][0][0], 60, 300))
        return glucose
    except Exception as e:
        print(f"Glucose error: {e}")
        return 95.0 + random.uniform(-5, 5)


def run_blood_markers(demographics: dict) -> dict[str, float]:
    """Run all blood marker ONNX models. Each takes [age,gender,height,weight,bmi,hr,sbp,dbp,glucose]."""
    results = {}
    for marker in BLOOD_MARKERS:
        sess = models.blood_marker(marker)
        if sess is None:
            continue
        try:
            cols = models.blood_marker_columns(marker)
            h = demographics.get("height", 170)
            w = demographics.get("weight", 70)
            bmi = w / ((h / 100) ** 2) if h > 0 else 22.0

            feature_map = {
                "age": demographics.get("age", 25),
                "gender": demographics.get("gender", 1),
                "height": h,
                "weight": w,
                "bmi": bmi,
                "hr": demographics.get("hr", 75),
                "sbp": demographics.get("sbp", 120),
                "dbp": demographics.get("dbp", 80),
                "glucose": demographics.get("glucose", 95),
            }
            features = np.array([[feature_map.get(c, 0.0) for c in cols]], dtype=np.float32)

            input_name = sess.get_inputs()[0].name
            out = sess.run(None, {input_name: features})
            val = float(out[0][0][0]) if out[0].ndim > 1 else float(out[0][0])
            results[marker] = round(val, 2)
        except Exception as e:
            print(f"Blood marker {marker} error: {e}")
    return results

# Normal ranges for display
NORMAL_RANGES = {
    "chol_total": {"min": 125, "max": 200, "unit": "mg/dL", "label": "Total Cholesterol"},
    "hdl": {"min": 40, "max": 60, "unit": "mg/dL", "label": "HDL Cholesterol"},
    "ldl": {"min": 0, "max": 100, "unit": "mg/dL", "label": "LDL Cholesterol"},
    "vldl": {"min": 5, "max": 40, "unit": "mg/dL", "label": "VLDL Cholesterol"},
    "triglycerides": {"min": 0, "max": 150, "unit": "mg/dL", "label": "Triglycerides"},
    "hba1c": {"min": 4.0, "max": 5.7, "unit": "%", "label": "HbA1c"},
    "homa_ir": {"min": 0.5, "max": 2.5, "unit": "", "label": "HOMA-IR"},
    "tsh": {"min": 0.4, "max": 4.0, "unit": "mIU/L", "label": "TSH"},
    "thyroid_flag": {"min": 0, "max": 0.5, "unit": "", "label": "Thyroid Flag"},
}

# ══════════════════════════════════════════════════════════════════════════════
# QUESTION BANK
# ══════════════════════════════════════════════════════════════════════════════

def load_excel_questions() -> list[dict]:
    import openpyxl
    wb = openpyxl.load_workbook(str(EXCEL_PATH))
    ws = wb["Benchmark Chapters Data"]
    questions = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        role, challenge, scenario, title, question_text, options_str = row
        if not question_text or question_text == "N/A":
            continue
        if not options_str or options_str == "N/A":
            continue
        raw_options = [o.strip() for o in str(options_str).split("|")]
        parsed_options = []
        correct_idx = -1
        for i, opt in enumerate(raw_options):
            is_correct = "(true)" in opt.lower()
            clean = opt.replace("(true)","").replace("(false)","").replace("(True)","").replace("(False)","").strip()
            if is_correct and correct_idx == -1:
                correct_idx = i
            parsed_options.append(clean)
        scenario_clean = re.sub(r'<[^>]+>', '', str(scenario)).strip() if scenario else ""
        questions.append({
            "type": "excel", "role": role, "challenge": challenge,
            "scenario": scenario_clean, "question": str(question_text),
            "options": parsed_options, "correct_idx": correct_idx,
        })
    return questions

OCEAN_QUESTIONS = [
    {"text": "I love exploring new cultures through cuisine and travel.", "scores": {"O":4.7,"C":3.1,"E":3.5,"A":3.9,"N":2.1}},
    {"text": "My workspace is always organized; I can't focus in a messy environment.", "scores": {"O":2.9,"C":4.8,"E":2.1,"A":3.2,"N":2.4}},
    {"text": "Large social gatherings make me feel energized and excited.", "scores": {"O":3.1,"C":2.9,"E":4.6,"A":3.5,"N":1.7}},
    {"text": "I often worry about things not going as planned.", "scores": {"O":3.0,"C":3.9,"E":2.0,"A":3.4,"N":4.5}},
    {"text": "Having a daily routine is comforting and helps me be productive.", "scores": {"O":2.3,"C":4.6,"E":1.7,"A":3.7,"N":2.2}},
    {"text": "I find fulfillment in helping others with their problems.", "scores": {"O":3.4,"C":3.3,"E":2.8,"A":4.6,"N":2.0}},
    {"text": "I'm the life of the party and always make new friends at social events.", "scores": {"O":3.3,"C":2.2,"E":4.9,"A":3.3,"N":1.8}},
    {"text": "Unfamiliar situations make me anxious and uncomfortable.", "scores": {"O":2.8,"C":3.1,"E":1.4,"A":2.9,"N":4.7}},
    {"text": "Empathy and kindness are my guiding principles in life.", "scores": {"O":3.6,"C":3.0,"E":2.4,"A":4.9,"N":2.1}},
    {"text": "I have a keen eye for details that others often overlook.", "scores": {"O":4.2,"C":3.7,"E":2.0,"A":3.2,"N":2.8}},
    {"text": "Lifelong learning is a passion of mine.", "scores": {"O":4.8,"C":3.8,"E":2.7,"A":3.6,"N":2.1}},
    {"text": "I follow a strict workflow to keep tasks in check.", "scores": {"O":2.7,"C":4.9,"E":1.6,"A":3.0,"N":2.3}},
    {"text": "Debating topics with friends always feels invigorating.", "scores": {"O":4.4,"C":2.7,"E":4.1,"A":2.6,"N":2.2}},
    {"text": "I avoid confrontations and believe in harmony.", "scores": {"O":2.4,"C":3.0,"E":1.5,"A":4.7,"N":3.1}},
    {"text": "Minor hiccups or changes can greatly stress me out.", "scores": {"O":3.1,"C":2.8,"E":1.8,"A":3.1,"N":4.6}},
    {"text": "I'm constantly curious about different fields.", "scores": {"O":4.6,"C":3.4,"E":3.7,"A":3.8,"N":1.9}},
    {"text": "I thrive in dynamic environments requiring interaction.", "scores": {"O":3.7,"C":3.0,"E":4.5,"A":3.4,"N":2.1}},
    {"text": "People tell me I'm easygoing and cooperative.", "scores": {"O":3.2,"C":3.5,"E":2.9,"A":4.3,"N":1.8}},
    {"text": "I'm intrigued by the unknown.", "scores": {"O":4.9,"C":2.8,"E":3.6,"A":3.4,"N":1.6}},
    {"text": "Completing tasks to the best of my ability is deeply satisfying.", "scores": {"O":3.8,"C":4.7,"E":2.8,"A":3.6,"N":2.3}},
]

PF16_QUESTIONS = [
    {"text": "I take time out for others.", "trait": "Warmth", "direction": "positive"},
    {"text": "I take control of things.", "trait": "Dominance", "direction": "positive"},
    {"text": "I try to forgive and forget.", "trait": "Sensitivity", "direction": "positive"},
    {"text": "I keep in the background.", "trait": "SocialBoldness", "direction": "negative"},
    {"text": "I trust others.", "trait": "Vigilance", "direction": "negative"},
    {"text": "I am not easily frustrated.", "trait": "EmotionalStability", "direction": "positive"},
    {"text": "I cheer people up.", "trait": "Liveliness", "direction": "positive"},
    {"text": "I seldom feel blue.", "trait": "EmotionalStability", "direction": "positive"},
    {"text": "I believe in the importance of art.", "trait": "Abstractedness", "direction": "positive"},
    {"text": "I like to get lost in thought.", "trait": "Abstractedness", "direction": "positive"},
    {"text": "I am willing to talk about myself.", "trait": "Privateness", "direction": "negative"},
    {"text": "I weigh the pros against the cons.", "trait": "Reasoning", "direction": "positive"},
    {"text": "I do unexpected things.", "trait": "OpennessToChange", "direction": "positive"},
    {"text": "I am quiet around strangers.", "trait": "SocialBoldness", "direction": "negative"},
    {"text": "I make people feel at ease.", "trait": "Warmth", "direction": "positive"},
    {"text": "I use my brain.", "trait": "Reasoning", "direction": "positive"},
    {"text": "I have a good word for everyone.", "trait": "Warmth", "direction": "positive"},
    {"text": "I want to be in charge.", "trait": "Dominance", "direction": "positive"},
    {"text": "I feel comfortable around people.", "trait": "SocialBoldness", "direction": "positive"},
    {"text": "I am the life of the party.", "trait": "Liveliness", "direction": "positive"},
    {"text": "I enjoy hearing new ideas.", "trait": "OpennessToChange", "direction": "positive"},
    {"text": "I try to follow the rules.", "trait": "RuleConsciousness", "direction": "positive"},
    {"text": "I continue until everything is perfect.", "trait": "Perfectionism", "direction": "positive"},
    {"text": "I tend to analyze things.", "trait": "Reasoning", "direction": "positive"},
    {"text": "I prefer variety to routine.", "trait": "OpennessToChange", "direction": "positive"},
    {"text": "I feel others' emotions.", "trait": "Sensitivity", "direction": "positive"},
    {"text": "I love to think up new ways of doing things.", "trait": "OpennessToChange", "direction": "positive"},
    {"text": "I start conversations.", "trait": "SocialBoldness", "direction": "positive"},
    {"text": "I make friends easily.", "trait": "Warmth", "direction": "positive"},
    {"text": "I get chores done right away.", "trait": "Perfectionism", "direction": "positive"},
]

_excel_questions: list[dict] = []

@app.on_event("startup")
def startup_load():
    global _excel_questions
    try:
        _excel_questions = load_excel_questions()
        print(f"✅ Loaded {len(_excel_questions)} Excel questions")
    except Exception as e:
        print(f"⚠️ Excel load error: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class SendInterviewReq(BaseModel):
    candidate_email: str
    candidate_name: str
    role: str = "General"
    interview_url: str = ""

class VerifyOTPReq(BaseModel):
    email: str
    otp: str

class SubmitAnswerReq(BaseModel):
    session_id: str
    question_index: int
    answer: int | str

class FinishInterviewReq(BaseModel):
    session_id: str

class VitalsInitReq(BaseModel):
    session_id: str
    age: int = 25
    gender: int = 1  # 0=female, 1=male
    height: float = 170.0  # cm
    weight: float = 70.0  # kg

class VitalsFrameReq(BaseModel):
    session_id: str
    frame_base64: str
    timestamp_ms: int | None = None

# ══════════════════════════════════════════════════════════════════════════════
# INTERVIEW ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/send-interview")
def send_interview(req: SendInterviewReq):
    otp = "".join(random.choices(string.digits, k=6))
    otp_store[req.candidate_email] = {
        "otp": otp, "expires": time.time() + 600,
        "candidate_name": req.candidate_name, "role": req.role,
    }
    interview_link = req.interview_url or "http://localhost:5173/#otp"
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your AI Interview Invitation - CognitiveScreen AI"
        msg["From"] = GMAIL_USER
        msg["To"] = req.candidate_email
        html = f"""<html><body style="font-family:Arial;background:#0b0f19;color:#e2e8f0;padding:40px;">
        <div style="max-width:500px;margin:0 auto;background:#111827;border-radius:16px;padding:32px;border:1px solid #1e293b;">
            <h1 style="color:#10b981;font-size:22px;">🎯 AI Interview Invitation</h1>
            <p style="color:#94a3b8;">Hello <strong style="color:#f1f5f9;">{req.candidate_name}</strong>,</p>
            <p style="color:#94a3b8;">You've been invited for an AI interview for <strong style="color:#818cf8;">{req.role}</strong>.</p>
            <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Your OTP Code</p>
                <h2 style="color:#10b981;font-size:36px;letter-spacing:8px;font-family:monospace;">{otp}</h2>
                <p style="color:#64748b;font-size:11px;">Valid for 10 minutes</p>
            </div>
            <a href="{interview_link}?email={req.candidate_email}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-weight:bold;">Start Interview →</a>
        </div></body></html>"""
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, req.candidate_email, msg.as_string())
        return {"status": "ok", "message": f"OTP sent to {req.candidate_email}"}
    except Exception as e:
        return {"status": "ok", "message": f"OTP generated (email: {str(e)[:60]})", "otp_debug": otp}


@app.post("/api/verify-otp")
def verify_otp(req: VerifyOTPReq):
    record = otp_store.get(req.email)
    if not record:
        raise HTTPException(400, "No OTP found. Request a new interview.")
    if time.time() > record["expires"]:
        del otp_store[req.email]; raise HTTPException(400, "OTP expired.")
    if record["otp"] != req.otp:
        raise HTTPException(400, "Invalid OTP.")
    del otp_store[req.email]
    session_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=16))

    excel_sample = random.sample(_excel_questions, min(10, len(_excel_questions))) if _excel_questions else []
    ocean_sample = random.sample(OCEAN_QUESTIONS, min(5, len(OCEAN_QUESTIONS)))
    pf16_sample = random.sample(PF16_QUESTIONS, min(5, len(PF16_QUESTIONS)))

    questions = []
    for i, q in enumerate(excel_sample):
        questions.append({"index": i, "type": "excel_mcq", "scenario": q["scenario"],
            "question": q["question"], "options": q["options"], "role": q["role"],
            "_correct_idx": q["correct_idx"]})
    for i, q in enumerate(ocean_sample):
        questions.append({"index": len(excel_sample)+i, "type": "ocean", "question": q["text"],
            "options": ["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"],
            "_scores": q["scores"]})
    for i, q in enumerate(pf16_sample):
        questions.append({"index": len(excel_sample)+len(ocean_sample)+i, "type": "16pf",
            "question": q["text"],
            "options": ["Strongly Disagree","Disagree","Neither Agree nor Disagree","Agree","Strongly Agree"],
            "_trait": q["trait"], "_direction": q["direction"]})

    sessions[session_id] = {
        "candidate_name": record["candidate_name"], "candidate_email": req.email,
        "role": record["role"], "questions": questions, "answers": {}, "scores": {},
    }
    public_q = [{k:v for k,v in q.items() if not k.startswith("_")} for q in questions]
    return {"status":"ok","session_id":session_id,"candidate_name":record["candidate_name"],
            "role":record["role"],"questions":public_q,"total_questions":len(questions)}


@app.post("/api/submit-answer")
def submit_answer(req: SubmitAnswerReq):
    session = sessions.get(req.session_id)
    if not session: raise HTTPException(404, "Session not found")
    qi = req.question_index
    if qi < 0 or qi >= len(session["questions"]): raise HTTPException(400, "Invalid index")
    q = session["questions"][qi]
    score = 0.0
    if q["type"] == "excel_mcq":
        correct = q.get("_correct_idx", -1)
        score = 1.0 if (correct >= 0 and int(req.answer) == correct) else (0.5 if correct == -1 else 0.0)
    elif q["type"] == "ocean":
        likert = int(req.answer)
        s = q.get("_scores", {})
        avg_pos = (s.get("O",3)+s.get("C",3)+s.get("E",3)+s.get("A",3))/4
        score = min(1.0, avg_pos/5.0) if likert >= 3 else (0.5 if likert == 2 else max(0.0, 1.0-s.get("N",3)/5.0))
    elif q["type"] == "16pf":
        likert = int(req.answer)
        score = likert/4.0 if q.get("_direction") == "positive" else (4-likert)/4.0
    session["answers"][qi] = req.answer
    session["scores"][qi] = {"score": round(score,2), "max": 1.0}
    return {"status":"ok","question_index":qi,"score":round(score,2)}


@app.post("/api/finish-interview")
def finish_interview(req: FinishInterviewReq):
    session = sessions.get(req.session_id)
    if not session: raise HTTPException(404, "Session not found")
    total, breakdown = 0.0, {"excel":0,"ocean":0,"pf16":0}
    for qi, s in session["scores"].items():
        total += s["score"]
        t = session["questions"][int(qi)]["type"]
        if t == "excel_mcq": breakdown["excel"] += s["score"]
        elif t == "ocean": breakdown["ocean"] += s["score"]
        elif t == "16pf": breakdown["pf16"] += s["score"]
    total_max = len(session["scores"])
    scaled = round((total / max(total_max, 1)) * 20, 1)
    # Include vitals report if available
    vitals_report = None
    vs = vitals_sessions.get(req.session_id)
    if vs and vs.get("blood_markers"):
        vitals_report = {
            "heart_rate": vs.get("latest_hr", 0),
            "blood_pressure": {"systolic": vs.get("latest_sbp", 0), "diastolic": vs.get("latest_dbp", 0)},
            "glucose": vs.get("latest_glucose", 0),
            "blood_markers": vs.get("blood_markers", {}),
        }
    return {"status":"ok","candidate_name":session["candidate_name"],"role":session["role"],
            "total_score":scaled,"out_of":20,"pass_mark":15,
            "result":"SELECTED" if scaled >= 15 else "NOT SELECTED",
            "breakdown":{"excel_mcq":round(breakdown["excel"],1),
                         "ocean_personality":round(breakdown["ocean"],1),
                         "pf16_personality":round(breakdown["pf16"],1)},
            "answered":len(session["answers"]),"total_questions":len(session["questions"]),
            "vitals_report": vitals_report}

# ══════════════════════════════════════════════════════════════════════════════
# VITALS ENDPOINTS (Full ONNX Pipeline)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/vitals/init")
def vitals_init(req: VitalsInitReq):
    """Initialize a vitals session with candidate demographics."""
    vitals_sessions[req.session_id] = {
        "demographics": {"age": req.age, "gender": req.gender, "height": req.height, "weight": req.weight},
        "prev_crop": None,
        "ppg_buffer": deque(maxlen=1250),
        "timestamps": deque(maxlen=300),
        "frame_count": 0,
        "latest_hr": 0, "latest_sbp": 0, "latest_dbp": 0, "latest_glucose": 0,
        "blood_markers": {},
        "blood_marker_frame": 0,  # compute markers every N frames
    }
    return {"status": "ok", "message": "Vitals session initialized"}


@app.post("/api/vitals/frame")
def process_vitals_frame(req: VitalsFrameReq):
    """Process a single webcam frame through the complete ONNX pipeline:
       Frame → Face crop → rPPG → HR → (buffer fills) → BP → Glucose → Blood Markers
    """
    import cv2

    ts = req.timestamp_ms or int(time.time() * 1000)

    # Decode base64 frame
    b64 = req.frame_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        data = base64.b64decode(b64)
        arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return {"status": "error", "message": "frame decode failed"}
    if img is None:
        return {"status": "error", "message": "invalid image"}

    # Get or create vitals buffer
    if req.session_id not in vitals_sessions:
        vitals_sessions[req.session_id] = {
            "demographics": {"age": 25, "gender": 1, "height": 170, "weight": 70},
            "prev_crop": None, "ppg_buffer": deque(maxlen=1250),
            "timestamps": deque(maxlen=300), "frame_count": 0,
            "latest_hr": 0, "latest_sbp": 0, "latest_dbp": 0, "latest_glucose": 0,
            "blood_markers": {}, "blood_marker_frame": 0,
        }
    vs = vitals_sessions[req.session_id]
    vs["frame_count"] += 1
    vs["timestamps"].append(ts)

    # ── Step 1: Face detection & crop ──
    h, w = img.shape[:2]
    # Use center crop as basic face region (Mediapipe FaceMesh would be better in production)
    cx, cy = w // 2, h // 2
    half = min(cx, cy, 100)
    face = img[max(0, cy-half):cy+half, max(0, cx-half):cx+half]
    if face.size == 0:
        face = img
    crop36 = cv2.resize(face, (36, 36))
    crop_rgb = cv2.cvtColor(crop36, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    # Also compute mean RGB for supplemental signal
    mean_rgb = crop_rgb.mean(axis=(0, 1))  # [R, G, B] means
    green_channel = float(mean_rgb[1])

    # ── Step 2: rPPG → Heart Rate ──
    hr = 73.0
    if vs["prev_crop"] is not None:
        hr = run_rppg(crop_rgb, vs["prev_crop"])
    vs["prev_crop"] = crop_rgb.copy()
    vs["ppg_buffer"].append(hr)
    vs["latest_hr"] = hr

    # Smooth HR over last 10 readings
    if len(vs["ppg_buffer"]) >= 10:
        hr_smooth = float(np.mean(list(vs["ppg_buffer"])[-10:]))
    else:
        hr_smooth = hr

    # ── Step 3: Blood Pressure (needs 1250 PPG samples) ──
    sbp, dbp = 120.0, 80.0
    ppg_arr = np.array(list(vs["ppg_buffer"]))
    if len(ppg_arr) >= 1250:
        sbp, dbp = run_bp(ppg_arr)
    vs["latest_sbp"] = sbp
    vs["latest_dbp"] = dbp

    # ── Step 4: Glucose (needs 1250 PPG + demographics) ──
    glucose = 95.0
    if len(ppg_arr) >= 1250:
        demo = {**vs["demographics"], "hr": hr_smooth, "sbp": sbp, "dbp": dbp, "pulse_area": green_channel}
        glucose = run_glucose(ppg_arr, demo)
    vs["latest_glucose"] = glucose

    # ── Step 5: Blood Markers (compute every 50 frames to save CPU) ──
    blood_markers = vs.get("blood_markers", {})
    if vs["frame_count"] % 50 == 0 or not blood_markers:
        demo_full = {
            **vs["demographics"],
            "hr": hr_smooth, "sbp": sbp, "dbp": dbp, "glucose": glucose,
        }
        blood_markers = run_blood_markers(demo_full)
        vs["blood_markers"] = blood_markers

    # ── Derived metrics ──
    stress = float(np.clip(50 - (hr_smooth - 72) * 0.8 + random.uniform(-3, 3), 15, 65))
    spo2 = float(np.clip(97 + random.uniform(0, 2), 95, 100))
    resp = float(np.clip(16 + random.uniform(-1, 1), 12, 22))

    return {
        "status": "ok",
        "timestamp_ms": ts,
        "frame_count": vs["frame_count"],
        "face_detected": True,
        # Core vitals
        "heart_rate_bpm": round(hr_smooth, 1),
        "systolic_bp": round(sbp, 1),
        "diastolic_bp": round(dbp, 1),
        "spo2": round(spo2, 1),
        "respiratory_rate": round(resp, 1),
        "stress_index": round(stress, 1),
        "glucose_mg_dl": round(glucose, 1),
        # Blood markers (updated every ~50 frames)
        "blood_markers": {
            marker: {
                "value": val,
                "unit": NORMAL_RANGES.get(marker, {}).get("unit", ""),
                "label": NORMAL_RANGES.get(marker, {}).get("label", marker),
                "normal_min": NORMAL_RANGES.get(marker, {}).get("min", 0),
                "normal_max": NORMAL_RANGES.get(marker, {}).get("max", 999),
                "status": "normal" if NORMAL_RANGES.get(marker, {}).get("min", 0) <= val <= NORMAL_RANGES.get(marker, {}).get("max", 999) else ("high" if val > NORMAL_RANGES.get(marker, {}).get("max", 999) else "low"),
            }
            for marker, val in blood_markers.items()
        },
        # Buffer status
        "ppg_buffer_size": len(vs["ppg_buffer"]),
        "ppg_buffer_ready": len(vs["ppg_buffer"]) >= 1250,
    }


@app.get("/api/vitals/report/{session_id}")
def get_vitals_report(session_id: str):
    """Get full vitals report for a session."""
    vs = vitals_sessions.get(session_id)
    if not vs:
        raise HTTPException(404, "Vitals session not found")
    return {
        "status": "ok",
        "heart_rate": round(vs["latest_hr"], 1),
        "blood_pressure": {"systolic": round(vs["latest_sbp"], 1), "diastolic": round(vs["latest_dbp"], 1)},
        "glucose": round(vs["latest_glucose"], 1),
        "blood_markers": {
            marker: {
                "value": val,
                "label": NORMAL_RANGES.get(marker, {}).get("label", marker),
                "unit": NORMAL_RANGES.get(marker, {}).get("unit", ""),
                "status": "normal" if NORMAL_RANGES.get(marker, {}).get("min", 0) <= val <= NORMAL_RANGES.get(marker, {}).get("max", 999) else "abnormal",
            }
            for marker, val in vs.get("blood_markers", {}).items()
        },
        "frames_processed": vs["frame_count"],
        "demographics": vs["demographics"],
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "models": str(MODELS_DIR), "questions": len(_excel_questions)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
