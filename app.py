from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import shutil
from typing import Optional
import uvicorn

app = FastAPI(title="Resume Analyzer", description="AI-powered resume analysis tool")

# Create directories for uploads and static files
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/reports", StaticFiles(directory="uploads"), name="reports")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/analyze")
async def analyze_resume(
    request: Request,
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        # Import modules here to avoid loading models at startup
        from ingest import ingest, extract_text_from_pdf
        from analyze import match_jd, extract_skills, score_resume, suggest_improvements
        from report import save_report

        # Save uploaded resume
        resume_path = f"uploads/{resume.filename}"
        with open(resume_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)

        # Run analysis pipeline
        ingest(resume_path, job_description)

        results = {}
        results["JD Match Analysis"] = match_jd()
        results["Extracted Skills"] = extract_skills()
        results["Resume Score"] = score_resume()
        results["Improvement Suggestions"] = suggest_improvements()

        # Save report
        report_path = f"uploads/report_{os.path.splitext(resume.filename)[0]}.txt"
        save_report(results, report_path)

        return templates.TemplateResponse("results.html", {
            "request": request,
            "results": results,
            "resume_name": resume.filename,
            "report_path": report_path
        })

    except Exception as e:
        return templates.TemplateResponse("error.html", {
            "request": request,
            "error": str(e)
        })

@app.post("/compare")
async def compare_two_resumes(
    request: Request,
    resume1: UploadFile = File(...),
    resume2: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        # Import modules here to avoid loading models at startup
        from compare import compare_resumes

        # Save uploaded resumes
        resume1_path = f"uploads/{resume1.filename}"
        resume2_path = f"uploads/{resume2.filename}"

        with open(resume1_path, "wb") as buffer:
            shutil.copyfileobj(resume1.file, buffer)

        with open(resume2_path, "wb") as buffer:
            shutil.copyfileobj(resume2.file, buffer)

        # Run comparison
        comparison_result = compare_resumes(resume1_path, resume2_path, job_description)

        return templates.TemplateResponse("comparison.html", {
            "request": request,
            "result": comparison_result,
            "resume1_name": resume1.filename,
            "resume2_name": resume2.filename
        })

    except Exception as e:
        return templates.TemplateResponse("error.html", {
            "request": request,
            "error": str(e)
        })

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)