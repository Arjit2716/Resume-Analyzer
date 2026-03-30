import pdfplumber
import pickle

def extract_text_from_pdf(path):
    text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text += page_text + "\n"
    return text.strip()

def ingest(resume_path, jd_text):
    resume_text = extract_text_from_pdf(resume_path)

    with open("resume_store.pkl", "wb") as f:
        pickle.dump({"text": resume_text}, f)
    with open("jd_store.pkl", "wb") as f:
        pickle.dump({"text": jd_text}, f)

    print("✅ Ingestion complete!")
    return resume_text, jd_text