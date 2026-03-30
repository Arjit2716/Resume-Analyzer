from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import shutil
import uvicorn
from pathlib import Path
from resume_analyzer import (
    ingest, match_jd, extract_skills, score_resume,
    suggest_improvements, compare_resumes, save_report,
    is_valid_resume, extract_text_from_pdf, ask_claude
)

app = FastAPI(title="Resume Analyzer", description="AI-powered resume analysis tool")

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for uploads and static files
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)

# Serve legacy static + uploads
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/reports", StaticFiles(directory="uploads"), name="reports")

# Serve React frontend build (if exists)
FRONTEND_DIR = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="frontend-assets")

templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    # Serve React frontend if built, otherwise fall back to Jinja template
    react_index = FRONTEND_DIR / "index.html"
    if react_index.exists():
        return FileResponse(str(react_index))
    return templates.TemplateResponse(request=request, name="index.html", context={"request": request})

@app.post("/analyze")
async def analyze_resume(
    request: Request,
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        resume_path = f"uploads/{resume.filename}"
        with open(resume_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)

        ingest(resume_path, job_description)

        resume_text = extract_text_from_pdf(resume_path)
        if not is_valid_resume(resume_text):
            raise ValueError("The uploaded document does not appear to be a resume.")

        results = {
            "JD Match Analysis": match_jd(),
            "Extracted Skills": extract_skills(),
            "Resume Score": score_resume(),
            "Improvement Suggestions": suggest_improvements(),
        }

        report_path = f"uploads/report_{os.path.splitext(resume.filename)[0]}.pdf"
        save_report(results, report_path)

        return templates.TemplateResponse(request=request, name="results.html", context={
            "request": request,
            "results": results,
            "resume_name": resume.filename,
            "report_path": report_path,
        })

    except Exception as e:
        return templates.TemplateResponse(request=request, name="error.html", context={
            "request": request,
            "error": str(e),
        })

@app.post("/compare")
async def compare_two_resumes(
    request: Request,
    resume1: UploadFile = File(...),
    resume2: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        resume1_path = f"uploads/{resume1.filename}"
        resume2_path = f"uploads/{resume2.filename}"

        with open(resume1_path, "wb") as buffer:
            shutil.copyfileobj(resume1.file, buffer)
        with open(resume2_path, "wb") as buffer:
            shutil.copyfileobj(resume2.file, buffer)

        r1_text = extract_text_from_pdf(resume1_path)
        if not is_valid_resume(r1_text):
            raise ValueError(f"The first document ({resume1.filename}) does not appear to be a valid resume.")

        r2_text = extract_text_from_pdf(resume2_path)
        if not is_valid_resume(r2_text):
            raise ValueError(f"The second document ({resume2.filename}) does not appear to be a valid resume.")

        comparison_result = compare_resumes(resume1_path, resume2_path, job_description)

        return templates.TemplateResponse(request=request, name="comparison.html", context={
            "request": request,
            "result": comparison_result,
            "resume1_name": resume1.filename,
            "resume2_name": resume2.filename,
        })

    except Exception as e:
        return templates.TemplateResponse(request=request, name="error.html", context={
            "request": request,
            "error": str(e),
        })

# ─── JSON API ENDPOINTS FOR REACT FRONTEND ──────────────────

def parse_json_from_ai(raw_text):
    """Try to parse JSON from AI response text."""
    import re
    text = raw_text.strip()
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    try:
        return json.loads(text)
    except:
        return None

@app.post("/api/validate")
async def api_validate(resume: UploadFile = File(...)):
    try:
        resume_path = f"uploads/{resume.filename}"
        with open(resume_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)

        text = extract_text_from_pdf(resume_path)
        if not text or len(text.strip()) < 80:
            return JSONResponse({
                "is_resume": False, "confidence": 100,
                "detected_as": "Empty PDF",
                "reason": "No readable text found. The PDF may be blank or contain only images.",
                "found_sections": [], "text": ""
            })

        raw = ask_claude(f"""You are an expert document classifier. Analyze this text extracted from a PDF and determine if it is a resume or CV.

Classification Rules:
- A resume/CV MUST have at least 2 of: person's name, contact info, work experience, education, skills section
- NOT a resume: research papers, invoices, book chapters, articles, manuals, forms, legal documents, reports, essays, assignments, lecture notes
- Be LENIENT: rough drafts, student resumes with only education + projects, career changers with non-traditional formats — all count as resumes
- If in doubt, classify as a resume

Reply ONLY with JSON, no extra text:
{{"is_resume":true/false,"confidence":0-100,"detected_as":"resume/research_paper/invoice/etc","reason":"one detailed sentence explaining your classification","found_sections":["list of sections found like Name, Contact, Education, Experience, Skills, Projects, etc"]}}

TEXT:
{text[:5000]}""")

        result = parse_json_from_ai(raw)
        if not result:
            result = {"is_resume": True, "confidence": 50, "detected_as": "Unknown", "reason": "Classification unavailable.", "found_sections": []}

        result["text"] = text
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/analyze")
async def api_analyze(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        resume_path = f"uploads/{resume.filename}"
        with open(resume_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)

        text = extract_text_from_pdf(resume_path)

        raw = ask_claude(f"""You are an elite resume analyst at a top recruiting firm. Perform an extremely thorough analysis of this resume against the job description.

IMPORTANT: You MUST reply with ONLY valid JSON. No markdown, no explanation, no code fences.

RESUME:
{text[:6000]}

JOB DESCRIPTION:
{job_description[:2000]}

Analysis criteria:
- Match score should consider: direct keyword matches, semantic similarity, experience level alignment, industry relevance
- Skills extraction must be exhaustive — look in project descriptions, not just skills sections
- Score breakdown must use these rubrics:
  * content_quality: action verbs + quantified achievements = high; vague descriptions = low
  * skill_relevance: modern in-demand skills demonstrated through projects = high; outdated/unlisted = low
  * experience_clarity: clear progression + specific accomplishments = high; vague roles = low
  * ats_friendliness: clean format + standard sections + keywords = high; fancy formatting = low
- Priority improvements must reference SPECIFIC content from the resume and suggest CONCRETE rewrites
- ATS tips should include specific keywords to add based on the JD

Reply with this exact JSON structure:
{{
  "overall_score": <0-100>,
  "jd_match": {{
    "score": <0-100>,
    "matched_skills": ["every matched skill from JD found in resume"],
    "missing_skills": ["every JD requirement NOT in resume"],
    "summary": "3-4 detailed sentences about fit, strengths, and critical gaps"
  }},
  "skills": {{
    "technical": ["all programming languages, frameworks, tools"],
    "soft": ["communication, leadership, etc - only if demonstrated"],
    "domain": ["industry areas like ML, FinTech, etc"],
    "certifications": ["any certifications or courses"]
  }},
  "score_breakdown": {{
    "content_quality": <0-25>,
    "skill_relevance": <0-25>,
    "experience_clarity": <0-25>,
    "ats_friendliness": <0-25>
  }},
  "improvements": {{
    "priority": ["5 specific, actionable fixes - reference actual resume content and suggest concrete rewrites"],
    "ats": ["3-4 specific ATS optimization tips with exact keywords to add"]
  }},
  "verdict": "A specific, honest assessment of this candidate's competitiveness - mention their strongest asset and biggest gap"
}}""")

        result = parse_json_from_ai(raw)
        if not result:
            return JSONResponse({"error": "Could not parse analysis. Please try again."}, status_code=500)

        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/compare")
async def api_compare(
    resume1: UploadFile = File(...),
    resume2: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        r1_path = f"uploads/{resume1.filename}"
        r2_path = f"uploads/{resume2.filename}"
        with open(r1_path, "wb") as buffer:
            shutil.copyfileobj(resume1.file, buffer)
        with open(r2_path, "wb") as buffer:
            shutil.copyfileobj(resume2.file, buffer)

        t1 = extract_text_from_pdf(r1_path)
        t2 = extract_text_from_pdf(r2_path)

        raw = ask_claude(f"""You are a senior hiring manager making a final candidate selection. Provide a thorough, data-driven, fair comparison.

IMPORTANT: Reply with ONLY valid JSON. No markdown, no explanation, no code fences.

JOB DESCRIPTION:
{job_description[:2000]}

CANDIDATE A ({resume1.filename}):
{t1[:4000]}

CANDIDATE B ({resume2.filename}):
{t2[:4000]}

Comparison criteria:
- Score each candidate's JD match considering skills, experience level, and domain relevance
- Strengths must reference SPECIFIC accomplishments from their resumes
- Weaknesses must identify SPECIFIC gaps relative to the JD
- Winner reasoning must be thorough and fair

Reply with this exact JSON structure:
{{
  "candidate_a": {{"score":<0-100>,"strengths":["3-4 specific strengths citing their actual experience"],"weaknesses":["2-3 specific gaps relative to JD"]}},
  "candidate_b": {{"score":<0-100>,"strengths":["3-4 specific strengths citing their actual experience"],"weaknesses":["2-3 specific gaps relative to JD"]}},
  "winner": "A" or "B",
  "winner_reason": "3-4 detailed sentences explaining the decision with specific evidence from both resumes",
  "verdict": "Final one-line hiring recommendation with confidence level"
}}""")
        result = parse_json_from_ai(raw)
        if not result:
            return JSONResponse({"error": "Could not parse comparison. Please try again."}, status_code=500)

        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/compare-multiple")
async def api_compare_multiple(
    resumes: list[UploadFile] = File(...),
    job_description: str = Form(...)
):
    try:
        if len(resumes) < 2:
            return JSONResponse({"error": "Please upload at least 2 resumes to compare."}, status_code=400)
        if len(resumes) > 10:
            return JSONResponse({"error": "Maximum 10 resumes can be compared at once."}, status_code=400)

        candidates = []
        for i, resume in enumerate(resumes):
            path = f"uploads/multi_{i}_{resume.filename}"
            with open(path, "wb") as buffer:
                shutil.copyfileobj(resume.file, buffer)
            text = extract_text_from_pdf(path)
            candidates.append({"name": resume.filename, "text": text, "label": chr(65 + i)})

        candidate_blocks = ""
        for c in candidates:
            candidate_blocks += f"\nCANDIDATE {c['label']} ({c['name']}):\n{c['text'][:3000]}\n"

        labels = [c['label'] for c in candidates]
        labels_str = ", ".join([f'"{l}"' for l in labels])

        rankings_template = ", ".join([
            f'{{"label":"{c["label"]}","name":"{c["name"]}","score":<0-100>,"rank":<1-N>,"strengths":["2-3 key strengths"],"weaknesses":["1-2 key gaps"],"summary":"one sentence assessment"}}'
            for c in candidates
        ])

        raw = ask_claude(f"""You are a senior hiring manager ranking {len(candidates)} candidates for a position.

IMPORTANT: Reply with ONLY valid JSON. No markdown, no explanation, no code fences.

JOB DESCRIPTION:
{job_description[:2000]}
{candidate_blocks}

Evaluation criteria:
- Score each candidate 0-100 based on JD match (skills, experience, domain relevance)
- Rank from best (#1) to worst (#{len(candidates)})
- Strengths and weaknesses must reference SPECIFIC content from each candidate's resume
- Be fair and thorough

Reply with this exact JSON structure:
{{
  "rankings": [{rankings_template}],
  "best_candidate": {{
    "label": "winner letter",
    "reason": "3-4 sentences explaining why this candidate is the best fit with specific evidence"
  }},
  "verdict": "Final one-line hiring recommendation",
  "comparison_notes": "2-3 sentences about the overall quality of this candidate pool and any notable patterns"
}}""")

        result = parse_json_from_ai(raw)
        if not result:
            return JSONResponse({"error": "Could not parse multi-comparison. Please try again."}, status_code=500)

        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
