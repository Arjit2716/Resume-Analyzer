import pickle
from groq import Groq
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

client_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
def ask_claude(prompt):
    response = client_groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000
    )
    return response.choices[0].message.content

# ── 1. JD Match ──────────────────────────────────────────────
def match_jd():
    print("\n" + "="*50)
    print("📋 JOB DESCRIPTION MATCH ANALYSIS")
    print("="*50)

    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]
    with open("jd_store.pkl", "rb") as f:
        jd_text = pickle.load(f)["text"]

    prompt = f"""
You are a resume expert. Compare the resume with the job description.

Resume:
{resume_text}

Job Description:
{jd_text}

Provide:
1. Match Score (out of 100)
2. Matched Skills/Keywords
3. Missing Skills/Keywords
4. Overall fit summary (2-3 lines)
"""
    result = ask_claude(prompt)
    print(result)
    return result

# ── 2. Improvement Suggestions ───────────────────────────────
def suggest_improvements():
    print("\n" + "="*50)
    print("💡 IMPROVEMENT SUGGESTIONS")
    print("="*50)

    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]

    prompt = f"""
You are a professional resume coach.

Resume:
{resume_text}

Give specific improvement suggestions:
1. Content improvements (action verbs, quantified achievements)
2. Structure/formatting tips
3. Missing sections (if any)
4. ATS optimization tips
5. Top 3 priority fixes
"""
    result = ask_claude(prompt)
    print(result)
    return result

# ── 3. Skill Extraction ───────────────────────────────────────
def extract_skills():
    print("\n" + "="*50)
    print("🛠️  EXTRACTED SKILLS")
    print("="*50)

    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]

    prompt = f"""
Extract all skills from the resume below.

Resume:
{resume_text}

Categorize into:
1. Technical Skills (languages, frameworks, tools)
2. Soft Skills
3. Domain Knowledge
4. Certifications / Courses

Format as a clean list.
"""
    result = ask_claude(prompt)
    print(result)
    return result

# ── 4. Resume Score ───────────────────────────────────────────
def score_resume():
    print("\n" + "="*50)
    print("⭐ RESUME SCORE")
    print("="*50)

    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]

    prompt = f"""
You are a strict resume evaluator. Score this resume.

Resume:
{resume_text}

Score out of 100 across these dimensions:
1. Content Quality (0-25)
2. Skill Relevance (0-25)
3. Experience Clarity (0-25)
4. ATS Friendliness (0-25)

Give:
- Individual scores
- Total score
- One-line verdict
"""
    result = ask_claude(prompt)
    print(result)
    return result