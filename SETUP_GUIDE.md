# CognitiveScreen AI - Complete Setup & Testing Guide

## 📦 PROJECT STRUCTURE

```
CognitiveScreen AI/
├── src/
│   ├── components/
│   │   ├── interview/
│   │   │   ├── InterviewScreen.tsx      ✅ Main interview page
│   │   │   ├── ChatRoom.tsx             ✅ Chat interface
│   │   │   ├── VitalsPanel.tsx          ✅ Live vitals display
│   │   │   ├── MiddlePanel.tsx          ✅ Video & notes
│   │   │   ├── Header.tsx               ✅ Timer & controls
│   │   │   ├── SummaryModal.tsx         ✅ Results display
│   │   │   └── types.ts                 ✅ TypeScript types
│   │   ├── OTPVerification.tsx          ✅ OTP entry page
│   │   ├── HRDashboard.tsx              ✅ HR send interview page
│   │   └── theme-provider.tsx           ✅ Theme setup
│   ├── onnx/
│   │   └── onnx.ts                      ✅ ONNX model initialization
│   ├── App.tsx                          ✅ Main app with routing
│   └── main.tsx                         ✅ React entry point
├── Models/                              ✅ ONNX models (extracted)
│   ├── Rppg/                            ✅ Heart rate detection
│   ├── bp/                              ✅ Blood pressure
│   ├── glucose/                         ✅ Glucose estimation
│   ├── chol_total/                      ✅ Total cholesterol
│   ├── hdl/                             ✅ HDL cholesterol
│   ├── ldl/                             ✅ LDL cholesterol
│   ├── vldl/                            ✅ VLDL cholesterol
│   ├── triglycerides/                   ✅ Triglycerides
│   ├── hba1c/                           ✅ HbA1c
│   ├── homa_ir/                         ✅ HOMA-IR
│   ├── tsh/                             ✅ TSH
│   └── thyroid_flag/                    ✅ Thyroid flag
├── main (2).py                          ✅ FastAPI backend
├── NuggetChallengePack.xlsx             ✅ Excel MCQ questions
├── ocean.txt                            ✅ OCEAN personality questions
├── sixteenpf.txt                        ✅ 16PF behavioral questions
├── requirements (3).txt                 ✅ Python dependencies
├── package.json                         ✅ Node dependencies
├── .env                                 ✅ Environment variables
├── .env.example                         ✅ Environment template
└── INTEGRATION_STATUS.md                ✅ Integration checklist
```

---

## 🚀 QUICK START (5 MINUTES)

### Step 1: Install Dependencies

**Python:**
```bash
pip install -r "requirements (3).txt"
```

**Node.js:**
```bash
npm install
```

### Step 2: Verify .env File

Check that `.env` exists with these values:
```
GMAIL_USER=notification.aiinterview@gmail.com
GMAIL_APP_PASSWORD=qmqmoyzdjffzamsa
ELEVENLABS_API_KEY=sk_05dc65f617d450f4c90bdbc29dba3925e05533504478d06c
ELEVENLABS_VOICE_ID=7FroLDTDG92jPfUW6BlQ
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
VITE_API_URL=http://localhost:8000
```

### Step 3: Start Backend

```bash
python "main (2).py"
```

Expected output:
```
✅ Loaded 150+ Excel questions
✅ Loaded OCEAN questions
✅ Loaded 16PF questions
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 4: Start Frontend (New Terminal)

```bash
npm run dev
```

Expected output:
```
VITE v7.3.1  ready in 234 ms

➜  Local:   http://localhost:5173/
```

### Step 5: Access Application

- **HR Dashboard:** http://localhost:5173
- **OTP Page:** http://localhost:5173/#otp
- **Interview:** http://localhost:5173/#interview

---

## 🧪 TESTING WORKFLOW

### Test 1: HR Dashboard → Send Interview

1. Open http://localhost:5173
2. Fill in:
   - Candidate Name: "John Doe"
   - Candidate Email: "test@example.com"
   - Role: "Software Engineer"
3. Click "Send Interview Link"
4. Expected: "OTP sent to test@example.com" (or debug OTP shown)

### Test 2: OTP Verification

1. Open http://localhost:5173/#otp?email=test@example.com
2. Click "Send OTP" (if not auto-sent)
3. Enter OTP from email or debug message
4. Click "Verify & Start Interview"
5. Expected: Interview page loads with 20 questions

### Test 3: Interview Flow

1. Interview page shows:
   - Left: Vitals panel (HR, BP, Glucose, etc.)
   - Center: Video stream + notes
   - Right: Chat interface
2. Questions appear in chat
3. Answer all 20 questions:
   - 10 Excel MCQs (select option)
   - 5 OCEAN personality (Likert 1-5)
   - 5 16PF behavioral (Likert 1-5)
4. Click "End Call"
5. Expected: Summary modal shows:
   - Total Score (out of 20)
   - Result (SELECTED ≥15 or NOT SELECTED <15)
   - Breakdown by question type

### Test 4: Vitals Monitoring

1. During interview, vitals panel should show:
   - Heart Rate: 70-90 bpm
   - Blood Pressure: 120/80 mmHg
   - Stress Level: 15-65%
   - Attention Score: 88-98%
   - Glucose: 80-120 mg/dL
   - Blood Markers: Cholesterol, HDL, LDL, etc.
2. Values update every 2 seconds
3. Waveform bars animate

### Test 5: API Endpoints

**Health Check:**
```bash
curl http://localhost:8000/api/health
```

**Send Interview:**
```bash
curl -X POST http://localhost:8000/api/send-interview \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "test@example.com",
    "candidate_name": "John Doe",
    "role": "Software Engineer",
    "interview_url": "http://localhost:5173"
  }'
```

**Verify OTP:**
```bash
curl -X POST http://localhost:8000/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

---

## 📊 QUESTION BANK DETAILS

### Excel MCQ (10 random from 150+)
- Source: `NuggetChallengePack.xlsx`
- Sheet: "Benchmark Chapters Data"
- Columns: Role, Challenge, Scenario, Title, Question, Options
- Scoring: 1.0 (correct), 0.5 (no answer), 0.0 (wrong)

### OCEAN Personality (5 random from 20+)
- Source: Hardcoded in backend
- Traits: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- Scoring: Based on trait averages and Likert response

### 16PF Behavioral (5 random from 30+)
- Source: Hardcoded in backend
- Traits: Warmth, Dominance, Sensitivity, Social Boldness, etc.
- Scoring: Based on trait direction (positive/negative) and Likert response

---

## 🔐 SECURITY NOTES

### Gmail Configuration
- App Password (not regular password) required
- 2FA must be enabled on Gmail account
- OTP valid for 10 minutes only
- OTP stored in memory (not persistent)

### ElevenLabs API
- API key has rate limits
- Fallback to browser SpeechSynthesis if API fails
- Voice ID: 7FroLDTDG92jPfUW6BlQ (Kabir voice)

### ONNX Models
- All processing happens locally (no cloud)
- Models loaded on startup
- Face detection uses center crop (basic)
- Production should use Mediapipe FaceMesh

---

## 🐛 TROUBLESHOOTING

### Backend won't start
```
Error: ModuleNotFoundError: No module named 'openpyxl'
Solution: pip install -r "requirements (3).txt"
```

### Excel file not found
```
Error: FileNotFoundError: NuggetChallengePack.xlsx
Solution: Ensure file is in project root directory
```

### Models not loading
```
Error: Model not found: Models/Rppg/rppg_model.onnx
Solution: Extract Models.zip (already done)
```

### OTP not sending
```
Error: SMTP authentication failed
Solution: Check GMAIL_USER and GMAIL_APP_PASSWORD in .env
```

### Frontend won't connect to backend
```
Error: Cannot reach server
Solution: Ensure backend is running on http://localhost:8000
```

### CORS errors
```
Error: Access to XMLHttpRequest blocked by CORS policy
Solution: Backend has CORS enabled for all origins (*)
```

---

## 📈 SCORING CALCULATION

### Total Score Formula
```
Total Score = (Sum of all question scores / Total questions) × 20
            = (Sum of all question scores / 20) × 20
            = Sum of all question scores
```

### Example Calculation
```
Excel MCQ (10 questions):
  - Q1: 1.0 (correct)
  - Q2: 0.0 (wrong)
  - Q3: 1.0 (correct)
  - Q4: 0.5 (no answer)
  - Q5-Q10: 1.0 each
  Subtotal: 8.5 points

OCEAN (5 questions):
  - Q11-Q15: Average 0.9 each
  Subtotal: 4.5 points

16PF (5 questions):
  - Q16-Q20: Average 0.8 each
  Subtotal: 4.0 points

Total: 8.5 + 4.5 + 4.0 = 17.0 / 20
Result: SELECTED (≥15)
```

---

## 🎯 NEXT STEPS

1. ✅ Test all workflows locally
2. ✅ Verify email delivery
3. ✅ Check vitals monitoring
4. ✅ Validate scoring logic
5. 🔄 Deploy to staging
6. 🔄 Load testing
7. 🔄 Production deployment

---

## 📞 SUPPORT

For issues or questions:
1. Check INTEGRATION_STATUS.md
2. Review error logs in terminal
3. Verify .env configuration
4. Check API endpoints with curl
5. Review browser console for frontend errors

