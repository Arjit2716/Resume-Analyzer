# ResumeIX — AI-Powered Resume Analyzer

Upload a resume PDF, paste a job description, and get instant AI-powered analysis with match scores, skill extraction, and improvement suggestions.

## Features

- **Resume Validation** — AI checks if your upload is actually a resume before analyzing
- **JD Match Scoring** — Semantic match score with matched & missing skills
- **4D Score Breakdown** — Content quality, skill relevance, experience clarity, ATS friendliness (each /25)
- **Smart Suggestions** — Prioritized fixes with concrete rewrite examples
- **Multi Compare** — Upload 2–10 resumes and get a ranked leaderboard
- **PDF Report** — Download a styled dark-themed analysis report

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| Backend | Python / FastAPI |
| AI | Groq API (Llama 3.3 70B) |
| PDF | jsPDF (client) + fpdf2 (server) |

## Quick Start

```bash
# Clone
git clone https://github.com/Arjit2716/Resume-Analyzer.git
cd Resume-Analyzer

# Backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt

# Add your API key
echo GROQ_API_KEY=your_key_here > .env

# Run
python app.py
```

Open **http://localhost:8001** — the React frontend is pre-built and served automatically.

## Deploy (Render.com)

1. Push to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
3. Connect your repo, set:
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Add env var: `GROQ_API_KEY`
5. Deploy ✓

## Author

**Arjit Gupta** — [arjit.2716@gmail.com](mailto:arjit.2716@gmail.com)
