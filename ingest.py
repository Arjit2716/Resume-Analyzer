import pdfplumber
from sentence_transformers import SentenceTransformer
import faiss, pickle, numpy as np

model = SentenceTransformer("all-MiniLM-L6-v2")

def extract_text_from_pdf(path):
    text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() + "\n"
    return text.strip()

def chunk_text(text, chunk_size=200):
    words = text.split()
    return [" ".join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]

def build_index(chunks):
    embeddings = model.encode(chunks)
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(np.array(embeddings))
    return index, embeddings

def ingest(resume_path, jd_text):
    resume_text = extract_text_from_pdf(resume_path)
    resume_chunks = chunk_text(resume_text)
    jd_chunks = chunk_text(jd_text)

    resume_index, _ = build_index(resume_chunks)
    jd_index, _     = build_index(jd_chunks)

    with open("resume_store.pkl", "wb") as f:
        pickle.dump({"chunks": resume_chunks, "text": resume_text}, f)
    with open("jd_store.pkl", "wb") as f:
        pickle.dump({"chunks": jd_chunks, "text": jd_text}, f)

    faiss.write_index(resume_index, "resume.index")
    faiss.write_index(jd_index, "jd.index")

    print("✅ Ingestion complete!")
    return resume_text, jd_text