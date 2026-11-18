import json
import urllib.request
import urllib.parse
import re
import csv
import hashlib
import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed
from filelock import FileLock

from services.job_filter import (
    is_job_match,
    clean_job_title,
    clean_company_name,
    calculate_job_fit_score,
    is_foreign_location,
)

BASE_DIR = Path(__file__).resolve().parent.parent
COLLECTED_FILE = BASE_DIR / "collected_jobs.json"
APPLIED_FILE = BASE_DIR / "applied_jobs.csv"
CSV_LOCK_FILE = BASE_DIR / "applied_jobs.csv.lock"


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
    using thread-safe and process-safe FileLock.
    """
    if not new_jobs:
        return 0

    fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status", "description"]
    added = 0

    with FileLock(str(CSV_LOCK_FILE), timeout=10):
        existing_ids = set()
        if APPLIED_FILE.exists():
            try:
                with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
                    for r in csv.DictReader(f):
                        existing_ids.add(r.get("job_id", "").strip())
            except Exception:
                pass

        file_exists = APPLIED_FILE.exists() and APPLIED_FILE.stat().st_size > 0

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
                    "Not Applied",
                    (j.get("description") or j.get("snippet") or "").strip()
                ])
                existing_ids.add(jid)
                added += 1

        # Sync to user 1 directory if present
        try:
            user1_csv = BASE_DIR / "data" / "users" / "1" / "applied_jobs.csv"
            if user1_csv.parent.exists() and user1_csv != APPLIED_FILE:
                shutil.copy2(APPLIED_FILE, user1_csv)
        except Exception:
            pass

    return added


def collect_from_greenhouse(company: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
    jobs = []
    url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "8Oapply/2.0"})
        with urllib.request.urlopen(req, timeout=5) as res:
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
        req = urllib.request.Request(url, headers={"User-Agent": "8Oapply/2.0"})
        with urllib.request.urlopen(req, timeout=5) as res:
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


def query_single_search_portal(title: str, loc: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = []
    seen = set()
    query = f'site:lever.co OR site:greenhouse.io OR site:myworkdayjobs.com OR site:smartrecruiters.com "{title}" "{loc}" India'
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=6) as res:
            html = res.read().decode("utf-8", errors="ignore")
            matches = re.findall(r'uddg=([^&"\']+)', html)
            for raw_link in matches:
                link = urllib.parse.unquote(raw_link)
                if not any(k in link for k in ["lever.co", "greenhouse.io", "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com"]):
                    continue
                clean_url = link.split("?")[0].split("#")[0].rstrip("/")
                if clean_url in seen:
                    continue
                seen.add(clean_url)

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
                    results.append({
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
    return results


def discover_dynamic_career_jobs_parallel(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Dynamically discovers live openings across career portals in parallel using ThreadPoolExecutor.
    """
    job_titles = config.get("job_titles", ["Full Stack Developer"])
    locations = config.get("locations", ["Bangalore", "Remote"])
    discovered = []
    seen_urls = set()

    tasks = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        for title in job_titles[:3]:
            for loc in locations[:3]:
                tasks.append(executor.submit(query_single_search_portal, title, loc, config))

        for future in as_completed(tasks):
            try:
                res_list = future.result()
                for job in res_list:
                    if job["url"] not in seen_urls:
                        seen_urls.add(job["url"])
                        discovered.append(job)
            except Exception:
                pass

    return discovered


def run_job_collector(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    High-speed parallel job collector respecting user's platform priority ordering.
    """
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

    # 1. Parallel collection for explicit ATS target companies
    user_ats = [c.strip().lower() for c in config.get("ats_companies", []) if c.strip()]
    if user_ats:
        with ThreadPoolExecutor(max_workers=8) as executor:
            gh_futures = [executor.submit(collect_from_greenhouse, comp, config) for comp in user_ats]
            lever_futures = [executor.submit(collect_from_lever, comp, config) for comp in user_ats]

            for future in as_completed(gh_futures + lever_futures):
                try:
                    for job in future.result():
                        if job["id"] not in existing_ids:
                            new_jobs.append(job)
                            existing_ids.add(job["id"])
                except Exception:
                    pass

    # 2. Parallel dynamic discovery across search engines and career portals
    dynamic_jobs = discover_dynamic_career_jobs_parallel(config)
    for job in dynamic_jobs:
        if job["id"] not in existing_ids:
            new_jobs.append(job)
            existing_ids.add(job["id"])

    # 3. Sort by user's platform priority order + fit score
    priority_order = [p.lower() for p in (config.get("platform_priority_order") or config.get("platform_priority") or ["linkedin", "indeed", "naukri", "glassdoor", "internshala", "shine", "foundit", "timesjobs", "wellfound", "others"])]

    def get_sort_weight(job: Dict[str, Any]) -> int:
        src = (job.get("source") or "others").lower()
        if src in priority_order:
            return len(priority_order) - priority_order.index(src)
        return 0

    new_jobs.sort(key=lambda j: (get_sort_weight(j), j.get("fit_score", 50)), reverse=True)

    # Save to both collected_jobs.json AND applied_jobs.csv
    updated_list = new_jobs + existing_collected
    save_collected_jobs(updated_list)
    added_to_csv = append_to_applied_csv(new_jobs)

    return {
        "status": "success",
        "new_collected": len(new_jobs),
        "added_to_applications": added_to_csv,
        "total_in_pool": len(updated_list),
        "jobs": new_jobs[:25],
    }
