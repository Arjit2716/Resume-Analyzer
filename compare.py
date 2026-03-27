import faiss, pickle
from groq import Groq
from sentence_transformers import SentenceTransformer
from ingest import extract_text_from_pdf, chunk_text, build_index
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

def ingest_resume(path, prefix):
    text = extract_text_from_pdf(path)
    chunks = chunk_text(text)
    index, _ = build_index(chunks)
    faiss.write_index(index, f"{prefix}.index")
    with open(f"{prefix}_store.pkl", "wb") as f:
        pickle.dump({"chunks": chunks, "text": text}, f)
    return text

def retrieve(query, index_path, store_path, k=3):
    index = faiss.read_index(index_path)
    with open(store_path, "rb") as f:
        store = pickle.load(f)
    q_embed = model.encode([query])
    _, indices = index.search(np.array(q_embed), k)
    return [store["chunks"][i] for i in indices[0]]

def compare_resumes(resume1_path, resume2_path, jd_text):
    print("\n" + "="*50)
    print("⚔️  MULTI-RESUME COMPARISON")
    print("="*50)

    # Ingest both resumes
    text1 = ingest_resume(resume1_path, "r1")
    text2 = ingest_resume(resume2_path, "r2")

    # Retrieve relevant chunks from each
    r1_chunks = retrieve("skills experience projects", "r1.index", "r1_store.pkl")
    r2_chunks = retrieve("skills experience projects", "r2.index", "r2_store.pkl")

    prompt = f"""
You are a hiring manager comparing two candidates for a job.

Job Description:
{jd_text}

Resume 1 Excerpts:
{chr(10).join(r1_chunks)}

Resume 2 Excerpts:
{chr(10).join(r2_chunks)}

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