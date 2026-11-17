import os
import re
import json
from pathlib import Path
from typing import Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
RESUME_FILE = BASE_DIR / "resume.pdf"
CONFIG_FILE = BASE_DIR / "config.json"


def extract_raw_text_from_pdf(pdf_path: Path) -> str:
    """Extracts raw plain text from a PDF document using pdfplumber or pdfminer."""
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception:
        # Fallback to pdfminer if pdfplumber encounters parser error
        try:
            from pdfminer.high_level import extract_text
            text = extract_text(str(pdf_path))
        except Exception:
            pass
    return text.strip()


def sanitize_phone_number(raw: str) -> str:
    """Extracts a clean 10-digit mobile number, stripping country code, spaces, dashes."""
    if not raw:
        return ""
    digits = re.sub(r"[^\d]", "", raw)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10 and digits[0] in "6789":
        return digits
    elif len(digits) >= 10:
        return digits[-10:]
    return digits or raw


def sanitize_degree_title(raw: str) -> str:
    """Strips trailing locations, scores, percentages, years, and returns clean degree title."""
    if not raw:
        return ""
    clean = re.sub(
        r"(?:(?:CGPA|GPA|Percentage|Score|Marks|Agg|Aggregate)?\s*[:=\-]?\s*)?(?:\b\d{1,2}(?:\.\d{1,2})?\s*%\s*|\b\d{1,2}(?:\.\d{1,2})?\s*\/\s*10|\b\d{1,2}(?:\.\d{1,2})?\s*CGPA)",
        "",
        raw,
        flags=re.I,
    )
    clean = re.sub(r"\b(19\d{2}|20[0-3]\d)\b", "", clean)
    CITIES = [
        "Bhopal", "Kanpur", "Noida", "Delhi", "New Delhi", "Gurgaon", "Gurugram",
        "Bangalore", "Bengaluru", "Hyderabad", "Pune", "Mumbai", "Chennai",
        "Kolkata", "Lucknow", "Jaipur", "Indore", "India", "UP", "MP"
    ]
    for city in CITIES:
        clean = re.sub(rf"(?:[\s\-\–|,:]+|^){re.escape(city)}\b", " ", clean, flags=re.I)
    clean = clean.split(",")[0].split("|")[0].strip(" –-:,")
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def extract_clean_score(raw: str) -> str:
    """Extracts standardized CGPA or Percentage string."""
    if not raw:
        return ""
    # Case A: CGPA / GPA / Score / Percentage keyword followed by value: e.g. "CGPA: 8.5/10", "CGPA: 8.5", "Percentage: 71%"
    m1 = re.search(
        r"\b(?:CGPA|GPA|Percentage|Score|Marks)\s*[:=\-]?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*10|\s*%)?)",
        raw,
        re.I,
    )
    if m1:
        return m1.group(0).strip(" –-:,")

    # Case B: Trailing keyword or percentage: e.g. "8.5 CGPA", "8.5/10", "71%"
    m2 = re.search(
        r"\b(\d{1,2}(?:\.\d{1,2})?\s*%\s*|\d{1,2}(?:\.\d{1,2})?\s*\/\s*10|\d{1,2}(?:\.\d{1,2})?\s*CGPA)",
        raw,
        re.I,
    )
    if m2:
        return m2.group(0).strip(" –-:,")
    return ""


def sanitize_college_name(raw: str) -> str:
    """Cleans up college name from years, dates, and trailing punctuation."""
    if not raw:
        return ""
    clean = re.sub(
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|19\d{2}|20[0-3]\d)\b",
        "",
        raw,
        flags=re.I,
    )
    clean = re.sub(r"[–\-:,\s]+$", "", clean).strip()
    clean = re.sub(r"^[–\-:,\s]+", "", clean).strip()
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def extract_profile_with_regex(raw_text: str) -> Dict[str, Any]:
    """Fallback regex & NLP extraction when AI is offline or unconfigured."""
    data = {
        "name": "",
        "email": "",
        "phone": "",
        "current_city": "",
        "experience": "",
        "current_company": "",
        "current_role": "",
        "master_college": "",
        "master_degree": "",
        "master_grad_year": "",
        "master_score": "",
        "bachelor_college": "",
        "bachelor_degree": "",
        "bachelor_grad_year": "",
        "bachelor_score": "",
        "college": "",
        "degree": "",
        "grad_year": "",
        "skills": "",
        "linkedin": "",
        "github": "",
        "portfolio": "",
        "cover_note": "",
    }

    if not raw_text:
        return data

    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

    # 1. Email extraction
    email_m = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", raw_text)
    if email_m:
        data["email"] = email_m.group(0).lower().rstrip(".")

    # 2. Phone extraction (supports +91 and standard 10-digit mobile)
    phone_m = re.search(r"(?:(?:\+91[\-\s]?)?[6-9]\d{9})|(?:\+?1[\-\s]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}", raw_text)
    if phone_m:
        data["phone"] = sanitize_phone_number(phone_m.group(0))

    # 3. Location / City
    for line in lines[1:5]:
        line_clean = re.sub(r"^[^\w\s]+", "", line).strip()
        if any(c in line_clean.lower() for c in ["noida", "delhi", "bangalore", "bengaluru", "hyderabad", "pune", "mumbai", "chennai", "gurgaon", "gurugram", "kolkata", "bhopal", "kanpur", "india", "up", "karnataka", "maharashtra"]):
            if not any(k in line_clean.lower() for k in ["@", "http", "phone", "+91", "github", "linkedin"]):
                data["current_city"] = line_clean
                break

    # 4. LinkedIn URL
    li_m = re.search(r"(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-\/]+)", raw_text, re.IGNORECASE)
    if li_m:
        data["linkedin"] = f"https://linkedin.com/in/{li_m.group(1).rstrip('/')}"

    # 5. GitHub URL
    gh_m = re.search(r"(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\/]+)", raw_text, re.IGNORECASE)
    if gh_m:
        data["github"] = f"https://github.com/{gh_m.group(1).rstrip('/')}"

    # 6. Portfolio URL
    port_m = re.search(r"(?:https?:\/\/)?([a-zA-Z0-9_\-]+\.(?:vercel\.app|netlify\.app|github\.io|me|dev|tech|site|in))(?:\/[a-zA-Z0-9_\-\.\/]*)?", raw_text, re.IGNORECASE)
    if port_m:
        found_url = port_m.group(0)
        if not any(k in found_url.lower() for k in ["linkedin.com", "github.com", "gmail.com"]):
            if not found_url.startswith("http"):
                found_url = "https://" + found_url
            data["portfolio"] = found_url

    # 7. Candidate Name (First non-header line of resume)
    for line in lines[:5]:
        if any(k in line.lower() for k in ["resume", "curriculum", "vitae", "@", "http", "phone", "page 1", "portfolio", "+91", "education", "experience", "skills", "projects"]):
            continue
        words = line.split()
        if 1 <= len(words) <= 4 and all(re.match(r"^[A-Za-z\.\'-]+$", w) for w in words):
            data["name"] = line.title()
            break

    # 8. Education: Split into Master's and Bachelor's
    for i, line in enumerate(lines):
        line_low = line.lower()
        # Master's detection
        if any(m in line_low for m in ["master of", "mca", "m.tech", "mtech", "m.sc", "msc", "m.s."]):
            score = extract_clean_score(line)
            if score:
                data["master_score"] = score
            deg_clean = sanitize_degree_title(line)
            if deg_clean:
                data["master_degree"] = deg_clean
            if i > 0:
                prev = lines[i - 1]
                yr = re.findall(r"\b(20[123]\d)\b", prev + " " + line)
                if yr:
                    data["master_grad_year"] = yr[-1]
                col = sanitize_college_name(prev)
                if col:
                    data["master_college"] = col

        # Bachelor's detection
        elif any(b in line_low for b in ["bachelor of", "bca", "b.tech", "btech", "b.e.", "b.sc", "bsc", "b.com"]):
            score = extract_clean_score(line)
            if score:
                data["bachelor_score"] = score
            deg_clean = sanitize_degree_title(line)
            if deg_clean:
                data["bachelor_degree"] = deg_clean
            if i > 0:
                prev = lines[i - 1]
                yr = re.findall(r"\b(20[123]\d)\b", prev + " " + line)
                if yr:
                    data["bachelor_grad_year"] = yr[-1]
                col = sanitize_college_name(prev)
                if col:
                    data["bachelor_college"] = col

    # Fallback overall college, degree, grad_year to highest qualification
    data["college"] = data["master_college"] or data["bachelor_college"]
    data["degree"] = data["master_degree"] or data["bachelor_degree"]
    data["grad_year"] = data["master_grad_year"] or data["bachelor_grad_year"]

    # 9. Skills
    KNOWN_SKILLS = [
        "Java", "Spring Boot", "JDBC", "JavaScript", "TypeScript", "React", "React.js", "Next.js", "Node.js", "Express.js",
        "MongoDB", "PostgreSQL", "MySQL", "SQL", "Python", "C++", "C#", "Docker", "Git",
        "GitHub", "Tailwind CSS", "Bootstrap", "Redux", "Prisma", "REST APIs", "GraphQL", "AWS", "FastAPI",
        "HTML5", "HTML", "CSS3", "CSS", "Linux", "Kubernetes", "Redis", "Firebase", "OOPs", "SDLC", "MVC Architecture"
    ]
    found_skills = []
    text_lower = raw_text.lower()
    for skill in KNOWN_SKILLS:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found_skills.append(skill)
    if found_skills:
        data["skills"] = ", ".join(found_skills)

    # 10. Experience (Only filled if candidate has actual work experience; empty if fresher)
    is_fresher = any(f in text_lower for f in ["fresher", "seeking an entry-level", "entry level", "student"])
    exp_m = re.search(r"(\d+(?:\.\d+)?)\s*(?:\+?\s*years?|\+?\s*yrs?)\s*(?:of\s*)?(?:experience)?", raw_text, re.IGNORECASE)
    if exp_m and not is_fresher:
        data["experience"] = exp_m.group(1)
    else:
        # Fresher or no prior work experience: leave empty
        data["experience"] = ""

    # 11. Cover Note / Summary
    summary_m = re.search(r"(?:Summary|Profile|About Me|Objective)\s*[:\n]\s*([^\n]+(?:\n[^\n]+){1,3})", raw_text, re.IGNORECASE)
    if summary_m:
        raw_summary = summary_m.group(1).strip()
        cleaned_summary = re.sub(r"(?:\n|\s)+(?:Education|Technical Skills|Projects|Skills|Experience).*$", "", raw_summary, flags=re.IGNORECASE).strip()
        data["cover_note"] = cleaned_summary

    return data


def extract_profile_with_ai(raw_text: str, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Uses configured AI model (Grok, OpenAI, Gemini) to extract high-accuracy structured profile data."""
    api_key = config.get("ai_api_key") or config.get("grok_api_key") or config.get("openai_api_key") or config.get("gemini_api_key")
    if not api_key:
        return None

    try:
        from services.ai_service import call_ai_chat

        prompt = f"""
You are an expert ATS resume parser. Extract the candidate's exact profile details from this resume text into a strict JSON object.
Do NOT invent or fabricate any info. If a field is not present in the resume, leave it as an empty string "".

Resume Text:
\"\"\"
{raw_text[:4000]}
\"\"\"

Return ONLY a valid JSON object with these exact keys:
{{
  "name": "Candidate Full Name",
  "email": "candidate@example.com",
  "phone": "10-digit phone number without country code",
  "current_city": "City or Location e.g. Noida, UP",
  "experience": "Years of professional work experience if any, or empty string '' if fresher",
  "current_company": "Current or recent company name if any, or empty string '' if fresher",
  "current_role": "Current or recent job title if any, or empty string '' if fresher",
  "master_college": "Postgraduate/Master university or college name, or empty string if not applicable",
  "master_degree": "Master degree title e.g. Master of Computer Applications (MCA), or empty string",
  "master_grad_year": "4-digit graduation year for Master's e.g. 2025, or empty string",
  "master_score": "Postgraduate percentage or CGPA e.g. 8.5/10 or 85%, or empty string",
  "bachelor_college": "Undergraduate/Bachelor university or college name, or empty string if not applicable",
  "bachelor_degree": "Bachelor degree title e.g. Bachelor of Computer Applications (BCA), or empty string",
  "bachelor_grad_year": "4-digit graduation year for Bachelor's e.g. 2023, or empty string",
  "bachelor_score": "Undergraduate percentage or CGPA e.g. 71% or 7.1/10, or empty string",
  "college": "Highest college or university name",
  "degree": "Highest degree and major",
  "grad_year": "Highest graduation year",
  "skills": "Comma-separated list of technical skills found in resume",
  "linkedin": "Full LinkedIn profile URL",
  "github": "Full GitHub profile URL",
  "portfolio": "Personal portfolio or website URL",
  "cover_note": "A 2-3 sentence introductory professional summary based on their background"
}}
"""
        response_text = call_ai_chat(prompt, config)
        if not response_text:
            return None

        # Clean JSON markdown fences
        cleaned = re.sub(r"^```(?:json)?", "", response_text.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"```$", "", cleaned.strip()).strip()

        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and (parsed.get("name") or parsed.get("email")):
            return parsed
    except Exception:
        pass
    return None


def parse_resume_and_update_config(pdf_path: Optional[Path] = None, config_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Main entry point:
    1. Reads PDF resume
    2. Extracts structured profile data (AI with regex fallback)
    3. Merges extracted real data into config.json (or user-specific config file)
    4. Returns extracted profile dict
    """
    path = pdf_path or RESUME_FILE
    target_config_file = config_path or CONFIG_FILE
    if not path.exists() or path.stat().st_size == 0:
        return {"status": "error", "message": "Resume PDF file not found or is empty."}

    raw_text = extract_raw_text_from_pdf(path)
    if not raw_text or len(raw_text.strip()) < 20:
        return {"status": "error", "message": "Could not extract text from PDF. Ensure it is not an image-only scan."}

    # Load current configuration
    current_config = {}
    if target_config_file.exists():
        try:
            with open(target_config_file, "r", encoding="utf-8") as f:
                current_config = json.load(f)
        except Exception:
            current_config = {}

    # Try AI extraction first; fallback to regex/NLP
    extracted = extract_profile_with_ai(raw_text, current_config)
    if not extracted:
        extracted = extract_profile_with_regex(raw_text)

    # Sync URL aliases
    if extracted.get("linkedin") and not extracted.get("linkedin_url"):
        extracted["linkedin_url"] = extracted["linkedin"]
    if extracted.get("github") and not extracted.get("github_url"):
        extracted["github_url"] = extracted["github"]
    if extracted.get("portfolio") and not extracted.get("portfolio_url"):
        extracted["portfolio_url"] = extracted["portfolio"]

    # Merge non-empty extracted values into config
    KEYS_TO_SYNC = [
        "name", "email", "phone", "current_city", "experience", "current_company", "current_role",
        "master_college", "master_degree", "master_grad_year", "master_score",
        "bachelor_college", "bachelor_degree", "bachelor_grad_year", "bachelor_score",
        "college", "degree", "grad_year",
        "skills", "linkedin", "github", "portfolio", "linkedin_url", "github_url", "portfolio_url", "cover_note"
    ]

    updated_fields = {}
    for key in KEYS_TO_SYNC:
        val = (extracted.get(key) or "").strip()
        # Allow updating or clearing (e.g. experience remains blank if fresher)
        current_config[key] = val
        if val:
            updated_fields[key] = val

    # Save to config file
    try:
        with open(target_config_file, "w", encoding="utf-8") as f:
            json.dump(current_config, f, indent=2)
    except Exception as e:
        return {"status": "error", "message": f"Failed to save extracted config: {e}"}

    return {
        "status": "success",
        "extracted_fields": updated_fields,
        "config": current_config,
        "message": f"Successfully extracted {len(updated_fields)} profile parameters from your resume.",
    }
