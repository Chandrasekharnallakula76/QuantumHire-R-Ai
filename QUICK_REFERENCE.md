# 🚀 QUICK REFERENCE GUIDE

## START HERE (30 seconds)

### 1. Install & Run
```bash
# Terminal 1: Backend
pip install -r "requirements (3).txt"
python "main (2).py"

# Terminal 2: Frontend
npm install
npm run dev
```

### 2. Open Browser
- HR Dashboard: http://localhost:5173
- OTP Page: http://localhost:5173/#otp
- Interview: http://localhost:5173/#interview

---

## 📋 WHAT'S INTEGRATED

| Component | Status | Location |
|-----------|--------|----------|
| OTP Verification | ✅ | `src/components/OTPVerification.tsx` |
| HR Dashboard | ✅ | `src/components/HRDashboard.tsx` |
| Interview Screen | ✅ | `src/components/interview/InterviewScreen.tsx` |
| Excel Questions | ✅ | `NuggetChallengePack.xlsx` (150+ Q) |
| OCEAN Questions | ✅ | Backend (20+ Q) |
| 16PF Questions | ✅ | Backend (30+ Q) |
| ONNX Models | ✅ | `Models/` (12 models) |
| Backend API | ✅ | `main (2).py` (8 endpoints) |
| Gmail OTP | ✅ | Configured |
| ElevenLabs Voice | ✅ | Configured |

---

## 🎯 WORKFLOW

```
HR Dashboard
    ↓
Send Interview Link
    ↓
Candidate receives OTP email
    ↓
OTP Verification Page
    ↓
Enter OTP
    ↓
Interview Starts (20 Questions)
    ├─ 10 Excel MCQs
    ├─ 5 OCEAN Personality
    └─ 5 16PF Behavioral
    ↓
Real-time Scoring
    ↓
Final Result (out of 20)
    ├─ SELECTED (≥15)
    └─ NOT SELECTED (<15)
```

---

## 📊 SCORING

| Type | Questions | Max Points | Scoring |
|------|-----------|-----------|---------|
| Excel MCQ | 10 | 10 | 1.0 (correct), 0.5 (no answer), 0.0 (wrong) |
| OCEAN | 5 | 5 | Likert 1-5 with trait scoring |
| 16PF | 5 | 5 | Likert 1-5 with direction scoring |
| **Total** | **20** | **20** | **Pass: ≥15** |

---

## 🔧 KEY FILES

### Frontend
- `src/App.tsx` - Routing (HR → OTP → Interview)
- `src/components/OTPVerification.tsx` - OTP entry
- `src/components/HRDashboard.tsx` - Send interview
- `src/components/interview/InterviewScreen.tsx` - Main interview

### Backend
- `main (2).py` - FastAPI server with all endpoints
- `NuggetChallengePack.xlsx` - Excel questions
- `Models/` - ONNX models (12 total)

### Config
- `.env` - Environment variables
- `requirements (3).txt` - Python dependencies
- `package.json` - Node dependencies

---

## 🌐 API ENDPOINTS

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/send-interview` | Send OTP via email |
| POST | `/api/verify-otp` | Verify OTP & get questions |
| POST | `/api/submit-answer` | Submit answer & get score |
| POST | `/api/finish-interview` | Get final results |
| POST | `/api/vitals/init` | Initialize vitals session |
| POST | `/api/vitals/frame` | Process webcam frame |
| GET | `/api/vitals/report` | Get vitals report |
| GET | `/api/health` | Health check |

---

## 📧 EMAIL SETUP

**From:** notification.aiinterview@gmail.com
**Password:** qmqmoyzdjffzamsa
**OTP:** 6-digit code, 10-minute expiry
**Template:** Professional HTML design

---

## 🎤 VOICE SETUP

**Provider:** ElevenLabs
**API Key:** sk_05dc65f617d450f4c90bdbc29dba3925e05533504478d06c
**Voice ID:** 7FroLDTDG92jPfUW6BlQ (Kabir)
**Model:** eleven_turbo_v2_5 (lowest latency)
**Fallback:** Browser SpeechSynthesis

---

## 💊 VITALS MONITORING

**Real-time Metrics:**
- Heart Rate (bpm)
- Blood Pressure (systolic/diastolic)
- Stress Level (%)
- Attention Score (%)
- Glucose (mg/dL)
- SpO2 (%)
- Respiratory Rate (breaths/min)

**Blood Markers (9 total):**
- Total Cholesterol
- HDL Cholesterol
- LDL Cholesterol
- VLDL Cholesterol
- Triglycerides
- HbA1c
- HOMA-IR
- TSH
- Thyroid Flag

---

## 🐛 COMMON ISSUES

| Issue | Solution |
|-------|----------|
| Backend won't start | `pip install -r "requirements (3).txt"` |
| Excel file not found | Ensure `NuggetChallengePack.xlsx` in root |
| Models not loading | Extract `Models.zip` |
| OTP not sending | Check `.env` Gmail credentials |
| Frontend won't connect | Ensure backend running on :8000 |
| CORS errors | Backend has CORS enabled |

---

## 📱 TEST CREDENTIALS

**Email:** test@example.com
**Name:** John Doe
**Role:** Software Engineer
**OTP:** Check email or debug message

---

## 🎓 QUESTION SOURCES

### Excel MCQ (10 random)
- File: `NuggetChallengePack.xlsx`
- Sheet: "Benchmark Chapters Data"
- Total: 150+ questions
- Topics: Various roles & challenges

### OCEAN (5 random)
- Traits: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- Total: 20+ questions
- Scoring: Personality trait averages

### 16PF (5 random)
- Traits: Warmth, Dominance, Sensitivity, Social Boldness, etc.
- Total: 30+ questions
- Scoring: Trait direction (positive/negative)

---

## 📈 PERFORMANCE METRICS

| Metric | Value |
|--------|-------|
| Questions per interview | 20 |
| Max score | 20 |
| Pass mark | 15 |
| OTP validity | 10 minutes |
| Vitals update frequency | 2 seconds |
| Models loaded | 12 ONNX |
| Endpoints | 8 |
| Data files | 3 |

---

## 🚀 DEPLOYMENT

### Local
```bash
python "main (2).py"
npm run dev
```

### Production
```bash
# Backend
gunicorn -w 4 -b 0.0.0.0:8000 main:app

# Frontend
npm run build
npm run preview
```

### Docker
```bash
docker build -t cognitivescreen .
docker run -p 8000:8000 -p 5173:5173 cognitivescreen
```

---

## 📞 SUPPORT

1. Check `SETUP_GUIDE.md` for detailed setup
2. Check `INTEGRATION_CHECKLIST.md` for verification
3. Check `INTEGRATION_STATUS.md` for status
4. Review error logs in terminal
5. Check browser console for frontend errors

---

## ✅ READY TO GO!

All components are integrated and ready for:
- ✅ Local testing
- ✅ Development
- ✅ Staging
- ✅ Production

**Start with:** `python "main (2).py"` + `npm run dev`

