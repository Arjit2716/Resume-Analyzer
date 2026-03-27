from datetime import datetime

def save_report(results: dict, output_path="report.txt"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = []
    lines.append("=" * 60)
    lines.append("        RESUME ANALYZER — FULL REPORT")
    lines.append(f"        Generated: {timestamp}")
    lines.append("=" * 60)

    section_icons = {
        "JD Match Analysis":       "📋",
        "Extracted Skills":        "🛠️ ",
        "Resume Score":            "⭐",
        "Improvement Suggestions": "💡",
        "Multi-Resume Comparison": "⚔️ ",
    }

    for section, content in results.items():
        icon = section_icons.get(section, "•")
        lines.append(f"\n{icon} {section.upper()}")
        lines.append("-" * 60)
        # Support both string content and other objects (e.g., dict/None)
        lines.append(str(content).strip() if content is not None else "(no content)")

    lines.append("\n" + "=" * 60)
    lines.append("END OF REPORT")
    lines.append("=" * 60)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\n📄 Report saved to: {output_path}")