from ingest import ingest
from analyze import match_jd, suggest_improvements, extract_skills, score_resume
from compare import compare_resumes
from report import save_report

# ── Config ────────────────────────────────────────────────────
RESUME1_PATH = "data/resume1.pdf"
RESUME2_PATH = "data/resume2.pdf"   # optional, for comparison

JD_TEXT = """
We are looking for a Python Developer with experience in:
- Machine Learning and Deep Learning
- REST APIs using FastAPI or Flask
- SQL and NoSQL databases
- Cloud platforms (AWS/GCP)
- Strong communication and teamwork skills
"""

# ── Run ───────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🚀 Starting Resume Analyzer...")

    # Step 1: Ingest resume1 + JD
    ingest(RESUME1_PATH, JD_TEXT)

    # Step 2: Individual analysis (resume1)
    results = {}
    results["JD Match Analysis"]       = match_jd()
    results["Extracted Skills"]        = extract_skills()
    results["Resume Score"]            = score_resume()
    results["Improvement Suggestions"] = suggest_improvements()

    # Step 3: Compare two resumes
    results["Multi-Resume Comparison"] = compare_resumes(
        RESUME1_PATH, RESUME2_PATH, JD_TEXT
    )

    # Step 4: Export full report
    save_report(results, output_path="resume_report.txt")

    print("\n✅ All done!")