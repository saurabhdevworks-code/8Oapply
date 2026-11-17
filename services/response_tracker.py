import os
import json
import csv
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

BASE_DIR = Path(__file__).resolve().parent.parent
RESPONSES_FILE = BASE_DIR / "job_responses.json"
APPLIED_FILE = BASE_DIR / "applied_jobs.csv"

VALID_STATUSES = [
    "Applied",
    "Under Review",
    "Assessment (OA)",
    "Interview Scheduled",
    "Offer",
    "Rejected",
]

def load_responses() -> List[Dict[str, Any]]:
    responses = []
    if RESPONSES_FILE.exists():
        try:
            with open(RESPONSES_FILE, "r", encoding="utf-8") as f:
                responses = json.load(f)
        except Exception:
            responses = []

    # Sync from applied_jobs.csv if missing
    existing_ids = {r.get("job_id") for r in responses if r.get("job_id")}
    synced = False

    if APPLIED_FILE.exists():
        try:
            with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    jid = (row.get("job_id") or "").strip()
                    if jid and jid not in existing_ids:
                        responses.append({
                            "id": f"resp_{len(responses) + 1}_{int(datetime.now().timestamp())}",
                            "job_id": jid,
                            "company": (row.get("company") or "").strip(),
                            "job_title": (row.get("job_title") or "").strip(),
                            "platform": (row.get("platform") or "").strip(),
                            "url": (row.get("url") or "").strip(),
                            "applied_date": (row.get("date") or "").strip(),
                            "status": (row.get("status") or "").strip() or "Not Applied",
                            "sentiment": "Neutral",
                            "last_response_date": None,
                            "email_snippet": "",
                            "notes": "",
                            "interview_date": None,
                            "matched_keywords": [],
                        })
                        existing_ids.add(jid)
                        synced = True
        except Exception:
            pass

    if synced or not RESPONSES_FILE.exists():
        save_responses(responses)

    return responses

def save_responses(responses: List[Dict[str, Any]]) -> bool:
    try:
        with open(RESPONSES_FILE, "w", encoding="utf-8") as f:
            json.dump(responses, f, indent=2)
        return True
    except Exception:
        return False

def update_response_status(resp_id: str, status: str, notes: str = "", interview_date: str = None) -> Dict[str, Any]:
    responses = load_responses()
    target = None
    for r in responses:
        if r.get("id") == resp_id or r.get("job_id") == resp_id:
            if status in VALID_STATUSES:
                r["status"] = status
            if notes:
                r["notes"] = notes
            if interview_date:
                r["interview_date"] = interview_date
            r["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            target = r
            break

    if target:
        save_responses(responses)
        return target
    return {}

def record_inbox_match(
    company: str,
    status: str,
    sentiment: str,
    snippet: str,
    keywords: List[str],
    sender_email: str,
    ai_draft: str = ""
) -> Dict[str, Any]:
    responses = load_responses()
    comp_lower = company.lower()
    matched_entry = None

    # Try matching existing application
    for r in responses:
        if r.get("company") and comp_lower in r.get("company", "").lower():
            r["status"] = status
            r["sentiment"] = sentiment
            r["email_snippet"] = snippet
            r["last_response_date"] = datetime.now().strftime("%Y-%m-%d %H:%M")
            r["matched_keywords"] = keywords
            r["sender_email"] = sender_email
            if ai_draft:
                r["ai_draft_reply"] = ai_draft
            matched_entry = r
            break

    # If no existing application found, record as an unprompted recruiter outreach
    if not matched_entry:
        matched_entry = {
            "id": f"resp_{len(responses) + 1}_{int(datetime.now().timestamp())}",
            "job_id": f"inbox_{int(datetime.now().timestamp())}",
            "company": company,
            "job_title": "Identified from Recruiter Email",
            "platform": "Direct Email",
            "url": "",
            "applied_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "status": status,
            "sentiment": sentiment,
            "last_response_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "email_snippet": snippet,
            "notes": "Automatically identified by Inbox Watcher",
            "ai_draft_reply": ai_draft,
            "interview_date": None,
            "matched_keywords": keywords,
            "sender_email": sender_email,
        }
        responses.insert(0, matched_entry)

    save_responses(responses)
    return matched_entry

def get_response_metrics() -> Dict[str, int]:
    responses = load_responses()
    total = len(responses)
    applied = sum(1 for r in responses if r.get("status") == "Applied")
    under_review = sum(1 for r in responses if r.get("status") == "Under Review")
    assessment = sum(1 for r in responses if r.get("status") == "Assessment (OA)")
    interview = sum(1 for r in responses if r.get("status") == "Interview Scheduled")
    offer = sum(1 for r in responses if r.get("status") == "Offer")
    rejected = sum(1 for r in responses if r.get("status") == "Rejected")

    positive_count = assessment + interview + offer

    return {
        "total": total,
        "applied": applied,
        "under_review": under_review,
        "assessment": assessment,
        "interview": interview,
        "offer": offer,
        "rejected": rejected,
        "positive": positive_count,
    }

def extract_company_from_slug(slug_or_url: str) -> str:
    if not slug_or_url:
        return ""
    s = slug_or_url.split("?")[0].rstrip("/").split("/")[-1]
    cleaned = re.sub(r'-\d+-to-\d+-years.*$', '', s)
    cleaned = re.sub(r'-\d+-years.*$', '', cleaned)
    cleaned = re.sub(r'-\d+$', '', cleaned)
    cleaned = re.sub(r'^job-listings-', '', cleaned)
    m = re.search(r'(?:full-stack-developer|developer|engineer|sde)-(.*)', cleaned)
    rest = m.group(1) if m else cleaned
    known_locations = ['bengaluru', 'bangalore', 'mumbai', 'chennai', 'hyderabad', 'delhi', 'noida', 'gurgaon', 'pune', 'remote']
    tokens = rest.split('-')
    comp_tokens = []
    for t in tokens:
        if t in known_locations:
            break
        comp_tokens.append(t)
    name = ' '.join(comp_tokens).title().strip()
    return name if len(name) > 1 else ""

def sync_applied_jobs_with_inbox_and_lifecycle() -> Dict[str, Any]:
    """
    Auto-updates status of applied jobs:
    1. Resolves 'Unknown' company names from job URLs/slugs.
    2. Syncs status from inbox recruiter matches (Interview Scheduled, Assessment (OA), Rejected).
    3. Auto-advances applications >= 2 days old from 'Applied' to 'Under Review'.
    """
    if not APPLIED_FILE.exists():
        return {"updated_count": 0, "changes": []}

    responses = load_responses()
    resp_by_job_id = {r.get("job_id"): r for r in responses if r.get("job_id")}
    resp_by_comp = {(r.get("company") or "").strip().lower(): r for r in responses if (r.get("company") or "").strip()}

    rows = []
    changes = []
    now = datetime.now()
    fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status"]

    with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            old_status = (r.get("status") or "").strip() or "Not Applied"
            new_status = old_status
            comp = (r.get("company") or "").strip()

            # Fix Unknown company if possible
            if not comp or comp.lower() == "unknown":
                derived_comp = extract_company_from_slug(r.get("url") or r.get("job_id") or "")
                if derived_comp:
                    comp = derived_comp
                    r["company"] = derived_comp

            jid = (r.get("job_id") or "").strip()
            comp_lower = comp.lower()

            # 1. Match from inbox responses (Direct job_id match or company match)
            matched_resp = resp_by_job_id.get(jid)
            if not matched_resp and comp_lower:
                for c_key, res_obj in resp_by_comp.items():
                    if c_key and (c_key in comp_lower or comp_lower in c_key):
                        matched_resp = res_obj
                        break

            if matched_resp and matched_resp.get("status"):
                resp_stat = matched_resp["status"]
                if resp_stat in VALID_STATUSES and resp_stat != old_status:
                    new_status = resp_stat

            # 2. Lifecycle aging: If applied >= 2 days ago and still on Applied, auto-advance to Under Review
            if new_status == "Applied" and r.get("date"):
                try:
                    applied_dt = datetime.strptime(r["date"][:16], "%Y-%m-%d %H:%M")
                    days_diff = (now - applied_dt).total_seconds() / 86400.0
                    if days_diff >= 2.0:
                        new_status = "Under Review"
                except Exception:
                    pass

            if new_status != old_status:
                changes.append({
                    "job_id": jid,
                    "company": comp,
                    "old_status": old_status,
                    "new_status": new_status
                })
                r["status"] = new_status
            else:
                r["status"] = old_status

            rows.append(r)

    # Save back to CSV
    with open(APPLIED_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in fieldnames})

    # Keep responses file in sync
    save_responses(responses)

    return {
        "updated_count": len(changes),
        "total": len(rows),
        "changes": changes
    }
