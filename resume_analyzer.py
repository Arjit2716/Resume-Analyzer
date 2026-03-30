import os
import pickle
from datetime import datetime
from dotenv import load_dotenv
from dotenv import load_dotenv
from groq import Groq
import pdfplumber

load_dotenv()

_client_groq = None

DEFAULT_JD_TEXT = """
We are looking for a Python Developer with experience in:
- Machine Learning and Deep Learning
- REST APIs using FastAPI or Flask
- SQL and NoSQL databases
- Cloud platforms (AWS/GCP)
- Strong communication and teamwork skills
"""


def get_client_groq():
    global _client_groq
    if _client_groq is None:
        _client_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client_groq


def ask_claude(prompt, max_tokens=2000):
    client = get_client_groq()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are an elite resume analyst and career coach with 15+ years of experience in talent acquisition at top tech companies (Google, Meta, Amazon). You provide extremely detailed, actionable, and insightful analysis. Always be thorough and specific — never give generic or vague advice. Reference specific content from the resume when making points."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    return response.choices[0].message.content


def is_valid_resume(text):
    if not text or len(text.strip()) < 20:
        return False
        
    prompt = f"""
Analyze the following document text and determine if it resembles a resume, curriculum vitae (CV), professional portfolio, or career profile.
Be extremely lenient. Even if it is just a rough text document, a draft containing some work/education history, or a list of skills, consider it valid.
Answer strictly with 'Yes' unless it is completely unrelated (e.g. a recipe or a fictional story).

Document:
{text[:5000]}
"""
    try:
        response = ask_claude(prompt)
        # If response mentions yes or we are unsure, let it pass to allow testing
        if response and ("yes" in response.lower() or "resume" in response.lower() or "true" in response.lower()):
            return True
        # If we get a strict No, reject it
        if response and "no" in response.lower() and "yes" not in response.lower():
            return False
        return True # Default to pass if the LLM is confusing or refuses
    except Exception as e:
        print(f"Validation API error (bypassing): {e}")
        return True # Default to true if rate limits or API fails during check


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

    return resume_text, jd_text


def match_jd():
    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]
    with open("jd_store.pkl", "rb") as f:
        jd_text = pickle.load(f)["text"]

    prompt = f"""
Perform a thorough JD-to-Resume match analysis.

=== RESUME ===
{resume_text}

=== JOB DESCRIPTION ===
{jd_text}

Analyze and provide ALL of the following:

1. **MATCH SCORE (0-100)**: Rate how well this resume fits the JD. Consider:
   - Direct keyword matches (exact skill names)
   - Semantic matches (similar technologies/concepts)
   - Experience level alignment
   - Industry/domain relevance
   - Educational fit

2. **MATCHED SKILLS & KEYWORDS**: List every skill, technology, qualification, or keyword from the JD that IS present in the resume. Group by category (Technical, Domain, Soft Skills, Tools).

3. **MISSING SKILLS & KEYWORDS**: List every requirement from the JD that is NOT found or weakly represented in the resume. Rank by importance (Critical / Important / Nice-to-have).

4. **EXPERIENCE ALIGNMENT**: Does the candidate's years and type of experience match what the JD asks for? Be specific.

5. **KEYWORD DENSITY ANALYSIS**: Which important JD keywords appear multiple times vs. only once vs. not at all?

6. **OVERALL FIT SUMMARY**: 3-4 sentences on how well this candidate matches, their biggest strengths for this role, and the most critical gap to address.

7. **RECOMMENDATION**: Would you shortlist this candidate? (Strong Yes / Lean Yes / Borderline / Lean No / Strong No) with reasoning.
"""
    return ask_claude(prompt)


def suggest_improvements():
    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]

    prompt = f"""
You are a senior resume coach who has helped 5000+ professionals land roles at top companies. Analyze this resume and provide deeply specific, actionable improvement suggestions.

Resume:
{resume_text}

Provide ALL of the following:

1. **CONTENT IMPROVEMENTS**:
   - Identify 3-5 bullet points that use weak language and rewrite them with strong action verbs + quantified results
   - Example: Change "Worked on a team project" → "Led a cross-functional team of 8 engineers to deliver a $2M revenue feature 3 weeks ahead of schedule"
   - Point out any vague statements and suggest specific replacements

2. **STRUCTURE & FORMATTING**:
   - Is the resume in the optimal section order for this candidate's career stage?
   - Are bullet points concise (1-2 lines) or too wordy?
   - Is there proper use of white space, consistent formatting, and clear hierarchy?
   - Recommended section order for this specific candidate

3. **MISSING SECTIONS**:
   - What important sections are absent? (Summary, Projects, Publications, Volunteer, Awards)
   - Suggest what to add and where to place it

4. **ATS OPTIMIZATION**:
   - Are there formatting issues that could break ATS parsing? (tables, columns, graphics, headers/footers)
   - Is the file likely in a parseable format?
   - Are skills listed in a way that ATS systems can detect?
   - Suggest specific keywords to add based on the resume's target role

5. **IMPACT & METRICS**:
   - Count how many bullet points include quantified results (numbers, percentages, dollar amounts)
   - What percentage of bullets have metrics? (Target: 60%+)
   - Suggest where metrics could be added

6. **TOP 5 PRIORITY FIXES** (ranked by impact on getting interviews):
   - Be extremely specific — reference exact lines or sections from the resume
   - Explain WHY each fix matters
"""
    return ask_claude(prompt)


def extract_skills():
    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]

    prompt = f"""
Perform a comprehensive skill extraction from this resume. Be thorough — extract EVERY skill mentioned, whether explicit or implied from project descriptions.

Resume:
{resume_text}

Extract and categorize ALL skills into these categories:

1. **PROGRAMMING LANGUAGES**: Every language mentioned or implied (e.g., Python, Java, C++, JavaScript, SQL, R, etc.)

2. **FRAMEWORKS & LIBRARIES**: All frameworks, libraries, and SDKs (e.g., React, Django, TensorFlow, Spring Boot, etc.)

3. **TOOLS & PLATFORMS**: DevOps tools, cloud platforms, databases, IDEs, version control (e.g., AWS, Docker, Git, PostgreSQL, Jenkins, etc.)

4. **METHODOLOGIES**: Development methodologies, practices (e.g., Agile, Scrum, CI/CD, TDD, Microservices, REST API design)

5. **SOFT SKILLS**: Leadership, communication, teamwork, problem-solving — only include those clearly demonstrated through experience descriptions, not just listed

6. **DOMAIN KNOWLEDGE**: Industry-specific knowledge areas (e.g., Machine Learning, FinTech, Healthcare IT, E-commerce, Data Analytics)

7. **CERTIFICATIONS & COURSES**: All certifications, online courses, training programs mentioned

8. **SKILL PROFICIENCY ASSESSMENT**: For the top 10 most prominent skills, rate the candidate's likely proficiency level based on context clues:
   - Expert (5+ years or lead/architect role)
   - Advanced (3-5 years or significant project work)
   - Intermediate (1-3 years or supporting role)
   - Beginner (mentioned once or in coursework)

Format as clean, organized lists with clear headers.
"""
    return ask_claude(prompt)


def score_resume():
    with open("resume_store.pkl", "rb") as f:
        resume_text = pickle.load(f)["text"]

    prompt = f"""
You are a meticulous resume evaluator. Score this resume with detailed justification for each score.

Resume:
{resume_text}

Score across these 4 dimensions (0-25 each, total 100):

1. **CONTENT QUALITY (0-25)**:
   Scoring criteria:
   - 20-25: Strong action verbs, quantified achievements (numbers, %, $), clear impact statements, compelling summary
   - 15-19: Some metrics, decent verbs, but could be more specific
   - 10-14: Generic descriptions, few metrics, weak verbs ("responsible for", "helped with")
   - 0-9: Vague, no metrics, poor grammar, irrelevant content
   Give score and cite 2-3 specific examples from the resume supporting your rating.

2. **SKILL RELEVANCE (0-25)**:
   Scoring criteria:
   - 20-25: Modern, in-demand skills clearly demonstrated through projects; good skill diversity
   - 15-19: Relevant skills present but not well-demonstrated through experience
   - 10-14: Some outdated skills, missing key modern technologies
   - 0-9: Skills barely mentioned or completely outdated
   Give score and explain which skills stand out and which are lacking.

3. **EXPERIENCE CLARITY (0-25)**:
   Scoring criteria:
   - 20-25: Clear progression, well-defined roles, specific accomplishments per role, dates included
   - 15-19: Roles are clear but accomplishments are vague or missing context
   - 10-14: Confusing timeline, unclear responsibilities, gaps unexplained
   - 0-9: Disorganized, no clear career narrative
   Give score and explain the career story this resume tells.

4. **ATS FRIENDLINESS (0-25)**:
   Scoring criteria:
   - 20-25: Clean formatting, standard sections, skill keywords present, no tables/graphics/columns that break parsing
   - 15-19: Mostly ATS-friendly with minor issues
   - 10-14: Some formatting problems, missing standard sections
   - 0-9: Heavy formatting, non-standard layout, graphics-heavy
   Give score and list specific ATS concerns.

Finally provide:
- **TOTAL SCORE: X/100**
- **GRADE**: A+ (95-100), A (90-94), B+ (85-89), B (80-84), C+ (75-79), C (70-74), D (60-69), F (<60)
- **ONE-LINE VERDICT**: A punchy summary of this resume's quality
- **BIGGEST STRENGTH**: What this resume does best
- **BIGGEST WEAKNESS**: The #1 thing holding this resume back
"""
    return ask_claude(prompt)


def ingest_resume(path, prefix):
    text = extract_text_from_pdf(path)
    with open(f"{prefix}_store.pkl", "wb") as f:
        pickle.dump({"text": text}, f)
    return text


def compare_resumes(resume1_path, resume2_path, jd_text):
    ingest_resume(resume1_path, "r1")
    ingest_resume(resume2_path, "r2")

    with open("r1_store.pkl", "rb") as f:
        r1_text = pickle.load(f)["text"]
    with open("r2_store.pkl", "rb") as f:
        r2_text = pickle.load(f)["text"]

    prompt = f"""
You are a senior hiring manager making a final decision between two candidates. Provide a thorough, fair, and data-driven comparison.

Job Description:
{jd_text}

Resume 1:
{r1_text}

Resume 2:
{r2_text}

Analyze and compare across ALL these dimensions:

1. **JD MATCH SCORE** (out of 100) for each candidate — with brief reasoning

2. **SKILLS COMPARISON TABLE**:
   - Skills both candidates share
   - Skills only Resume 1 has
   - Skills only Resume 2 has
   - Which candidate has more JD-relevant skills?

3. **EXPERIENCE COMPARISON**:
   - Years of relevant experience for each
   - Quality and relevance of their most impactful role
   - Career progression trajectory

4. **STRENGTHS** of each candidate (at least 3 each) — be specific, reference their actual experience

5. **WEAKNESSES** of each candidate (at least 2 each) — cite specific gaps

6. **CULTURE & TEAM FIT INDICATORS**: Based on their experience types, what kind of team/environment does each candidate seem suited for?

7. **RISK ASSESSMENT**: What's the risk of hiring each candidate? (overqualified? underqualified? flight risk? steep learning curve?)

8. **FINAL VERDICT**:
   - Winner: Resume 1 or Resume 2
   - Margin: Clear winner / Slight edge / Very close
   - Reasoning: 3-4 sentences explaining why
   - Under what circumstances would you pick the other candidate instead?
"""
    return ask_claude(prompt)


def save_report(results: dict, output_path="report.pdf"):
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    pdf.set_font("helvetica", style="B", size=16)
    pdf.cell(0, 10, "RESUME ANALYZER -- FULL REPORT", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("helvetica", size=10)
    pdf.cell(0, 10, f"Generated: {timestamp}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(10)
    
    for section, content in results.items():
        pdf.set_font("helvetica", style="B", size=14)
        safe_section = str(section).upper().encode("ascii", "ignore").decode("ascii")
        pdf.cell(0, 10, safe_section, new_x="LMARGIN", new_y="NEXT")
        
        pdf.set_font("helvetica", size=11)
        safe_content = str(content) if content else "(no content)"
        safe_content = safe_content.encode("ascii", "ignore").decode("ascii")
        pdf.multi_cell(0, 6, safe_content, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(5)
        
    pdf.output(output_path)
    return output_path


def main(
    resume1_path="data/resume1.pdf",
    resume2_path="data/resume2.pdf",
    jd_text=None,
    output_path="resume_report.txt",
):
    if jd_text is None:
        jd_text = DEFAULT_JD_TEXT

    ingest(resume1_path, jd_text)

    results = {
        "JD Match Analysis": match_jd(),
        "Extracted Skills": extract_skills(),
        "Resume Score": score_resume(),
        "Improvement Suggestions": suggest_improvements(),
    }

    if resume2_path and os.path.exists(resume2_path):
        results["Multi-Resume Comparison"] = compare_resumes(resume1_path, resume2_path, jd_text)

    save_report(results, output_path)
    return results


if __name__ == "__main__":
    main()
