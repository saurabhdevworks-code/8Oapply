import os
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_FILE = BASE_DIR / "config.json"

# Strict exclusion list: Non-developer roles, managerial, senior leadership, or non-engineering functions
NEGATIVE_ROLE_KEYWORDS = [
    "manager", "director", "vice president", "vp", "head of", "principal", "distinguished",
    "chief", "recruiter", "recruiting", "talent acquisition", "human resources", "hr executive",
    "telecaller", "bpo", "call center", "customer support", "customer care", "customer service",
    "sales", "business development", "account executive", "marketing", "digital marketing",
    "content writer", "copywriter", "graphic designer", "ui/ux designer", "product designer",
    "legal", "compliance", "accountant", "accounting", "finance", "financial", "audit", "payroll",
    "facilities", "nurse", "civil engineer", "mechanical engineer", "electrical engineer",
    "hardware engineer", "phd", "intern (2027)", "internship (2027)", "solution architect",
    "enterprise architect", "operations manager"
]

# Legacy / Incompatible technology stacks that have zero overlap with candidate's modern web stack
# (Candidate is MERN / React / Node / Java / SQL / Full Stack)
INCOMPATIBLE_STACK_KEYWORDS = [
    "sap abap", "sap basis", "sap fico", "sap mm", "sap sd", "sap hana", "sap full stack",
    "salesforce", "apex developer", "cobol", "mainframe", "embedded c", "firmware",
    "as400", "pl/sql developer", ".net developer", ".net full stack", "c# developer",
    "asp.net", "dotnet"
]

# Strict foreign location list: Automatically rejects international postings outside India
FOREIGN_LOCATIONS = [
    "united states", "us only", "u.s. only", "canada", "united kingdom", "uk only", "london",
    "germany", "berlin", "munich", "france", "paris", "australia", "sydney", "melbourne",
    "singapore", "netherlands", "amsterdam", "ireland", "dublin", "switzerland", "zurich",
    "poland", "warsaw", "sweden", "stockholm", "spain", "madrid", "barcelona", "brazil",
    "israel", "tel aviv", "japan", "tokyo", "china", "california", "new york", "texas",
    "san francisco", "seattle", "austin", "chicago", "boston", "denver", "los angeles",
    "emea only", "emea", "apac only", "latam", "americas", "north america", "europe only"
]

def is_foreign_location(text: str) -> bool:
    """Detects whether text/location explicitly requires presence outside India."""
    if not text:
        return False
    t_low = text.lower()
    # Word-boundary check for short acronyms to avoid false positives (e.g. 'thousand', 'fusani')
    if re.search(r"\b(usa|us only|u\.s\.a?|uk only)\b", t_low):
        return True
    return any(f in t_low for f in FOREIGN_LOCATIONS)

# Allowed developer / engineering indicators
CORE_ROLE_ANCHORS = [
    "developer", "engineer", "programmer", "sde", "coder", "architect"
]

# Tech / domain anchors that align with candidate's target roles & skills
TARGET_DOMAIN_ANCHORS = [
    "full stack", "fullstack", "full-stack", "backend", "back-end", "back end",
    "frontend", "front-end", "front end", "software", "web", "react", "node", "mern",
    "javascript", "typescript", "java", "next", "python", "api", "sde", "application"
]


def load_config() -> Dict[str, Any]:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def clean_job_title(raw_title: str) -> str:
    """
    Cleans raw job titles by removing Google search breadcrumb artifacts,
    unmatched brackets, trailing portal references, and extraneous newline data.
    """
    if not raw_title:
        return ""

    # 1. Take first line only (Google search / scrapers sometimes bundle snippets)
    t = raw_title.split("\n")[0].strip()

    # 2. Strip Google search breadcrumb arrow ('›') and anything after
    t = t.split("›")[0].strip()

    # 3. Strip pipe delimiter used for company/site names ('|')
    t = t.split("|")[0].strip()

    # 4. Remove trailing portal domain mentions
    t = re.sub(
        r"(?i)\s*[-–]\s*(?:myworkdayjobs\.com|lever\.co|greenhouse\.io|smartrecruiters\.com|ashbyhq\.com|linkedin\.com|naukri\.com|indeed\.com|glassdoor\.com|internshala\.com|shine\.com|foundit\.in).*$",
        "",
        t,
    )

    # 5. Remove all-caps company prefixes like 'PHONEPE LIMITED ', '(IND) '
    t = re.sub(
        r"^[A-Z0-9\s]{4,}\s+(?=(?:Software|Senior|Junior|Full|Backend|Frontend|Lead|SDE|Developer|Engineer))",
        "",
        t,
    )
    t = re.sub(r"^\([A-Z0-9\s]+\)\s*", "", t)

    # 6. Clean trailing dangling numbers or partial brackets like '( 2', '(AI', '(1'
    t = re.sub(r"\s*\(\s*[0-9A-Za-z\s]{1,4}$", "", t)

    # 7. Balance unmatched parentheses
    if t.count("(") > t.count(")"):
        if t.endswith("("):
            t = t[:-1].strip()
        else:
            t = t + ")"

    # 8. Remove trailing punctuation
    t = re.sub(r"[,–\-:\s]+$", "", t)
    return t.strip()


def clean_company_name(raw_company: str, url: str = "") -> str:
    """
    Cleans company names from raw URLs or noisy scraper tags.
    """
    if not raw_company or raw_company.strip().lower() in ["unknown", "career portal", ""]:
        if url:
            try:
                from services.response_tracker import extract_company_from_slug
                derived = extract_company_from_slug(url)
                if derived:
                    return derived
            except Exception:
                pass
        return "Direct Employer"

    comp = raw_company.split("\n")[0].strip()
    comp = re.sub(r"(?i)\b(?:inc|llc|pvt|ltd|limited|technologies|solutions)\b\.?", "", comp).strip()
    comp = re.sub(r"[,–\-:\s]+$", "", comp).strip()
    return comp or raw_company


def is_job_match(
    title: str,
    loc: str = "",
    company: str = "",
    description: str = "",
    config: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, str]:
    """
    Strictly evaluates whether a job listing satisfies the candidate's
    'Search Targets & Preferences' (target roles, locations, skills, and seniority):
    Returns: (is_match: bool, reason: str)
    """
    if not title or len(title.strip()) < 3:
        return False, "Title is empty or too short"

    clean_t = clean_job_title(title)
    t_lower = clean_t.lower()

    cfg = config or load_config()
    target_titles = cfg.get("job_titles", [])
    target_locations = cfg.get("locations", [])
    candidate_skills = cfg.get("skills", "")

    # ── 1. Strictly Reject Negative / Non-Engineering Roles ────────
    for neg in NEGATIVE_ROLE_KEYWORDS:
        if neg in t_lower:
            return False, f"Negative role match: '{neg}'"

    # User Configured Exclude Keywords
    user_excludes = [k.lower().strip() for k in cfg.get("exclude_keywords", []) if k.strip()]
    full_text = f"{t_lower} {description.lower() if description else ''}"
    for ex in user_excludes:
        if ex in full_text:
            return False, f"Exclude keyword matched: '{ex}'"

    # ── 2. Reject Incompatible Technology Stacks ───────────────────
    # If candidate doesn't have .NET, SAP, or Salesforce in skills, reject explicitly
    for incomp in INCOMPATIBLE_STACK_KEYWORDS:
        if incomp in t_lower:
            return False, f"Incompatible technology stack: '{incomp}'"

    # User Configured Include Keywords
    user_includes = [k.lower().strip() for k in cfg.get("include_keywords", []) if k.strip()]
    if user_includes:
        match_logic = (cfg.get("keyword_match_logic") or "OR").upper()
        if match_logic == "AND":
            if not all(inc in full_text for inc in user_includes):
                return False, f"Missing required include keywords (AND logic)"
        else:
            if not any(inc in full_text for inc in user_includes):
                return False, f"None of include keywords matched"

    # ── 3. Validate Job Title Match Against Target Titles ──────────
    matched_target = False
    for target in target_titles:
        t_clean = target.lower().strip()
        if not t_clean:
            continue

        # Exact or direct substring match
        if t_clean in t_lower:
            matched_target = True
            break

        # SDE variations (e.g. "SDE" matching "SDE-1", "SDE I", "SDE 1", "SDE Intern")
        if t_clean == "sde":
            if re.search(r"\bsde\b|\bsde[- ]?[1iI]\b|\bsde[- ]?intern\b", t_lower):
                matched_target = True
                break

        # Word-overlap match (e.g., "Software Development Engineer" vs "Software Engineer, Full Stack")
        words = [w for w in t_clean.split() if len(w) > 3]
        if words:
            overlap = sum(1 for w in words if w in t_lower)
            if overlap >= 2:
                matched_target = True
                break

    # General engineering & domain anchor fallback
    if not matched_target:
        has_role_anchor = any(r in t_lower for r in CORE_ROLE_ANCHORS)
        has_domain_anchor = any(d in t_lower for d in TARGET_DOMAIN_ANCHORS)
        if has_role_anchor and has_domain_anchor:
            matched_target = True

    if not matched_target:
        return False, f"Title does not match target roles ({clean_t})"

    # ── 4. Validate Location (if provided) ─────────────────────────
    if loc and target_locations:
        loc_lower = loc.lower().strip()

        # 4a. Reject any foreign countries or international hubs (Strict India Restriction)
        if is_foreign_location(loc_lower):
            return False, f"Strictly restricted to India: Foreign location detected ({loc})"

        has_remote_pref = any(r in ["remote", "work from home", "wfh"] for r in [tl.lower() for tl in target_locations])
        if has_remote_pref and any(r in loc_lower for r in ["remote", "anywhere", "work from home", "wfh", "virtual", "pan india"]):
            # If it's remote, ensure it does not require non-India residency (e.g. US Remote, EMEA Remote)
            if is_foreign_location(loc_lower):
                return False, f"Restricted to India: Foreign remote detected ({loc})"
            pass  # Allowed India-friendly remote
        else:
            # Check city match against candidate's target locations
            loc_matched = False
            for target_loc in target_locations:
                tl = target_loc.lower().strip()
                if tl in ["remote", "work from home", "wfh"]:
                    continue
                # Match city name or aliases
                if tl in loc_lower:
                    loc_matched = True
                    break
                if tl == "bangalore" and "bengaluru" in loc_lower:
                    loc_matched = True
                    break
                if tl == "gurgaon" and "gurugram" in loc_lower:
                    loc_matched = True
                    break
                if tl in ["delhi", "noida", "gurgaon", "faridabad", "ghaziabad"] and any(n in loc_lower for n in ["ncr", "national capital region"]):
                    loc_matched = True
                    break
                if tl == "noida" and any(u in loc_lower for u in ["uttar pradesh", "up"]):
                    loc_matched = True
                    break

            # If location is generic India, allow it
            if not loc_matched and any(g in loc_lower for g in ["india", "pan india", "multiple locations"]):
                loc_matched = True

            if not loc_matched and loc_lower not in ["unknown", "", "india"]:
                # Explicit non-target city (e.g. foreign cities or unconfigured states)
                return False, f"Location '{loc}' outside Indian target preferences"

    return True, "Passed all Search Targets & Preferences checks"


def calculate_job_fit_score(
    title: str,
    loc: str = "",
    description: str = "",
    config: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Calculates a fit score (50–99%) based on alignment with candidate targets & skills.
    """
    cfg = config or load_config()
    target_titles = cfg.get("job_titles", [])
    candidate_skills = cfg.get("skills", "")

    score = 65
    t_lower = (clean_job_title(title) or title).lower()

    # Exact target title match
    for t in target_titles:
        tl = t.lower().strip()
        if tl == t_lower:
            score += 25
            break
        elif tl in t_lower:
            score += 18
            break

    # Skills matching in title or description
    combined_text = f"{t_lower} {description.lower()}"
    if candidate_skills:
        skills = [s.strip().lower() for s in candidate_skills.split(",") if len(s.strip()) > 1]
        matches = sum(1 for s in skills if s in combined_text)
        score += min(15, matches * 4)

    return min(99, max(50, score))
