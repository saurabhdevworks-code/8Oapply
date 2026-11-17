import json
import urllib.request
import urllib.parse
import re
import csv
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

from services.job_filter import is_job_match, clean_job_title, clean_company_name, calculate_job_fit_score, is_foreign_location

BASE_DIR = Path(__file__).resolve().parent.parent
COLLECTED_FILE = BASE_DIR / "collected_jobs.json"
APPLIED_FILE = BASE_DIR / "applied_jobs.csv"


def load_previously_applied_ids() -> set:
    applied = set()
    if APPLIED_FILE.exists():
        try:
            with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    jid = r.get("job_id", "").strip()
                    if jid:
                        applied.add(jid)
        except Exception:
            pass
    return applied


def load_collected_jobs() -> List[Dict[str, Any]]:
    if COLLECTED_FILE.exists():
        try:
            with open(COLLECTED_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_collected_jobs(jobs: List[Dict[str, Any]]) -> bool:
    try:
        with open(COLLECTED_FILE, "w", encoding="utf-8") as f:
            json.dump(jobs, f, indent=2)
        return True
    except Exception:
        return False


def append_to_applied_csv(new_jobs: List[Dict[str, Any]]) -> int:
    """
    Appends freshly collected matching jobs into applied_jobs.csv with status='Not Applied'
    so they immediately surface in the Applications Log for review and 1-click apply.
    """
    if not new_jobs:
        return 0

    fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status"]
    existing_ids = set()

    if APPLIED_FILE.exists():
        try:
            with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
                for r in csv.DictReader(f):
                    existing_ids.add(r.get("job_id", "").strip())
        except Exception:
            pass

    file_exists = APPLIED_FILE.exists() and APPLIED_FILE.stat().st_size > 0
    added = 0

    with open(APPLIED_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(fieldnames)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        for j in new_jobs:
            jid = j.get("id") or j.get("job_id", "")
            if jid in existing_ids:
                continue
            title = clean_job_title(j.get("job_title", ""))
            company = clean_company_name(j.get("company", ""), j.get("url", ""))
            platform = j.get("source", "Others")
            if platform == "Direct ATS":
                platform = "Others"

            writer.writerow([
                now_str,
                platform,
                title,
                company,
                jid,
                j.get("url", ""),
                "Not Applied"
            ])
            existing_ids.add(jid)
            added += 1

    return added


def collect_from_greenhouse(company: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
    jobs = []
    url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "8OMate/2.0"})
        with urllib.request.urlopen(req, timeout=6) as res:
            if res.status == 200:
                data = json.loads(res.read().decode("utf-8"))
                for item in data.get("jobs", []):
                    title = clean_job_title(item.get("title", ""))
                    loc = item.get("location", {}).get("name", "")

                    if is_foreign_location(loc):
                        continue

                    is_match, _ = is_job_match(title, loc=loc, company=company, config=config)
                    if is_match:
                        fit = calculate_job_fit_score(title, loc=loc, config=config)
                        jobs.append({
                            "id": f"gh_{company}_{item.get('id')}",
                            "company": company.title(),
                            "job_title": title,
                            "location": loc or "Remote (India)",
                            "url": item.get("absolute_url", ""),
                            "source": "Others",
                            "collected_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                            "status": "Not Applied",
                            "fit_score": fit,
                        })
    except Exception:
        pass
    return jobs


def collect_from_lever(company: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
    jobs = []
    url = f"https://api.lever.co/v0/postings/{company}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "8OMate/2.0"})
        with urllib.request.urlopen(req, timeout=6) as res:
            if res.status == 200:
                data = json.loads(res.read().decode("utf-8"))
                for item in data:
                    title = clean_job_title(item.get("text", ""))
                    loc = item.get("categories", {}).get("location", "")

                    if is_foreign_location(loc):
                        continue

                    is_match, _ = is_job_match(title, loc=loc, company=company, config=config)
                    if is_match:
                        fit = calculate_job_fit_score(title, loc=loc, config=config)
                        jobs.append({
                            "id": f"lever_{company}_{item.get('id')}",
                            "company": company.title(),
                            "job_title": title,
                            "location": loc or "Remote (India)",
                            "url": item.get("hostedUrl", ""),
                            "source": "Others",
                            "collected_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                            "status": "Not Applied",
                            "fit_score": fit,
                        })
    except Exception:
        pass
    return jobs


def discover_dynamic_career_jobs(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Dynamically discovers live openings matching candidate's target roles and locations
    across ANY employer's career portal without using any hardcoded company list.
    """
    job_titles = config.get("job_titles", ["Full Stack Developer"])
    locations = config.get("locations", ["Bangalore", "Remote"])
    discovered = []
    seen_urls = set()

    # Query first 2 primary target roles & locations
    for title in job_titles[:2]:
        for loc in locations[:2]:
            query = f'site:lever.co OR site:greenhouse.io OR site:myworkdayjobs.com OR site:smartrecruiters.com "{title}" "{loc}" India'
            url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
            try:
                with urllib.request.urlopen(req, timeout=5) as res:
                    html = res.read().decode("utf-8", errors="ignore")
                    matches = re.findall(r'uddg=([^&"\']+)', html)
                    for raw_link in matches:
                        link = urllib.parse.unquote(raw_link)
                        if not any(k in link for k in ["lever.co", "greenhouse.io", "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com"]):
                            continue
                        clean_url = link.split("?")[0].split("#")[0].rstrip("/")
                        if clean_url in seen_urls:
                            continue
                        seen_urls.add(clean_url)

                        # Extract company name dynamically from URL slug
                        company = "Direct Employer"
                        if "lever.co/" in clean_url:
                            parts = clean_url.split("lever.co/")
                            if len(parts) > 1:
                                company = parts[1].split("/")[0].replace("-", " ").title()
                        elif "greenhouse.io/" in clean_url:
                            parts = clean_url.split("greenhouse.io/")
                            if len(parts) > 1:
                                company = parts[1].split("/")[0].replace("-", " ").title()
                        elif "myworkdayjobs.com" in clean_url:
                            parts = clean_url.split("//")
                            if len(parts) > 1:
                                company = parts[1].split(".")[0].replace("-", " ").title()
                        elif "smartrecruiters.com/" in clean_url:
                            parts = clean_url.split("smartrecruiters.com/")
                            if len(parts) > 1:
                                company = parts[1].split("/")[0].replace("-", " ").title()

                        slug = clean_url.split("/")[-1].replace("-", " ").replace("_", " ").title()
                        job_t = slug if len(slug) > 4 else title

                        if is_foreign_location(clean_url) or is_foreign_location(job_t):
                            continue

                        is_match, _ = is_job_match(job_t, loc=loc, company=company, config=config)
                        if is_match:
                            fit = calculate_job_fit_score(job_t, loc=loc, config=config)
                            job_id = f"others-{hashlib.md5(clean_url.encode()).hexdigest()[:12]}"
                            discovered.append({
                                "id": job_id,
                                "company": company,
                                "job_title": clean_job_title(job_t),
                                "location": loc,
                                "url": clean_url,
                                "source": "Others",
                                "collected_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                                "status": "Not Applied",
                                "fit_score": fit,
                            })
            except Exception:
                pass
    return discovered


def run_job_collector(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Collects real matching jobs dynamically based on candidate's target roles and locations.
    Uses NO hardcoded company list.
    """
    # Strictly respect user's platform preferences: Only collect if 'Others' / Career Portals is enabled
    if not config.get("use_others", False):
        return {
            "status": "skipped",
            "message": "Career portals (Others) platform is disabled in preferences",
            "new_collected": 0,
            "added_to_applications": 0,
            "total_in_pool": len(load_collected_jobs()),
            "jobs": [],
        }

    already_applied = load_previously_applied_ids()
    existing_collected = load_collected_jobs()
    existing_ids = {j["id"] for j in existing_collected}.union(already_applied)

    new_jobs = []

    # 1. If user explicitly provided target companies in config, check their boards
    user_ats = [c.strip().lower() for c in config.get("ats_companies", []) if c.strip()]
    if user_ats:
        for comp in user_ats:
            for job in collect_from_greenhouse(comp, config):
                if job["id"] not in existing_ids:
                    new_jobs.append(job)
                    existing_ids.add(job["id"])

            for job in collect_from_lever(comp, config):
                if job["id"] not in existing_ids:
                    new_jobs.append(job)
                    existing_ids.add(job["id"])

    # 2. Dynamically discover active career postings without hardcoded company lists
    dynamic_jobs = discover_dynamic_career_jobs(config)
    for job in dynamic_jobs:
        if job["id"] not in existing_ids:
            new_jobs.append(job)
            existing_ids.add(job["id"])

    # Sort new jobs by fit score descending
    new_jobs.sort(key=lambda j: j.get("fit_score", 50), reverse=True)

    # Save to both collected_jobs.json AND applied_jobs.csv
    updated_list = new_jobs + existing_collected
    save_collected_jobs(updated_list)
    added_to_csv = append_to_applied_csv(new_jobs)

    return {
        "status": "success",
        "new_collected": len(new_jobs),
        "added_to_applications": added_to_csv,
        "total_in_pool": len(updated_list),
        "jobs": new_jobs[:20],
    }
