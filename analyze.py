import faiss, pickle
from groq import Groq
from sentence_transformers import SentenceTransformer
import numpy as np
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

model = SentenceTransformer("all-MiniLM-L6-v2")
client_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
def ask_claude(prompt):
    response = client_groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000
    )
    return response.choices[0].message.content

def retrieve(query, index_path, store_path, k=3):
    index = faiss.read_index(index_path)
    with open(store_path, "rb") as f:
        store = pickle.load(f)
    q_embed = model.encode([query])
    _, indices = index.search(np.array(q_embed), k)
    return [store["chunks"][i] for i in indices[0]]

# ── 1. JD Match ──────────────────────────────────────────────
def match_jd():
    print("\n" + "="*50)
    print("📋 JOB DESCRIPTION MATCH ANALYSIS")
    print("="*50)

    resume_chunks = retrieve("skills experience projects", "resume.index", "resume_store.pkl")
    jd_chunks     = retrieve("required skills qualifications", "jd.index", "jd_store.pkl")

    prompt = f"""
You are a resume expert. Compare the resume with the job description.

Resume Excerpts:
{chr(10).join(resume_chunks)}

Job Description Excerpts:
{chr(10).join(jd_chunks)}

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

    resume_chunks = retrieve("experience education projects achievements", "resume.index", "resume_store.pkl")

    prompt = f"""
You are a professional resume coach.

Resume Excerpts:
{chr(10).join(resume_chunks)}

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

    resume_chunks = retrieve("skills technologies tools programming", "resume.index", "resume_store.pkl")

    prompt = f"""
Extract all skills from the resume excerpts below.

Resume Excerpts:
{chr(10).join(resume_chunks)}

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

    resume_chunks = retrieve("experience education projects skills", "resume.index", "resume_store.pkl")

    prompt = f"""
You are a strict resume evaluator. Score this resume.

Resume Excerpts:
{chr(10).join(resume_chunks)}

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