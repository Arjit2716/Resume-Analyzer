import pickle
from groq import Groq
from ingest import extract_text_from_pdf
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

def ingest_resume(path, prefix):
    text = extract_text_from_pdf(path)
    with open(f"{prefix}_store.pkl", "wb") as f:
        pickle.dump({"text": text}, f)
    return text

def compare_resumes(resume1_path, resume2_path, jd_text):
    print("\n" + "="*50)
    print("⚔️  MULTI-RESUME COMPARISON")
    print("="*50)

    # Ingest both resumes
    text1 = ingest_resume(resume1_path, "r1")
    text2 = ingest_resume(resume2_path, "r2")

    prompt = f"""
You are a hiring manager comparing two candidates for a job.

Job Description:
{jd_text}

Resume 1:
{text1}

Resume 2:
{text2}

Compare them across:
1. JD Match Score (out of 100) for each
2. Strengths of Resume 1
3. Strengths of Resume 2
4. Weaknesses of each
5. Who is a better fit and why
6. Final Verdict: Resume 1 or Resume 2?
"""
    result = ask_claude(prompt)
    print(result)
    return result