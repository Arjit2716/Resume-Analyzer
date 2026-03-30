import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────
const C = {
    bg: "#07070f",
    bgCard: "#0d0d1a",
    bgInput: "#0a0a16",
    bgTerminal: "#040409",
    border: "#1a1a32",
    borderHi: "#2e2e58",
    accent: "#00ff88",
    accentLow: "rgba(0,255,136,0.10)",
    accentMid: "rgba(0,255,136,0.20)",
    text: "#dde4f0",
    muted: "#4a5568",
    dim: "#8899aa",
    danger: "#ff4560",
    dangerLow: "rgba(255,69,96,0.10)",
    warn: "#f5a623",
    warnLow: "rgba(245,166,35,0.10)",
};

const font = "'JetBrains Mono','Fira Code','Courier New',monospace";

// ─────────────────────────────────────────────
// GLOBAL CSS
// ─────────────────────────────────────────────
const GlobalCSS = () => (
    <style>{`
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:${C.bg};color:${C.text};font-family:${font};}
    ::-webkit-scrollbar{width:6px;}
    ::-webkit-scrollbar-track{background:${C.bg};}
    ::-webkit-scrollbar-thumb{background:${C.borderHi};border-radius:3px;}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .fade-in{animation:fadeIn 0.35s ease forwards;}
    .btn-primary{
      padding:10px 24px;background:${C.accent};color:#000;border:none;
      border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;
      font-family:${font};letter-spacing:0.5px;transition:opacity 0.2s,transform 0.1s;
    }
    .btn-primary:hover{opacity:0.85;}
    .btn-primary:active{transform:scale(0.97);}
    .btn-primary:disabled{opacity:0.3;cursor:not-allowed;}
    .btn-outline{
      padding:10px 24px;background:transparent;color:${C.accent};
      border:1px solid ${C.accent};border-radius:4px;font-size:12px;
      font-weight:600;cursor:pointer;font-family:${font};letter-spacing:0.5px;
      transition:background 0.2s,transform 0.1s;
    }
    .btn-outline:hover{background:${C.accentLow};}
    .btn-outline:active{transform:scale(0.97);}
    .btn-ghost{
      padding:6px 14px;background:transparent;color:${C.dim};
      border:1px solid ${C.border};border-radius:4px;font-size:11px;
      cursor:pointer;font-family:${font};transition:all 0.2s;
    }
    .btn-ghost:hover{border-color:${C.borderHi};color:${C.text};}
    input[type=file]{display:none;}
    textarea{
      width:100%;background:${C.bgInput};border:1px solid ${C.border};
      border-radius:4px;color:${C.text};font-size:12px;padding:10px 14px;
      font-family:${font};outline:none;resize:vertical;
      transition:border-color 0.2s;line-height:1.6;
    }
    textarea:focus{border-color:${C.accent};}
    textarea::placeholder{color:${C.muted};}
  `}</style>
);

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function loadScript(src) {
    return new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) return res();
        const s = document.createElement("script");
        s.src = src; s.onload = res; s.onerror = () => rej(new Error("Failed to load: " + src));
        document.head.appendChild(s);
    });
}

async function extractPDFText(file) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const lib = window["pdfjs-dist/build/pdf"];
    lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    let out = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
        const pg = await pdf.getPage(i);
        const ct = await pg.getTextContent();
        out += ct.items.map((x) => x.str).join(" ") + "\n";
    }
    return out.trim();
}

async function callClaude(userMsg, system = "", maxTokens = 1500) {
    const body = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages: [{ role: "user", content: userMsg }] };
    if (system) body.system = system;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Claude API error ${r.status}`);
    const d = await r.json();
    return d.content?.[0]?.text || "";
}

function parseJSON(raw) {
    try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { return null; }
}

async function validateResume(text) {
    const raw = await callClaude(
        `Analyze this text extracted from a PDF. Determine if it is a resume/CV.

A resume/CV has: person name, contact info, work experience, education, skills.
NOT a resume: research paper, invoice, book chapter, article, manual, form, legal doc, report.

Reply ONLY with JSON, no extra text:
{"is_resume":true/false,"confidence":0-100,"detected_as":"label","reason":"one sentence","found_sections":["list"]}

TEXT:
${text.slice(0, 3500)}`, "", 300
    );
    return parseJSON(raw) ?? { is_resume: true, confidence: 50, detected_as: "Unknown", reason: "Classification unavailable.", found_sections: [] };
}

async function analyzeResume(resumeText, jdText) {
    const raw = await callClaude(
        `You are an expert resume analyst. Analyze the resume against the job description.

RESUME:
${resumeText.slice(0, 4000)}

JOB DESCRIPTION:
${jdText.slice(0, 1500)}

Reply ONLY with valid JSON, no markdown fences:
{
  "overall_score": <0-100>,
  "jd_match": {
    "score": <0-100>,
    "matched_skills": ["skill"],
    "missing_skills": ["skill"],
    "summary": "2-3 sentences"
  },
  "skills": {
    "technical": ["skill"],
    "soft": ["skill"],
    "domain": ["area"],
    "certifications": ["cert"]
  },
  "score_breakdown": {
    "content_quality": <0-25>,
    "skill_relevance": <0-25>,
    "experience_clarity": <0-25>,
    "ats_friendliness": <0-25>
  },
  "improvements": {
    "priority": ["fix1","fix2","fix3"],
    "ats": ["tip1","tip2"]
  },
  "verdict": "one strong sentence about this candidate"
}`, "", 1500
    );
    const result = parseJSON(raw);
    if (!result) throw new Error("Could not parse analysis. Please try again.");
    return result;
}

async function compareResumesAPI(t1, t2, jd, n1, n2) {
    const raw = await callClaude(
        `You are a hiring manager comparing two candidates.

JOB DESCRIPTION:
${jd.slice(0, 1200)}

CANDIDATE A (${n1}):
${t1.slice(0, 2500)}

CANDIDATE B (${n2}):
${t2.slice(0, 2500)}

Reply ONLY with valid JSON, no markdown:
{
  "candidate_a": {"score":<0-100>,"strengths":["s1","s2","s3"],"weaknesses":["w1","w2"]},
  "candidate_b": {"score":<0-100>,"strengths":["s1","s2","s3"],"weaknesses":["w1","w2"]},
  "winner": "A" or "B",
  "winner_reason": "2-3 sentences",
  "verdict": "final one-line recommendation"
}`, "", 900
    );
    const result = parseJSON(raw);
    if (!result) throw new Error("Could not parse comparison. Please try again.");
    return result;
}

// ─────────────────────────────────────────────
// PDF REPORT
// ─────────────────────────────────────────────
async function downloadPDFReport(data) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, H = 297, M = 16, CW = W - M * 2;
    let y = 0;

    const pg = () => {
        doc.addPage();
        doc.setFillColor("#07070f"); doc.rect(0, 0, W, H, "F");
        doc.setFillColor("#00ff88"); doc.rect(0, 0, 2, H, "F");
        y = 16;
    };
    const chk = (n = 16) => { if (y + n > H - 12) pg(); };
    const hd = (txt, icon) => {
        chk(14);
        doc.setFillColor("#0d0d1a"); doc.roundedRect(M, y, CW, 8.5, 1.5, 1.5, "F");
        doc.setDrawColor("#1a1a32"); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 8.5, 1.5, 1.5, "S");
        doc.setFont("courier", "bold"); doc.setFontSize(8); doc.setTextColor("#00ff88");
        doc.text(`${icon}  ${txt.toUpperCase()}`, M + 3, y + 5.8); y += 12;
    };
    const ln = (txt, col = "#8899aa", ind = 0) => {
        const lines = doc.splitTextToSize(txt, CW - ind - 3);
        lines.forEach((l) => { chk(5); doc.setFont("courier", "normal"); doc.setFontSize(7.5); doc.setTextColor(col); doc.text(l, M + 2 + ind, y); y += 4.8; });
    };
    const br = (lbl, pct) => {
        chk(10); const col = pct >= 80 ? "#00ff88" : pct >= 60 ? "#f5a623" : "#ff4560";
        doc.setFont("courier", "normal"); doc.setFontSize(7.5);
        doc.setTextColor("#4a5568"); doc.text(lbl, M + 2, y);
        doc.setTextColor(col); doc.text(`${pct}%`, W - M - 9, y); y += 3.5;
        doc.setFillColor("#1a1a32"); doc.roundedRect(M + 2, y, CW - 12, 2, 1, 1, "F");
        doc.setFillColor(col); doc.roundedRect(M + 2, y, Math.max(1.5, (CW - 12) * pct / 100), 2, 1, 1, "F"); y += 5.5;
    };
    const gap = (n = 4) => { y += n; };

    const a = data.analysis;
    const bd = a.score_breakdown;

    // Cover
    doc.setFillColor("#07070f"); doc.rect(0, 0, W, H, "F");
    doc.setFillColor("#00ff88"); doc.rect(0, 0, 2, H, "F");
    doc.setFillColor("#0d0d1a"); doc.rect(2, 0, W - 2, 48, "F");
    y = 20;
    doc.setFont("courier", "bold"); doc.setFontSize(7); doc.setTextColor("#4a5568");
    doc.text("RESUMEIQ  ·  AI-POWERED RESUME INTELLIGENCE", M + 4, y); y += 10;
    doc.setFontSize(22); doc.setTextColor("#dde4f0"); doc.text("Analysis Report", M + 4, y); y += 9;
    doc.setFontSize(9); doc.setTextColor("#00ff88"); doc.text("Powered by Claude AI", M + 4, y); y += 16;
    doc.setDrawColor("#1a1a32"); doc.setLineWidth(0.4); doc.line(M + 4, y, W - M, y); y += 8;
    doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor("#4a5568");
    doc.text("Resume:", M + 4, y); doc.setTextColor("#dde4f0"); doc.text(data.name, M + 22, y); y += 5.5;
    doc.text("Generated:", M + 4, y); doc.setTextColor("#dde4f0"); doc.text(new Date().toLocaleString(), M + 22, y); y += 18;
    doc.setFillColor("#0d0d1a"); doc.roundedRect(M + 4, y, 52, 34, 3, 3, "F");
    doc.setDrawColor("#00ff88"); doc.setLineWidth(0.4); doc.roundedRect(M + 4, y, 52, 34, 3, 3, "S");
    doc.setFont("courier", "bold"); doc.setFontSize(26); doc.setTextColor("#00ff88"); doc.text(`${a.overall_score}`, M + 13, y + 22);
    doc.setFontSize(6.5); doc.setTextColor("#4a5568"); doc.text("OVERALL / 100", M + 7, y + 30); y += 44;
    doc.setFillColor("#1a1a32"); doc.roundedRect(M + 4, y, 95, 2.2, 1, 1, "F");
    doc.setFillColor("#00ff88"); doc.roundedRect(M + 4, y, Math.max(2, a.overall_score * 0.95), 2.2, 1, 1, "F"); y += 7;
    doc.setFont("courier", "normal"); doc.setFontSize(7); doc.setTextColor("#4a5568"); doc.text("OVERALL CONFIDENCE INDICATOR", M + 4, y);

    // Page 2
    pg();
    hd("JD Match Analysis", "◈");
    br(`JD Match Score`, a.jd_match.score);
    gap(2);
    ln("Matched Skills:", "#4a5568");
    a.jd_match.matched_skills.forEach((s) => ln(`  + ${s}`, "#00ff88"));
    gap(3);
    ln("Missing Skills:", "#4a5568");
    a.jd_match.missing_skills.forEach((s) => ln(`  - ${s}`, "#ff4560"));
    gap(3);
    ln("Summary:", "#4a5568");
    ln(a.jd_match.summary, "#8899aa");
    gap(6);

    hd("Score Breakdown", "◆");
    br(`Content Quality  (${bd.content_quality}/25)`, Math.round(bd.content_quality / 25 * 100));
    br(`Skill Relevance  (${bd.skill_relevance}/25)`, Math.round(bd.skill_relevance / 25 * 100));
    br(`Experience Clarity  (${bd.experience_clarity}/25)`, Math.round(bd.experience_clarity / 25 * 100));
    br(`ATS Friendliness  (${bd.ats_friendliness}/25)`, Math.round(bd.ats_friendliness / 25 * 100));
    gap(3); ln(`Verdict: ${a.verdict}`, "#dde4f0"); gap(6);

    hd("Extracted Skills", "◉");
    ln("Technical: " + a.skills.technical.join(", "), "#dde4f0");
    gap(2);
    ln("Soft Skills: " + a.skills.soft.join(", "), "#8899aa");
    gap(2);
    ln("Domain: " + a.skills.domain.join(", "), "#8899aa");
    gap(2);
    ln("Certifications: " + (a.skills.certifications.join(", ") || "None listed"), "#8899aa");
    gap(6);

    hd("Improvement Suggestions", "◇");
    ln("Priority Fixes:", "#4a5568");
    a.improvements.priority.forEach((p, i) => ln(`  ${i + 1}. ${p}`, "#dde4f0"));
    gap(3);
    ln("ATS Tips:", "#4a5568");
    (a.improvements.ats || []).forEach((t) => ln(`  · ${t}`, "#8899aa"));

    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFont("courier", "normal"); doc.setFontSize(6.5); doc.setTextColor("#1a1a32");
        doc.text(`${p} / ${total}`, W - M - 6, H - 5);
    }
    doc.save(`ResumeIQ_${data.name.replace(/\.pdf$/i, "")}.pdf`);
}

// ─────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────
const Card = ({ children, style = {}, highlight = false }) => (
    <div style={{ background: C.bgCard, border: `1px solid ${highlight ? C.accent : C.border}`, borderRadius: 8, padding: 24, ...style }}>
        {children}
    </div>
);

const SectionLabel = ({ children, color = C.accent }) => (
    <div style={{ fontSize: 10, color: C.muted, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color }}>▸</span>{children}
    </div>
);

const FieldLabel = ({ children }) => (
    <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>{children}</div>
);

function Terminal({ lines }) {
    const ref = useRef();
    useEffect(() => { ref.current && (ref.current.scrollTop = ref.current.scrollHeight); }, [lines]);
    return (
        <div ref={ref} style={{ background: C.bgTerminal, border: `1px solid ${C.border}`, borderRadius: 6, padding: "14px 16px", fontSize: 11, lineHeight: 2, maxHeight: 200, overflowY: "auto" }}>
            {lines.map((l, i) => (
                <div key={i} style={{ color: l.type === "success" ? C.accent : l.type === "error" ? C.danger : l.type === "warn" ? C.warn : l.type === "active" ? C.text : C.muted }}>
                    <span style={{ marginRight: 8, color: l.type === "success" ? C.accent : l.type === "error" ? C.danger : l.type === "active" ? C.accent : C.muted }}>
                        {l.type === "success" ? "✓" : l.type === "error" ? "✕" : l.type === "active" ? "▶" : " "}
                    </span>
                    {l.msg}
                </div>
            ))}
            <span style={{ color: C.accent, animation: "blink 1s infinite" }}>█</span>
        </div>
    );
}

function ScoreBar({ label, score, max = 100 }) {
    const pct = Math.round((score / max) * 100);
    const col = pct >= 80 ? C.accent : pct >= 60 ? C.warn : C.danger;
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: C.dim }}>{label}</span>
                <span style={{ color: col, fontWeight: 700 }}>{score}<span style={{ color: C.muted, fontWeight: 400 }}>/{max}</span></span>
            </div>
            <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 3, transition: "width 0.9s ease" }} />
            </div>
        </div>
    );
}

function Chip({ label, color = "green" }) {
    const map = { green: [C.accentLow, C.accent], red: [C.dangerLow, C.danger], yellow: [C.warnLow, C.warn], gray: ["rgba(74,85,104,0.15)", C.dim] };
    const [bg, fg] = map[color] ?? map.gray;
    return (
        <span style={{ display: "inline-block", padding: "3px 9px", fontSize: 10, fontWeight: 700, letterSpacing: "0.4px", borderRadius: 3, background: bg, color: fg, border: `1px solid ${fg}`, margin: "0 5px 5px 0" }}>
            {label}
        </span>
    );
}

function Collapsible({ title, icon, children, open: defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14, overflow: "hidden" }} className="fade-in">
            <div onClick={() => setOpen(!open)} style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderBottom: open ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "1px", textTransform: "uppercase" }}>{icon} {title}</span>
                <span style={{ color: C.muted, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
            </div>
            {open && <div style={{ padding: "18px 20px" }}>{children}</div>}
        </div>
    );
}

function UploadBox({ label, file, onFile, id }) {
    const [drag, setDrag] = useState(false);
    const ref = useRef();
    const drop = useCallback((e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f?.type === "application/pdf") onFile(f);
    }, [onFile]);
    return (
        <div style={{ marginBottom: 18 }}>
            <FieldLabel>{label}</FieldLabel>
            <div
                onClick={() => ref.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={drop}
                style={{ border: `2px dashed ${drag ? C.accent : file ? C.borderHi : C.border}`, borderRadius: 6, padding: "26px 20px", textAlign: "center", cursor: "pointer", background: drag ? C.accentLow : "transparent", transition: "all 0.2s" }}
            >
                {file ? (
                    <>
                        <div style={{ fontSize: 22, color: C.accent, marginBottom: 6 }}>✓</div>
                        <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{file.name}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · click to change</div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 26, color: C.muted, marginBottom: 8 }}>⬆</div>
                        <div style={{ fontSize: 12, color: C.dim }}>Drop PDF or click to browse</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>PDF only · max 10 MB</div>
                    </>
                )}
                <input ref={ref} type="file" id={id} accept=".pdf" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────
function Navbar({ page, onNav }) {
    const active = (k) => page === k || (page === "results" && k === "analyze") || (page === "compare-results" && k === "compare");
    return (
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,7,15,0.96)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
            <div onClick={() => onNav("home")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 30, height: 30, background: C.accentLow, border: `1px solid ${C.accent}`, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.accent }}>▣</div>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, lineHeight: 1.1 }}>ResumeIQ</div>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "1.5px" }}>AI ENGINE</div>
                </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
                {[["home", "Home"], ["analyze", "Analyze"], ["compare", "Compare"]].map(([k, lbl]) => (
                    <button key={k} onClick={() => onNav(k)} style={{ padding: "5px 13px", fontSize: 11, border: `1px solid ${active(k) ? C.accent : C.border}`, borderRadius: 3, background: active(k) ? C.accentLow : "transparent", color: active(k) ? C.accent : C.muted, cursor: "pointer", fontFamily: font, transition: "all 0.2s" }}>
                        {lbl}
                    </button>
                ))}
            </div>
        </nav>
    );
}

// ─────────────────────────────────────────────
// LANDING
// ─────────────────────────────────────────────
function Landing({ onNav }) {
    const [typed, setTyped] = useState("");
    const target = "> claude: validating resume.pdf... confirmed resume · score: 89/100 · downloading report...";
    useEffect(() => {
        let i = 0;
        const t = setInterval(() => { setTyped(target.slice(0, ++i)); if (i >= target.length) clearInterval(t); }, 36);
        return () => clearInterval(t);
    }, []);

    return (
        <div>
            <div style={{ textAlign: "center", padding: "5rem 1.5rem 2.5rem", maxWidth: 720, margin: "0 auto" }}>
                <div style={{ display: "inline-block", padding: "3px 12px", border: `1px solid ${C.accent}`, borderRadius: 2, fontSize: 10, color: C.accent, letterSpacing: "2px", marginBottom: 20 }}>
                    AI · RESUME · INTELLIGENCE
                </div>
                <h1 style={{ fontSize: "clamp(1.8rem,5vw,3rem)", fontWeight: 800, lineHeight: 1.15, marginBottom: 16, background: `linear-gradient(135deg,${C.text} 20%,${C.accent} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    Analyze. Validate.<br />Optimize Your Resume.
                </h1>
                <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.8, maxWidth: 500, margin: "0 auto 32px" }}>
                    Upload your resume PDF, paste a job description, and get a full Claude AI breakdown — match score, skill gaps, and smart improvement suggestions.
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
                    <button className="btn-primary" onClick={() => onNav("analyze")}>Analyze Resume →</button>
                    <button className="btn-outline" onClick={() => onNav("compare")}>Compare Candidates</button>
                </div>
                <div style={{ background: C.bgTerminal, border: `1px solid ${C.border}`, borderRadius: 6, padding: "12px 16px", fontSize: 11, color: C.accent, textAlign: "left", maxWidth: 580, margin: "0 auto" }}>
                    <span style={{ color: C.muted }}>$ </span>{typed}<span style={{ animation: "blink 1s infinite" }}>█</span>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, maxWidth: 620, margin: "0 auto 3.5rem", padding: "0 1.5rem" }}>
                {[["AI Validated", "Every upload first"], ["Real Analysis", "Claude AI powered"], ["4D Scoring", "Full breakdown"], ["PDF Export", "Download report"]].map(([n, l]) => (
                    <div key={n} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, padding: "16px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.accent, marginBottom: 4 }}>{n}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                    </div>
                ))}
            </div>

            <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 1.5rem 4rem" }}>
                <SectionLabel>Features</SectionLabel>
                <div style={{ fontSize: "clamp(1.1rem,3vw,1.5rem)", fontWeight: 700, color: C.text, marginBottom: 20 }}>Everything you need to land the role</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
                    {[["◈", "Resume Validation", "Claude AI verifies your PDF is actually a resume before any analysis runs. Invalid docs get rejected with a clear explanation."],
                    ["◉", "JD Match Scoring", "Semantic match score against the job description with matched and missing skills clearly listed."],
                    ["◆", "4-Dimension Score", "Content quality, skill relevance, experience clarity, and ATS friendliness — scored out of 25 each."],
                    ["◇", "Priority Suggestions", "Actionable, prioritized improvements with specific examples tailored to your resume."],
                    ["⚡", "Candidate Comparison", "Upload two resumes and get a side-by-side AI hiring verdict with reasoning."],
                    ["▣", "PDF Report Download", "Dark-themed styled PDF with full analysis, score bars, and skill maps."]
                    ].map(([icon, title, desc]) => (
                        <div key={title} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 16px" }}>
                            <div style={{ width: 34, height: 34, borderRadius: 5, background: C.accentLow, border: `1px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginBottom: 12 }}>{icon}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>{title}</div>
                            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>{desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, padding: "2.5rem 1.5rem 3rem", textAlign: "center" }}>
                <SectionLabel>How it works</SectionLabel>
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
                    {["Upload PDF", "AI Validates", "Claude Analyzes", "View Results", "Download PDF"].map((step, i) => (
                        <div key={step} style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ textAlign: "center", padding: "0 8px" }}>
                                <div style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.accent, margin: "0 auto 7px", background: C.accentLow }}>{i + 1}</div>
                                <div style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>{step}</div>
                            </div>
                            {i < 4 && <div style={{ color: C.border, fontSize: 10, paddingBottom: 18 }}>──</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// ANALYZE PAGE
// ─────────────────────────────────────────────
function AnalyzePage({ onDone }) {
    const [file, setFile] = useState(null);
    const [jd, setJd] = useState("");
    const [phase, setPhase] = useState("idle"); // idle | running | invalid | error
    const [log, setLog] = useState([]);
    const [validation, setValidation] = useState(null);
    const [errMsg, setErrMsg] = useState("");

    const pushLog = (msg, type = "info") => setLog((p) => [...p, { msg, type }]);
    const markActive = (msg) => setLog((p) => {
        const updated = p.map((l, i) => i === p.length - 1 && l.type === "active" ? { ...l, type: "info" } : l);
        return [...updated, { msg, type: "active" }];
    });

    const run = async () => {
        if (!file || !jd.trim()) return;
        setPhase("running"); setLog([]); setValidation(null); setErrMsg("");
        try {
            // Extract
            markActive("Extracting text from PDF...");
            let text;
            try {
                text = await extractPDFText(file);
            } catch {
                pushLog("Extracting text from PDF...", "error");
                setValidation({ is_resume: false, confidence: 100, detected_as: "Unreadable PDF", reason: "Could not extract text. The file may be image-based, scanned, or password-protected.", found_sections: [] });
                setPhase("invalid"); return;
            }
            pushLog("Extracting text from PDF...", "success");

            if (!text || text.length < 80) {
                setValidation({ is_resume: false, confidence: 100, detected_as: "Empty PDF", reason: "No readable text found. The PDF may be blank or contain only images.", found_sections: [] });
                pushLog("No readable text found in PDF.", "error");
                setPhase("invalid"); return;
            }
            pushLog(`Extracted ${text.length.toLocaleString()} characters.`, "info");

            // Validate
            markActive("Validating document with Claude AI...");
            let val;
            try { val = await validateResume(text); } catch { val = { is_resume: true, confidence: 50, detected_as: "Unknown", reason: "Validation unavailable.", found_sections: [] }; }
            setValidation(val);

            if (!val.is_resume) {
                pushLog("Validating document with Claude AI...", "error");
                pushLog(`Detected as: ${val.detected_as}`, "error");
                setPhase("invalid"); return;
            }
            pushLog("Validating document with Claude AI...", "success");
            pushLog(`Resume confirmed — ${val.confidence}% confidence. Sections: ${val.found_sections?.join(", ") || "detected"}`, "info");

            // Analyze
            markActive("Running full AI analysis...");
            const analysis = await analyzeResume(text, jd);
            pushLog("Running full AI analysis...", "success");
            pushLog(`Score: ${analysis.overall_score}/100 · JD match: ${analysis.jd_match?.score}/100`, "success");

            setPhase("idle");
            onDone({ name: file.name, analysis });

        } catch (e) {
            pushLog(e.message || "Unexpected error.", "error");
            setErrMsg(e.message || "Something went wrong.");
            setPhase("error");
        }
    };

    const reset = () => { setFile(null); setJd(""); setPhase("idle"); setLog([]); setValidation(null); setErrMsg(""); };

    // Running
    if (phase === "running") return (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem" }} className="fade-in">
            <SectionLabel>Processing</SectionLabel>
            <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 16 }}>⚙ Analyzing your resume...</div>
                <Terminal lines={log} />
                <div style={{ marginTop: 14, padding: "9px 13px", background: C.accentLow, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, color: C.muted }}>
                    <span style={{ color: C.accent }}>◈</span> Claude first validates your document is a resume, then runs the full analysis pipeline. Takes ~15–25 seconds.
                </div>
            </Card>
        </div>
    );

    // Invalid
    if (phase === "invalid" && validation) return (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem" }} className="fade-in">
            <SectionLabel color={C.danger}>Validation Failed</SectionLabel>
            <Card style={{ borderColor: C.danger }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{ fontSize: 28, color: C.danger, lineHeight: 1, flexShrink: 0 }}>✕</div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.danger, marginBottom: 4 }}>Not a Valid Resume</div>
                        <div style={{ fontSize: 11, color: C.muted }}>Claude AI could not identify this PDF as a resume or CV.</div>
                    </div>
                </div>

                <div style={{ background: C.bgInput, borderRadius: 4, padding: "12px 14px", marginBottom: 16 }}>
                    {[["File uploaded", file?.name, C.text], ["Detected as", validation.detected_as, C.danger], ["AI confidence", `${validation.confidence}% — not a resume`, C.warn]].map(([l, v, col]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6, gap: 12 }}>
                            <span style={{ color: C.muted, flexShrink: 0 }}>{l}</span>
                            <span style={{ color: col, textAlign: "right" }}>{v}</span>
                        </div>
                    ))}
                </div>

                <div style={{ padding: "10px 14px", background: C.bgInput, borderRadius: 4, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 4 }}>REASON</div>
                    <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.7 }}>{validation.reason}</div>
                </div>

                {validation.found_sections?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 6 }}>PARTIAL SECTIONS FOUND</div>
                        {validation.found_sections.map((s) => <Chip key={s} label={s} color="yellow" />)}
                    </div>
                )}

                <div style={{ padding: "12px 14px", background: C.accentLow, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, marginBottom: 8 }}>A VALID RESUME MUST CONTAIN:</div>
                    {["Full name and contact info (email, phone, LinkedIn/GitHub)", "Work experience with company names, roles, and dates", "Education with institution name and degree", "Skills section — technical or professional"].map((t) => (
                        <div key={t} style={{ fontSize: 11, color: C.muted, lineHeight: 1.9 }}><span style={{ color: C.accent }}>·</span> {t}</div>
                    ))}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn-primary" onClick={reset}>↩ Upload Different File</button>
                    <button className="btn-outline" onClick={async () => {
                        setPhase("running");
                        setLog([{ msg: "Skipping validation — analyzing anyway...", type: "warn" }]);
                        try {
                            const text = await extractPDFText(file);
                            pushLog("Text extracted.", "success");
                            markActive("Running analysis...");
                            const analysis = await analyzeResume(text, jd);
                            pushLog(`Score: ${analysis.overall_score}/100`, "success");
                            setPhase("idle"); onDone({ name: file.name, analysis });
                        } catch (e) { pushLog(e.message, "error"); setErrMsg(e.message); setPhase("error"); }
                    }}>Analyze Anyway</button>
                </div>
            </Card>
            <div style={{ marginTop: 14 }}><Terminal lines={log} /></div>
        </div>
    );

    // Error
    if (phase === "error") return (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem" }} className="fade-in">
            <Card style={{ borderColor: C.danger }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.danger, marginBottom: 12 }}>✕ Error Occurred</div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 18 }}>{errMsg}</div>
                <Terminal lines={log} />
                <div style={{ marginTop: 16 }}><button className="btn-primary" onClick={reset}>↩ Try Again</button></div>
            </Card>
        </div>
    );

    // Idle form
    return (
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "3rem 1.5rem" }}>
            <SectionLabel>Single Resume Analysis</SectionLabel>
            <div style={{ fontSize: "clamp(1.2rem,3vw,1.5rem)", fontWeight: 700, color: C.text, marginBottom: 24 }}>Analyze your resume</div>
            <Card>
                <UploadBox label="Resume File (PDF)" file={file} onFile={(f) => { setFile(f); setPhase("idle"); }} id="resume-upload" />
                {file && (
                    <div style={{ marginBottom: 16, padding: "9px 13px", background: C.accentLow, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, color: C.muted }}>
                        <span style={{ color: C.accent }}>◈</span> Claude AI will validate this document is a resume before running the analysis.
                    </div>
                )}
                <FieldLabel>Job Description</FieldLabel>
                <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={8}
                    placeholder={"Paste the full job description here...\n\nExample:\n  Python Developer with experience in FastAPI,\n  ML/AI, SQL databases, and cloud platforms."} />
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn-primary" onClick={run} disabled={!file || !jd.trim()}>▶ Run Analysis</button>
                </div>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────
// RESULTS PAGE
// ─────────────────────────────────────────────
function ResultsPage({ data, onBack }) {
    const [downloading, setDownloading] = useState(false);
    if (!data) return null;
    const { name, analysis: a } = data;
    const bd = a.score_breakdown;
    const total = bd.content_quality + bd.skill_relevance + bd.experience_clarity + bd.ats_friendliness;
    const totalCol = total >= 80 ? C.accent : total >= 60 ? C.warn : C.danger;

    return (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "3rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
                <button className="btn-ghost" onClick={onBack}>← Back</button>
                <div style={{ flex: 1 }}>
                    <SectionLabel>Analysis Complete</SectionLabel>
                    <div style={{ fontSize: 11, color: C.muted }}>{name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: totalCol, lineHeight: 1 }}>{total}</div>
                    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "1px" }}>OVERALL / 100</div>
                </div>
            </div>

            <Collapsible title="JD Match Analysis" icon="◈">
                <ScoreBar label="JD Match Score" score={a.jd_match.score} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 8 }}>MATCHED SKILLS</div>
                        {a.jd_match.matched_skills?.map((s) => <Chip key={s} label={s} color="green" />)}
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 8 }}>MISSING SKILLS</div>
                        {a.jd_match.missing_skills?.map((s) => <Chip key={s} label={s} color="red" />)}
                    </div>
                </div>
                <div style={{ marginTop: 14, padding: "11px 14px", background: C.bgInput, borderRadius: 4, fontSize: 12, color: C.dim, lineHeight: 1.7 }}>{a.jd_match.summary}</div>
            </Collapsible>

            <Collapsible title="Extracted Skills" icon="◉">
                {[["Technical", a.skills.technical, "green"], ["Soft Skills", a.skills.soft, "gray"], ["Domain", a.skills.domain, "yellow"], ["Certifications", a.skills.certifications, "gray"]].map(([lbl, items, col]) =>
                    items?.length > 0 && (
                        <div key={lbl} style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 7 }}>{lbl.toUpperCase()}</div>
                            {items.map((s) => <Chip key={s} label={s} color={col} />)}
                        </div>
                    )
                )}
            </Collapsible>

            <Collapsible title="Score Breakdown" icon="◆">
                <ScoreBar label={`Content Quality (${bd.content_quality}/25)`} score={bd.content_quality} max={25} />
                <ScoreBar label={`Skill Relevance (${bd.skill_relevance}/25)`} score={bd.skill_relevance} max={25} />
                <ScoreBar label={`Experience Clarity (${bd.experience_clarity}/25)`} score={bd.experience_clarity} max={25} />
                <ScoreBar label={`ATS Friendliness (${bd.ats_friendliness}/25)`} score={bd.ats_friendliness} max={25} />
                <div style={{ marginTop: 14, padding: "12px 14px", background: C.bgInput, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>VERDICT</div>
                    <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>{a.verdict}</div>
                </div>
            </Collapsible>

            <Collapsible title="Improvement Suggestions" icon="◇">
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 10 }}>PRIORITY FIXES</div>
                    {a.improvements.priority?.map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "10px 12px", background: C.bgInput, borderRadius: 4 }}>
                            <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.accentLow, border: `1px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.accent, flexShrink: 0, lineHeight: 1 }}>{i + 1}</div>
                            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.7 }}>{item}</div>
                        </div>
                    ))}
                </div>
                {a.improvements.ats?.length > 0 && (
                    <div>
                        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 8 }}>ATS OPTIMIZATION</div>
                        {a.improvements.ats.map((tip, i) => (
                            <div key={i} style={{ fontSize: 11, color: C.muted, lineHeight: 1.9 }}><span style={{ color: C.accent }}>·</span> {tip}</div>
                        ))}
                    </div>
                )}
            </Collapsible>

            <Card highlight style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Full report ready · dark-themed PDF</div>
                        <div style={{ fontSize: 12, color: C.text }}>ResumeIQ_{name.replace(/\.pdf$/i, "")}.pdf</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>JD match · skills · score bars · suggestions</div>
                    </div>
                    <button className="btn-primary" onClick={async () => { setDownloading(true); try { await downloadPDFReport(data); } catch (e) { alert("PDF error: " + e.message); } setDownloading(false); }} disabled={downloading}>
                        {downloading ? "Generating..." : "⬇ Download PDF Report"}
                    </button>
                </div>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────
// COMPARE PAGE
// ─────────────────────────────────────────────
function ComparePage({ onDone }) {
    const [file1, setFile1] = useState(null);
    const [file2, setFile2] = useState(null);
    const [jd, setJd] = useState("");
    const [phase, setPhase] = useState("idle");
    const [log, setLog] = useState([]);
    const [errMsg, setErrMsg] = useState("");

    const push = (msg, type = "info") => setLog((p) => [...p, { msg, type }]);
    const active = (msg) => setLog((p) => {
        const u = p.map((l, i) => i === p.length - 1 && l.type === "active" ? { ...l, type: "info" } : l);
        return [...u, { msg, type: "active" }];
    });
    const reset = () => { setFile1(null); setFile2(null); setJd(""); setPhase("idle"); setLog([]); setErrMsg(""); };

    const run = async () => {
        if (!file1 || !file2 || !jd.trim()) return;
        setPhase("running"); setLog([]); setErrMsg("");
        try {
            active("Extracting text from Candidate A...");
            const t1 = await extractPDFText(file1);
            push("Extracted Candidate A text.", "success");

            active("Extracting text from Candidate B...");
            const t2 = await extractPDFText(file2);
            push("Extracted Candidate B text.", "success");

            active("Validating both documents with Claude AI...");
            const [v1, v2] = await Promise.all([validateResume(t1), validateResume(t2)]);
            if (!v1.is_resume) { push(`Candidate A rejected: ${v1.detected_as}`, "error"); setErrMsg(`Candidate A is not a resume: ${v1.detected_as}`); setPhase("error"); return; }
            if (!v2.is_resume) { push(`Candidate B rejected: ${v2.detected_as}`, "error"); setErrMsg(`Candidate B is not a resume: ${v2.detected_as}`); setPhase("error"); return; }
            push("Both documents verified as resumes.", "success");

            active("Running side-by-side comparison...");
            const result = await compareResumesAPI(t1, t2, jd, file1.name, file2.name);
            push("Comparison complete.", "success");
            push(`Winner: Candidate ${result.winner} — ${result.verdict}`, "success");

            setPhase("idle");
            onDone({ name1: file1.name, name2: file2.name, result });
        } catch (e) {
            push(e.message || "Error during comparison.", "error");
            setErrMsg(e.message || "Something went wrong.");
            setPhase("error");
        }
    };

    if (phase === "running") return (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem" }} className="fade-in">
            <SectionLabel>Comparing Candidates</SectionLabel>
            <Card><div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 16 }}>⚙ Running comparison...</div><Terminal lines={log} /></Card>
        </div>
    );

    if (phase === "error") return (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem" }} className="fade-in">
            <Card style={{ borderColor: C.danger }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.danger, marginBottom: 12 }}>✕ Error</div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 18 }}>{errMsg}</div>
                <Terminal lines={log} />
                <div style={{ marginTop: 16 }}><button className="btn-primary" onClick={reset}>↩ Try Again</button></div>
            </Card>
        </div>
    );

    return (
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "3rem 1.5rem" }}>
            <SectionLabel>Resume Comparison</SectionLabel>
            <div style={{ fontSize: "clamp(1.2rem,3vw,1.5rem)", fontWeight: 700, color: C.text, marginBottom: 24 }}>Compare two candidates</div>
            <Card>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <UploadBox label="Candidate A (PDF)" file={file1} onFile={setFile1} id="compare-file1" />
                    <UploadBox label="Candidate B (PDF)" file={file2} onFile={setFile2} id="compare-file2" />
                </div>
                <FieldLabel>Job Description</FieldLabel>
                <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={6} placeholder="Paste the job description to compare both candidates against..." />
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn-primary" onClick={run} disabled={!file1 || !file2 || !jd.trim()}>⚡ Compare Candidates</button>
                </div>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────
// COMPARE RESULTS
// ─────────────────────────────────────────────
function CompareResults({ data, onBack }) {
    if (!data) return null;
    const { name1, name2, result } = data;
    const a = result.candidate_a, b = result.candidate_b;
    const winnerName = result.winner === "A" ? name1 : name2;

    return (
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "3rem 1.5rem" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
                <button className="btn-ghost" onClick={onBack}>← Back</button>
                <SectionLabel>Comparison Results</SectionLabel>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                {[[name1, a, "A"], [name2, b, "B"]].map(([name, cand, letter]) => {
                    const win = (letter === result.winner);
                    return (
                        <div key={letter} style={{ background: C.bgCard, border: `1.5px solid ${win ? C.accent : C.border}`, borderRadius: 8, padding: 20, position: "relative" }} className="fade-in">
                            {win && <div style={{ position: "absolute", top: -10, left: 14, padding: "2px 10px", background: C.bgCard, border: `1px solid ${C.accent}`, borderRadius: 2, fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: "1px" }}>★ RECOMMENDED</div>}
                            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "1px", marginBottom: 4 }}>CANDIDATE {letter}</div>
                            <div style={{ fontSize: 11, color: C.text, marginBottom: 14, wordBreak: "break-all" }}>{name}</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: cand.score >= 80 ? C.accent : C.warn, lineHeight: 1 }}>{cand.score}</div>
                            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "1px", marginBottom: 14 }}>JD MATCH / 100</div>
                            <ScoreBar label="Overall match" score={cand.score} />
                            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 6, marginTop: 12 }}>STRENGTHS</div>
                            {cand.strengths?.map((s, i) => <div key={i} style={{ fontSize: 11, color: C.dim, lineHeight: 1.8 }}><span style={{ color: C.accent }}>+</span> {s}</div>)}
                            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 6, marginTop: 12 }}>WEAKNESSES</div>
                            {cand.weaknesses?.map((w, i) => <div key={i} style={{ fontSize: 11, color: C.dim, lineHeight: 1.8 }}><span style={{ color: C.danger }}>–</span> {w}</div>)}
                        </div>
                    );
                })}
            </div>

            <Card highlight>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 8 }}>HIRING VERDICT</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, marginBottom: 12 }}>{result.winner_reason}</div>
                <div style={{ padding: "10px 14px", background: C.accentLow, borderRadius: 4, fontSize: 12, fontWeight: 700, color: C.accent }}>
                    ★ Recommended: {winnerName}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: C.dim }}>{result.verdict}</div>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────
export default function App() {
    const [page, setPage] = useState("home");
    const [analyzeData, setAnalyzeData] = useState(null);
    const [compareData, setCompareData] = useState(null);

    const nav = (p) => setPage(p);

    const pages = {
        home: <Landing onNav={nav} />,
        analyze: <AnalyzePage onDone={(d) => { setAnalyzeData(d); nav("results"); }} />,
        results: <ResultsPage data={analyzeData} onBack={() => { setAnalyzeData(null); nav("analyze"); }} />,
        compare: <ComparePage onDone={(d) => { setCompareData(d); nav("compare-results"); }} />,
        "compare-results": <CompareResults data={compareData} onBack={() => { setCompareData(null); nav("compare"); }} />,
    };

    return (
        <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: font }}>
            <GlobalCSS />
            <Navbar page={page} onNav={nav} />
            <div className="fade-in" key={page}>{pages[page]}</div>
            <footer style={{ borderTop: `1px solid ${C.border}`, padding: "18px 24px", textAlign: "center", fontSize: 10, color: C.muted, letterSpacing: "1px" }}>
                RESUMEIQ · CLAUDE AI · AI-POWERED RESUME INTELLIGENCE
            </footer>
        </div>
    );
}
