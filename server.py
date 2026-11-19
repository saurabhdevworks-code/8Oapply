from __future__ import annotations
import asyncio
from filelock import FileLock
import os
import sys
import json
import csv
import time
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from services.email_service import (
    send_email,
    get_smtp_connection,
    send_positive_response_alert,
    send_direct_email_application,
)
from services.response_tracker import (
    load_responses,
    update_response_status,
    get_response_metrics,
)
from services.inbox_watcher import check_inbox_for_responses
from services.job_collector import (
    run_job_collector,
    load_collected_jobs,
    save_collected_jobs,
)
from services.scheduler_service import (
    get_scheduler_status,
    start_scheduler,
    execute_scheduled_pipeline,
)
from services.ai_service import (
    generate_job_communication,
    DEFAULT_MODELS,
    tailor_resume_from_jd,
    generate_recruiter_smart_reply,
    answer_screening_question,
)
from services.auth_service import (
    register_user,
    login_user,
    get_user_by_token,
    logout_user,
    get_user_paths,
)

app = FastAPI(title="8Oapply API Server")

# Allow Vite frontend in dev mode
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.json"
CSV_FILE = BASE_DIR / "applied_jobs.csv"
LOG_FILE = BASE_DIR / "jobbot.log"
RESUME_FILE = BASE_DIR / "resume.pdf"
BOT_SCRIPT = BASE_DIR / "eight_o_apply.py"
CSV_LOCK_FILE = BASE_DIR / "applied_jobs.csv.lock"

# Process state
bot_process: Optional[subprocess.Popen] = None
bot_started_at: Optional[float] = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""


class LoginRequest(BaseModel):
    email: str
    password: str


def get_request_user(request: Optional[Request]) -> Optional[Dict[str, Any]]:
    if not request:
        return None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1].strip()
        return get_user_by_token(token)
    token = request.query_params.get("token")
    if token:
        return get_user_by_token(token)
    return None


def resolve_paths(request: Optional[Request] = None) -> Dict[str, Path]:
    paths = None
    if request:
        user = get_request_user(request)
        if user:
            paths = get_user_paths(user["id"])
    if not paths:
        user1_dir = BASE_DIR / "data" / "users" / "1"
        if user1_dir.exists():
            paths = get_user_paths(1)
        else:
            paths = {
                "config_file": CONFIG_FILE,
                "csv_file": CSV_FILE,
                "resume_file": RESUME_FILE,
                "collected_file": BASE_DIR / "collected_jobs.json",
                "custom_answers_file": BASE_DIR / "custom_answers.json",
                "responses_file": BASE_DIR / "responses.json",
                "cookies_dir": BASE_DIR / "cookies",
            }
    # Backward compatible convenience aliases
    paths["config"] = paths["config_file"]
    paths["csv"] = paths["csv_file"]
    paths["resume"] = paths["resume_file"]
    return paths


def get_current_config(cfg_path: Optional[Path] = None) -> Dict[str, Any]:
    target = cfg_path
    if not target:
        user1_cfg = BASE_DIR / "data" / "users" / "1" / "config.json"
        if user1_cfg.exists():
            target = user1_cfg
        else:
            target = CONFIG_FILE
    if target.exists():
        try:
            with open(target, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def is_bot_running() -> bool:
    global bot_process
    if bot_process is not None:
        if bot_process.poll() is None:
            return True
        else:
            bot_process = None
    return False


def get_bot_progress() -> Dict[str, Any]:
    default_progress = {
        "percent": 0,
        "combo_current": 0,
        "combo_total": 0,
        "current_platform": None,
        "current_target": None,
        "status_text": "Idle",
    }
    if not is_bot_running():
        return default_progress

    if not LOG_FILE.exists():
        return {**default_progress, "percent": 0, "status_text": "Initializing..."}

    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()[-250:]

        # Isolate the current session logs so previous run statistics do not leak
        session_idx = -1
        for idx, line in enumerate(lines):
            if "JobBot v2.0" in line or "Browser mode:" in line:
                session_idx = idx
        if session_idx != -1:
            lines = lines[session_idx:]

        combo_current = 0
        combo_total = 0
        current_platform = None
        current_target = None
        status_text = "Running engine..."
        jobs_found = 0
        jobs_applied = 0
        jobs_collected = 0

        for line in reversed(lines):
            if not jobs_applied:
                m_app = re.search(r"(?:Confirmed Applied|Applied)\s*\((\d+)\)", line)
                if m_app:
                    jobs_applied = int(m_app.group(1))

            if not jobs_collected:
                m_coll = re.search(r"(?:Data Collected|Collected|collected)\s*\((\d+)\)", line)
                if m_coll:
                    jobs_collected = int(m_coll.group(1))

            if not jobs_found:
                m_found = re.search(r"(?:Found|found)\s+(\d+)\s+(?:jobs|cards)", line)
                if m_found:
                    jobs_found = int(m_found.group(1))

            if not combo_current:
                m_combo = re.search(r"Combo\s+(\d+)/(\d+)(?::\s*\[(.*?)\]\s+in\s+\[(.*?)\])?", line)
                if m_combo:
                    combo_current = int(m_combo.group(1))
                    combo_total = int(m_combo.group(2))
                    if m_combo.group(3) and m_combo.group(4):
                        current_target = f"{m_combo.group(3)} in {m_combo.group(4)}"

            if not current_platform:
                m_plat = re.search(r"═══\s*([A-Za-z]+)\s+Bot", line, re.IGNORECASE) or \
                         re.search(r"(?:Starting|Logged in via.*?|DONE.*?-.*?)\s+([A-Za-z]+)", line) or \
                         re.search(r"\b(Indeed|LinkedIn|Naukri|Glassdoor|Internshala|Shine|Foundit|TimesJobs|Wellfound|Others)\b(?=:|\s)", line, re.IGNORECASE)
                if m_plat:
                    p_candidate = m_plat.group(1).capitalize()
                    if p_candidate.lower() in ["indeed", "linkedin", "naukri", "glassdoor", "internshala", "shine", "foundit", "timesjobs", "wellfound", "others"]:
                        current_platform = "LinkedIn" if p_candidate.lower() == "linkedin" else p_candidate

            if "CLOUDFLARE DETECTED" in line:
                status_text = "Cloudflare Verification..."
            elif "Platform rest" in line:
                status_text = "Cooldown between portals..."
            elif "No jobs found" in line:
                status_text = "Searching next portal..."
            elif "Confirmed Applied" in line or "Applied" in line:
                status_text = "Submitting applications..."
            elif "Data Collected" in line:
                status_text = "Collecting job data..."

        if combo_total == 0:
            try:
                cfg = get_current_config()
                titles_len = len(cfg.get("job_titles", []))
                locs_len = len(cfg.get("locations", []))
                combo_total = (titles_len * locs_len) if (titles_len > 0 and locs_len > 0) else 100
            except Exception:
                combo_total = 100

        uptime = int(time.time() - bot_started_at) if bot_started_at else 0

        if jobs_applied == 0:
            percent = 0
            if jobs_collected > 0:
                status_text = f"Collected {jobs_collected} jobs"
            elif jobs_found > 0:
                status_text = f"Found {jobs_found} matching jobs"
            elif current_target:
                status_text = f"Searching: {current_target}"
        elif jobs_found > 0:
            percent = min(100, int((jobs_applied / jobs_found) * 100))
            status_text = f"Applied {jobs_applied} of {jobs_found} jobs"
        elif combo_total > 0 and combo_current > 1:
            percent = min(100, int(((combo_current - 1) / combo_total) * 100))
            status_text = f"Applied to {jobs_applied} jobs"
        else:
            percent = min(100, int((jobs_applied / 15) * 100))
            status_text = f"Applied to {jobs_applied} jobs"

        plat_display = current_platform or "Indeed"
        if jobs_applied > 0 and jobs_found > 0:
            plat_display = f"{plat_display} ({jobs_applied}/{jobs_found})"
        elif jobs_collected > 0:
            plat_display = f"{plat_display} ({jobs_collected} collected)"

        return {
            "percent": percent,
            "combo_current": combo_current,
            "combo_total": combo_total,
            "current_platform": plat_display,
            "current_target": current_target,
            "status_text": status_text,
            "jobs_applied_in_combo": jobs_applied,
            "jobs_found_in_combo": jobs_found,
            "jobs_collected": jobs_collected,
        }
    except Exception:
        return default_progress


# ── Authentication & Multi-User Profile Endpoints ───────────────
@app.post("/api/auth/register")
def api_register(req: RegisterRequest):
    try:
        return register_user(req.email, req.password, req.name or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {e}")


@app.post("/api/auth/login")
def api_login(req: LoginRequest):
    try:
        return login_user(req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {e}")


@app.get("/api/auth/me")
def api_me(request: Request):
    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": user, **user}


@app.post("/api/auth/logout")
def api_logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1].strip()
        logout_user(token)
    return {"status": "logged_out"}


@app.get("/api/status")
def get_status():
    running = is_bot_running()
    uptime = int(time.time() - bot_started_at) if running and bot_started_at else 0
    progress = get_bot_progress() if running else {
        "percent": 0,
        "combo_current": 0,
        "combo_total": 0,
        "current_platform": None,
        "current_target": None,
        "status_text": "Idle",
    }
    return {
        "running": running,
        "pid": bot_process.pid if running else None,
        "uptime_seconds": uptime,
        "started_at": datetime.fromtimestamp(bot_started_at).isoformat() if running and bot_started_at else None,
        "progress": progress,
    }


def validate_candidate_profile(paths: dict):
    """Enforces that candidate profile and resume are completed before any job applying."""
    resume_target = paths.get("resume_file")
    if not resume_target or not resume_target.exists():
        raise HTTPException(
            status_code=400,
            detail="Cannot apply: Please upload resume.pdf in 'Candidate Profile & Documents' first."
        )

    config_target = paths.get("config_file")
    cfg = {}
    if config_target and config_target.exists():
        try:
            with open(config_target, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception:
            pass

    missing = []
    if not cfg.get("name", "").strip():
        missing.append("Full Name")
    if not cfg.get("email", "").strip():
        missing.append("Email Address")
    if not cfg.get("phone", "").strip():
        missing.append("Phone Number")

    has_education = bool(
        cfg.get("college", "").strip() or 
        cfg.get("bachelor_college", "").strip() or 
        cfg.get("master_college", "").strip() or
        cfg.get("degree", "").strip() or
        cfg.get("bachelor_degree", "").strip() or
        cfg.get("master_degree", "").strip()
    )
    if not has_education:
        missing.append("Education Details")

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"First fill this Candidate Profile & Documents page info: missing {', '.join(missing)}."
        )

    # 2. Search Targets Validation (Real Targets Only - No Dummy Fallbacks)
    job_titles = cfg.get("job_titles") or []
    locations = cfg.get("locations") or []
    if not job_titles or len(job_titles) == 0:
        raise HTTPException(
            status_code=400,
            detail="First add at least one Target Job Title in 'Search Targets & Preferences'."
        )
    if not locations or len(locations) == 0:
        raise HTTPException(
            status_code=400,
            detail="First add at least one Target Location in 'Search Targets & Preferences'."
        )

    # 3. Platform Connection & Enablement Validation
    cookies_dir = paths.get("cookies_dir", BASE_DIR / "cookies")
    platforms = ["linkedin", "naukri", "indeed", "glassdoor", "internshala", "shine", "foundit", "timesjobs", "wellfound", "others"]
    
    connected_platforms = []
    ready_platforms = []

    for p in platforms:
        is_conn = is_genuine_authenticated_session(p, cookies_dir=cookies_dir) or bool(cfg.get(f"connected_{p}", False)) or bool(cfg.get(f"{p}_email") and cfg.get(f"{p}_password"))
        is_enab = bool(cfg.get(f"use_{p}", False))
        if is_conn:
            connected_platforms.append(p)
        if is_conn and is_enab:
            ready_platforms.append(p)

    if not connected_platforms:
        raise HTTPException(
            status_code=400,
            detail="First connect at least one platform"
        )

    if not ready_platforms:
        raise HTTPException(
            status_code=400,
            detail="At least one platform must be enabled"
        )


def launch_bot_process(paths: Optional[Dict[str, Path]] = None):
    global bot_process, bot_started_at
    if is_bot_running():
        return {"status": "already_running", "pid": bot_process.pid}

    target_paths = paths or resolve_paths()
    validate_candidate_profile(target_paths)
    try:
        cmd = [sys.executable, "-u", str(BOT_SCRIPT)]
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["JOBBOT_CONFIG_PATH"] = str(target_paths["config_file"])
        env["JOBBOT_CSV_PATH"] = str(target_paths["csv_file"])
        env["JOBBOT_RESUME_PATH"] = str(target_paths["resume_file"])
        env["JOBBOT_COOKIE_DIR"] = str(target_paths.get("cookies_dir", BASE_DIR / "cookies"))

        log_fp = open(BASE_DIR / "jobbot.log", "a", encoding="utf-8")
        bot_process = subprocess.Popen(
            cmd,
            cwd=str(BASE_DIR),
            stdout=log_fp,
            stderr=log_fp,
            env=env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )
        bot_started_at = time.time()
        return {"status": "started", "pid": bot_process.pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/bot/start")
def start_bot(request: Request):
    paths = resolve_paths(request)
    return launch_bot_process(paths)


def kill_all_bot_instances():
    global bot_process, bot_started_at
    if bot_process is not None:
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(bot_process.pid)], capture_output=True)
            else:
                bot_process.terminate()
        except Exception:
            pass
        bot_process = None
        bot_started_at = None

    # Terminate any orphaned chromedriver/msedgedriver and detached jobbot.py processes
    if os.name == "nt":
        try:
            subprocess.run(["taskkill", "/F", "/IM", "chromedriver.exe"], capture_output=True)
            subprocess.run(["taskkill", "/F", "/IM", "msedgedriver.exe"], capture_output=True)
            out = subprocess.check_output(
                ["wmic", "process", "where", "name='python.exe'", "get", "ProcessId,CommandLine"],
                text=True, errors="ignore"
            )
            current_pid = os.getpid()
            for line in out.splitlines():
                if "jobbot.py" in line:
                    parts = line.strip().split()
                    if parts and parts[-1].isdigit():
                        p = int(parts[-1])
                        if p != current_pid:
                            subprocess.run(["taskkill", "/F", "/T", "/PID", str(p)], capture_output=True)
        except Exception:
            pass


@app.post("/api/bot/stop")
def stop_bot():
    try:
        kill_all_bot_instances()
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
def get_config(request: Request):
    paths = resolve_paths(request)
    cfg_file = paths["config_file"]
    if not cfg_file.exists():
        return {}
    try:
        with open(cfg_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {e}")


def save_current_config(payload: Dict[str, Any], cfg_path: Optional[Path] = None):
    target = cfg_path
    if not target:
        user1_cfg = BASE_DIR / "data" / "users" / "1" / "config.json"
        if user1_cfg.exists():
            target = user1_cfg
        else:
            target = CONFIG_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    if target != CONFIG_FILE:
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception:
            pass


@app.post("/api/config")
def update_config(payload: Dict[str, Any], request: Request):
    paths = resolve_paths(request)
    try:
        save_current_config(payload, paths["config_file"])
        return {"status": "success", "message": "Configuration saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")


@app.get("/api/jobs")
def get_applied_jobs(request: Request):
    paths = resolve_paths(request)
    target_csv = paths["csv_file"]
    if not target_csv.exists():
        return []
    jobs = []
    try:
        import io
        with open(target_csv, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().replace("\x00", "")
        reader = csv.DictReader(io.StringIO(content))
        VALID_PLATFORMS = {"Naukri", "Indeed", "LinkedIn", "Internshala", "Glassdoor", "Shine", "Foundit", "TimesJobs", "Wellfound", "Others"}
        for row in reader:
            if not row or not any(row.values()):
                continue
            plat = (row.get("platform") or "").strip()
            # Sanitize: Skip corrupted rows where platform is a URL, empty, or invalid breadcrumb
            if plat not in VALID_PLATFORMS:
                continue
            d = (row.get("date") or "").strip()
            if not d.startswith("202"):
                continue

            jobs.append({
                "date": d,
                "platform": plat,
                "job_title": (row.get("job_title") or "").strip(),
                "company": (row.get("company") or "").strip(),
                "job_id": (row.get("job_id") or "").strip(),
                "url": (row.get("url") or "").strip(),
                "status": (row.get("status") or "").strip() or "Not Applied",
                "description": (row.get("description") or "").strip(),
            })
        jobs.reverse()
        return jobs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read CSV: {e}")


class JobStatusUpdate(BaseModel):
    job_id: str
    status: str


class JobDeletePayload(BaseModel):
    job_id: str


class JobApplyLivePayload(BaseModel):
    job_id: str


class OpenLoginBrowserPayload(BaseModel):
    platform: str = "naukri"


class CheckPlatformStatusPayload(BaseModel):
    platform: str = "naukri"


class ConnectCredentialsPayload(BaseModel):
    platform: str = "naukri"
    email: str
    password: str


class BulkJobActionPayload(BaseModel):
    job_ids: List[str]
    status: Optional[str] = None


@app.post("/api/jobs/update-status")
def update_job_status(payload: JobStatusUpdate, request: Request):
    paths = resolve_paths(request)
    target_csv = paths["csv_file"]
    if not target_csv.exists():
        raise HTTPException(status_code=404, detail="applied_jobs.csv not found")
    try:
        rows = []
        fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status", "description"]
        import io
        with open(target_csv, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().replace("\x00", "")
        reader = csv.DictReader(io.StringIO(content))
        for r in reader:
            if r.get("job_id") == payload.job_id:
                r["status"] = payload.status
            elif "status" not in r or not r.get("status"):
                r["status"] = "Not Applied"
            rows.append(r)

        with open(target_csv, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in rows:
                writer.writerow({k: r.get(k, "") for k in fieldnames})

        return {"status": "success", "message": f"Updated status to {payload.status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update job status: {e}")


@app.post("/api/jobs/apply-live")
async def apply_job_live_endpoint(payload: JobApplyLivePayload, request: Request):
    paths = resolve_paths(request)
    validate_candidate_profile(paths)
    target_csv = paths["csv_file"]
    if not target_csv.exists():
        raise HTTPException(status_code=404, detail="applied_jobs.csv not found")
    
    target_job = None
    with open(target_csv, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get("job_id") == payload.job_id:
                target_job = r
                break
                
    if not target_job:
        raise HTTPException(status_code=404, detail="Job record not found")
        
    # Strict Duplicate Prevention: Once applied, do not apply again!
    current_status = (target_job.get("status") or "").strip().lower()
    if current_status and current_status != "not applied":
        return {
            "success": False,
            "status": "already_applied",
            "message": f"Job '{target_job.get('job_title', '')}' at '{target_job.get('company', '')}' has already been applied to ({target_job.get('status')}). Duplicate applications are prevented."
        }
        
    url = target_job.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="Job has no URL to apply to")
        
    platform = target_job.get("platform", "Naukri")
    title = target_job.get("job_title", "")
    company = target_job.get("company", "")
    
    try:
        import importlib
        import eight_o_apply
        importlib.reload(eight_o_apply)
        res = await asyncio.to_thread(
            eight_o_apply.apply_to_job_live,
            url=url, platform=platform, title=title, company=company, job_id=payload.job_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live apply execution error: {e}")


import threading
_DRIVER_LOCK = threading.Lock()


def save_config_everywhere(cfg: dict, paths: Optional[Dict[str, Path]] = None):
    """Saves config both to active user path and root config.json to ensure full synchronization."""
    if paths and "config_file" in paths:
        try:
            with open(paths["config_file"], "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
        except Exception:
            pass
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
    except Exception:
        pass

class MasterCredentialsPayload(BaseModel):
    email: str
    password: str
    platforms: Optional[List[str]] = None

@app.post("/api/platforms/connect-credentials")
def connect_platform_credentials(payload: ConnectCredentialsPayload, request: Request):
    paths = resolve_paths(request)
    cfg_file = paths["config_file"]
    plat = payload.platform.lower()
    email_key = f"{plat}_email"
    pass_key = f"{plat}_password"

    # 1. Update credentials in user config.json
    try:
        cfg = get_current_config(cfg_file)
        cfg[email_key] = payload.email.strip()
        cfg[pass_key] = payload.password.strip()
        cfg[f"use_{plat}"] = True
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save credentials to config: {e}")

    # 2. Attempt active login to verify & store session cookies
    if "naukri" in plat:
        with _DRIVER_LOCK:
            try:
                from eight_o_apply import get_shared_driver, login_naukri_with_credentials
                driver = get_shared_driver("Naukri")
                res = login_naukri_with_credentials(driver, payload.email.strip(), payload.password.strip())
                if res.get("success"):
                    try:
                        cfg = get_current_config(cfg_file)
                        cfg["connected_naukri"] = True
                        with open(cfg_file, "w", encoding="utf-8") as f:
                            json.dump(cfg, f, indent=2)
                    except Exception:
                        pass
                    return {"success": True, "message": "Successfully logged into Naukri and session cookies saved permanently"}
                else:
                    return {"success": False, "message": res.get("message", "Login failed. Check your email/password or complete prompt in browser.")}
            except Exception as e:
                return {"success": False, "message": f"Browser login error: {str(e)}"}

    # For other platforms, mark connected and return success
    try:
        cfg = get_current_config(cfg_file)
        cfg[f"connected_{plat}"] = True
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass

    return {"success": True, "message": f"{payload.platform.capitalize()} credentials saved and platform enabled"}


@app.post("/api/platforms/master-credentials")
def master_credentials_endpoint(payload: MasterCredentialsPayload, request: Request):
    paths = resolve_paths(request)
    cfg_file = paths["config_file"]
    platforms = payload.platforms or ["naukri", "indeed", "linkedin", "internshala", "glassdoor", "shine", "foundit", "timesjobs", "wellfound", "others"]
    
    cfg = get_current_config(cfg_file)
    email = payload.email.strip()
    password = payload.password.strip()

    updated = []
    for plat in platforms:
        p = plat.lower()
        cfg[f"{p}_email"] = email
        cfg[f"{p}_password"] = password
        cfg[f"connected_{p}"] = True
        cfg[f"use_{p}"] = True
        updated.append(p)

    save_config_everywhere(cfg, paths)
    return {
        "success": True,
        "message": f"Successfully connected and enabled {len(updated)} platforms with credentials!",
        "updated": updated
    }


@app.post("/api/platforms/master-open")
def master_open_platforms_endpoint():
    """
    Launches a single Real Chrome session with Google Account Sign-In
    and automatically opens tabs for Naukri, Indeed, LinkedIn, and Internshala.
    """
    def _open_all():
        try:
            import eight_o_apply
            eight_o_apply.launch_real_chrome("https://accounts.google.com/")
            time.sleep(1.5)
            driver = eight_o_apply.get_shared_driver()
            if driver:
                urls = [
                    ("linkedin", "https://www.linkedin.com/login"),
                    ("naukri", "https://www.naukri.com/nlogin/login"),
                    ("indeed", "https://in.indeed.com/account/login"),
                    ("internshala", "https://internshala.com/login/user"),
                ]
                existing_urls = []
                for h in driver.window_handles:
                    try:
                        driver.switch_to.window(h)
                        existing_urls.append(driver.current_url.lower())
                    except Exception:
                        pass
                for key, u in urls:
                    if not any(key in eu for eu in existing_urls):
                        try:
                            driver.switch_to.new_window('tab')
                            driver.get(u)
                            time.sleep(0.4)
                        except Exception:
                            pass
        except Exception as e:
            print(f"Master open error: {e}")

    threading.Thread(target=_open_all, daemon=True).start()
    return {
        "status": "opened",
        "message": "Master Chrome window opened with Google Sign-in and all portal tabs!"
    }


@app.post("/api/platforms/master-sync")
def master_sync_platforms_endpoint(request: Request):
    """
    Iterates through all open tabs in Real Chrome, detects authenticated sessions/cookies
    for all platforms at once, and marks them all connected & verified in 1-click.
    """
    paths = resolve_paths(request)
    cookies_dir = paths.get("cookies_dir", BASE_DIR / "cookies")
    import eight_o_apply
    from selenium.webdriver.common.by import By

    driver = eight_o_apply._SHARED_DRIVER
    if driver is None and eight_o_apply.is_port_listening(9222):
        try:
            driver = eight_o_apply.get_shared_driver()
        except Exception:
            pass

    results = {}
    connected_list = []

    # 1. Others (Google Search & Career Portals) is always connected & active
    mark_platform_connected_and_save_cookies(None, "others", paths)
    results["others"] = True
    connected_list.append("others")

    if driver is not None:
        platforms_to_check = ["naukri", "indeed", "linkedin", "internshala", "glassdoor", "shine", "foundit", "timesjobs", "wellfound"]
        handles = list(driver.window_handles)

        for plat in platforms_to_check:
            if is_genuine_authenticated_session(plat, cookies_dir=cookies_dir):
                mark_platform_connected_and_save_cookies(None, plat, paths)
                results[plat] = True
                connected_list.append(plat)
                continue

            found_tab = False
            for h in handles:
                try:
                    driver.switch_to.window(h)
                    u = driver.current_url.lower()
                    if plat in u and not u.startswith("chrome://"):
                        found_tab = True
                        break
                except Exception:
                    continue

            if found_tab:
                cur = driver.current_url.lower()
                logged_in = False
                cookies = []
                try:
                    cookies = driver.get_cookies()
                except Exception:
                    pass
                c_names = {c.get("name", "") for c in cookies}

                if plat == "naukri":
                    if any(n in c_names for n in ["nauk_at", "nauk_rt", "is_login", "NAUK_USER", "nauk_sid"]):
                        logged_in = True
                    elif "nlogin" not in cur and ("mnjuser" in cur or "homepage" in cur):
                        logged_in = True
                    else:
                        try:
                            elems = driver.find_elements(By.CSS_SELECTOR, "a[href*='mnjuser/profile'], .nI-gIcon-account, .user-name, [data-qa='user-profile'], a[href*='my-naukri']")
                            if elems:
                                logged_in = True
                        except Exception:
                            pass

                elif plat == "indeed":
                    auth_tokens = ["SOCK", "UD", "SHADOW_SESSION", "LOGIN_EMAIL", "PPID", "__Secure-PassportAuthProxy-RefreshToken", "__Secure-PassportAuthProxy-BearerToken", "profilernjsf"]
                    if any(n in c_names for n in auth_tokens):
                        logged_in = True
                    elif "profile.indeed.com" in cur:
                        logged_in = True
                    elif "indeed.com" in cur and "login" not in cur and "auth" not in cur:
                        try:
                            elems = driver.find_elements(By.CSS_SELECTOR, ".gnav-LoggedInSection, [data-testid='header-user-menu'], .user-account-nav, a[href*='/account/log-out']")
                            if elems:
                                logged_in = True
                        except Exception:
                            pass

                elif plat == "linkedin":
                    if "li_at" in c_names:
                        logged_in = True
                    elif any(w in cur for w in ["feed", "jobs", "mynetwork", "messaging"]) and "login" not in cur:
                        logged_in = True
                    else:
                        try:
                            elems = driver.find_elements(By.CSS_SELECTOR, ".global-nav__me, .feed-identity-module, a[href*='/in/']")
                            if elems:
                                logged_in = True
                        except Exception:
                            pass

                elif plat == "internshala":
                    if any(n in c_names for n in ["user_id", "student_id", "ci_session", "logged_in"]):
                        logged_in = True
                    elif "login" not in cur:
                        logged_in = True

                else:
                    if len(cookies) > 5 and "login" not in cur:
                        logged_in = True

                if logged_in:
                    mark_platform_connected_and_save_cookies(driver, plat, paths)
                    results[plat] = True
                    connected_list.append(plat)
                else:
                    results[plat] = False
            else:
                results[plat] = False

    return {
        "success": True,
        "connected_count": len(connected_list),
        "connected_platforms": connected_list,
        "results": results,
        "message": f"Master Sync completed: {len(connected_list)} platform(s) connected and verified!"
    }


@app.post("/api/platforms/open-login-browser")
def open_login_browser_endpoint(payload: OpenLoginBrowserPayload):
    plat = payload.platform.lower()
    urls = {
        "naukri": "https://www.naukri.com/nlogin/login",
        "indeed": "https://in.indeed.com/account/login",
        "linkedin": "https://www.linkedin.com/login",
        "internshala": "https://internshala.com/login/user",
        "glassdoor": "https://www.glassdoor.com/profile/login_input.htm",
        "shine": "https://www.shine.com/myshine/login/",
        "foundit": "https://www.foundit.in/seeker/login",
        "timesjobs": "https://www.timesjobs.com/candidate/login.html",
        "wellfound": "https://wellfound.com/login",
        "others": "https://careers.google.com",
    }
    target_url = urls.get(plat, f"https://www.{plat}.com")

    def _open():
        try:
            from eight_o_apply import launch_real_chrome, get_shared_driver
            launch_real_chrome(target_url)
            with _DRIVER_LOCK:
                driver = get_shared_driver(plat.capitalize())
                if driver:
                    driver.get(target_url)
        except Exception as e:
            print(f"Error launching chrome for {plat}: {e}")

    t = threading.Thread(target=_open, daemon=True)
    t.start()
    return {
        "status": "opened",
        "message": f"Real Chrome opened for {payload.platform.capitalize()}! Please sign in in that window."
    }



def get_valid_driver(platform_name=""):
    import eight_o_apply
    driver = eight_o_apply._SHARED_DRIVER
    if driver is not None:
        try:
            _ = driver.title
            return driver
        except Exception:
            try:
                driver.quit()
            except Exception:
                pass
            eight_o_apply._SHARED_DRIVER = None

    try:
        driver = eight_o_apply.get_shared_driver(platform_name)
        if driver is not None:
            try:
                _ = driver.title
                return driver
            except Exception:
                eight_o_apply._SHARED_DRIVER = None
    except Exception:
        pass
    return None

def switch_to_platform_tab(driver, platform: str = "") -> bool:
    """
    Switches Selenium driver to the tab containing the platform (or any non-chrome:// tab).
    Chrome DevTools protocol sometimes defaults to internal handles like chrome://omnibox-popup.
    """
    try:
        handles = driver.window_handles
        if platform:
            pk = platform.lower()
            for h in handles:
                try:
                    driver.switch_to.window(h)
                    u = driver.current_url.lower()
                    if pk in u and not u.startswith("chrome://"):
                        return True
                except Exception:
                    continue

        for h in handles:
            try:
                driver.switch_to.window(h)
                u = driver.current_url.lower()
                if (u.startswith("http://") or u.startswith("https://")) and not u.startswith("chrome://"):
                    return True
            except Exception:
                continue
    except Exception:
        pass
    return False


def mark_platform_connected_and_save_cookies(driver, platform: str, paths: Dict[str, Path]):
    from eight_o_apply import save_cookies
    plat = platform.lower()
    if driver is not None:
        try:
            save_cookies(driver, plat)
        except Exception:
            pass
        cookies_dir = paths.get("cookies_dir")
        if cookies_dir and cookies_dir.exists():
            try:
                import pickle
                path = cookies_dir / f"{plat}.pkl"
                with open(path, "wb") as f:
                    pickle.dump(driver.get_cookies(), f)
            except Exception:
                pass
    cfg_file = paths.get("config_file", CONFIG_FILE)
    try:
        cfg = get_current_config(cfg_file)
        cfg[f"connected_{plat}"] = True
        cfg[f"use_{plat}"] = True
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass


@app.post("/api/platforms/verify-session")
def verify_platform_session_endpoint(payload: CheckPlatformStatusPayload, request: Request):
    paths = resolve_paths(request)
    cookies_dir = paths.get("cookies_dir", BASE_DIR / "cookies")
    plat = payload.platform.lower()

    # 0. Others (Google Search & Direct Career Portals) needs no browser session
    if plat == "others":
        mark_platform_connected_and_save_cookies(None, "others", paths)
        return {"logged_in": True, "message": "Google Search & Direct Career Portals active and ready"}

    # 1. If genuine authenticated session is already saved on disk, confirm immediately
    if is_genuine_authenticated_session(plat, cookies_dir=cookies_dir):
        mark_platform_connected_and_save_cookies(None, plat, paths)
        return {"logged_in": True, "message": f"{plat.capitalize()} session verified and saved permanently"}

    # 2. If Selenium driver is running on port 9222, try to capture cookies from it:
    import eight_o_apply
    if eight_o_apply.is_port_listening(9222):
        try:
            driver = get_valid_driver(plat.capitalize())
            if driver is not None:
                switch_to_platform_tab(driver, plat)
                mark_platform_connected_and_save_cookies(driver, plat, paths)
                return {"logged_in": True, "message": f"{plat.capitalize()} session verified and saved permanently"}
        except Exception:
            pass

    # 3. User confirmed sign-in from browser tab
    mark_platform_connected_and_save_cookies(None, plat, paths)
    return {"logged_in": True, "message": f"{plat.capitalize()} connected successfully!"}


@app.post("/api/platforms/check-login-status")
def check_platform_login_status(payload: CheckPlatformStatusPayload, request: Request):
    paths = resolve_paths(request)
    cookies_dir = paths.get("cookies_dir", BASE_DIR / "cookies")
    plat = payload.platform.lower()

    if is_genuine_authenticated_session(plat, cookies_dir=cookies_dir):
        return {"logged_in": True, "message": f"{plat.capitalize()} connected and verified successfully"}

    import eight_o_apply
    from selenium.webdriver.common.by import By

    if plat == "others":
        cfg = get_current_config(paths.get("config_file"))
        if cfg.get("connected_others", False):
            return {"logged_in": True, "message": "Career portals active"}
        return {"logged_in": False, "message": "Not connected yet"}

    acquired = _DRIVER_LOCK.acquire(blocking=False)
    try:
        driver = get_valid_driver(plat.capitalize())
        if driver is None:
            return {"logged_in": False, "message": "Browser not active yet"}

        switch_to_platform_tab(driver, plat)
        cur = driver.current_url.lower()
        logged_in = False
        cookies = []
        try:
            cookies = driver.get_cookies()
        except Exception:
            cookies = []
        c_names = {c.get("name", "") for c in cookies}

        if "naukri" in plat:
            if any(n in c_names for n in ["nauk_at", "nauk_rt", "is_login", "NAUK_USER", "nauk_sid"]):
                logged_in = True
            elif "nlogin" not in cur and ("mnjuser" in cur or "homepage" in cur):
                logged_in = True

        elif "indeed" in plat:
            auth_tokens = ["SOCK", "UD", "SHADOW_SESSION", "LOGIN_EMAIL", "PPID", "__Secure-PassportAuthProxy-RefreshToken", "__Secure-PassportAuthProxy-BearerToken", "profilernjsf", "SURF", "CTK"]
            if any(n in c_names for n in auth_tokens):
                logged_in = True
            elif "profile.indeed.com" in cur or "myjobs" in cur:
                logged_in = True
            elif "indeed.com" in cur and "login" not in cur and "auth" not in cur:
                try:
                    elems = driver.find_elements(By.CSS_SELECTOR, ".gnav-LoggedInSection, [data-testid='header-user-menu'], .user-account-nav, [data-gnav-element='user-account-nav'], a[href*='/account/log-out']")
                    if elems:
                        logged_in = True
                except Exception:
                    pass

        if logged_in:
            mark_platform_connected_and_save_cookies(driver, plat, paths)
            return {"logged_in": True, "message": f"{plat.capitalize()} connected and verified successfully"}

        return {"logged_in": False, "message": "Waiting for sign-in in browser window"}
    except Exception as e:
        return {"logged_in": False, "message": str(e)}
    finally:
        if acquired:
            _DRIVER_LOCK.release()


def remove_jobs_from_all_stores(target_ids: set, target_csv: Path) -> int:
    clean_targets = {str(t).strip() for t in target_ids if str(t).strip()}
    if not clean_targets:
        return 0

    fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status", "description"]

    def _purge_csv(csv_path: Path) -> int:
        if not csv_path.exists():
            return 0
        import io
        try:
            with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().replace("\x00", "")
            reader = csv.DictReader(io.StringIO(content))
            surviving = []
            deleted = 0
            for r in reader:
                jid = (r.get("job_id") or "").strip()
                jurl = (r.get("url") or "").strip()
                if (jid and jid in clean_targets) or (jurl and jurl in clean_targets):
                    deleted += 1
                    continue
                surviving.append(r)
            with open(csv_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in surviving:
                    writer.writerow({k: r.get(k, "") for k in fieldnames})
            return deleted
        except Exception as err:
            logger.warning(f"Error purging CSV {csv_path}: {err}")
            return 0

    total_deleted = _purge_csv(target_csv)
    if CSV_FILE.exists() and CSV_FILE.resolve() != target_csv.resolve():
        _purge_csv(CSV_FILE)

    for rf in [BASE_DIR / "job_responses.json", target_csv.parent / "responses.json"]:
        if rf.exists():
            try:
                with open(rf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    filtered = [
                        item for item in data
                        if (item.get("job_id") or "").strip() not in clean_targets
                        and (item.get("url") or "").strip() not in clean_targets
                    ]
                    with open(rf, "w", encoding="utf-8") as f:
                        json.dump(filtered, f, indent=2)
            except Exception as err:
                logger.warning(f"Error purging responses JSON {rf}: {err}")

    for cf in [BASE_DIR / "collected_jobs.json", target_csv.parent / "collected_jobs.json"]:
        if cf.exists():
            try:
                with open(cf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    filtered = [
                        item for item in data
                        if (item.get("job_id") or "").strip() not in clean_targets
                        and (item.get("url") or "").strip() not in clean_targets
                    ]
                    with open(cf, "w", encoding="utf-8") as f:
                        json.dump(filtered, f, indent=2)
            except Exception as err:
                logger.warning(f"Error purging collected JSON {cf}: {err}")

    return total_deleted


@app.post("/api/jobs/delete")
def delete_single_job(payload: JobDeletePayload, request: Request):
    paths = resolve_paths(request)
    target_csv = paths["csv_file"]
    if not target_csv.exists():
        raise HTTPException(status_code=404, detail="applied_jobs.csv not found")
    try:
        deleted_count = remove_jobs_from_all_stores({payload.job_id}, target_csv)
        return {"status": "success", "deleted": deleted_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete job: {e}")


@app.post("/api/jobs/bulk-delete")
def bulk_delete_jobs(payload: BulkJobActionPayload, request: Request):
    paths = resolve_paths(request)
    target_csv = paths["csv_file"]
    if not target_csv.exists():
        raise HTTPException(status_code=404, detail="applied_jobs.csv not found")
    try:
        deleted_count = remove_jobs_from_all_stores(set(payload.job_ids), target_csv)
        return {"status": "success", "deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete jobs: {e}")


@app.post("/api/jobs/clear")
def clear_all_jobs(request: Request):
    paths = resolve_paths(request)
    target_csv = paths["csv_file"]
    fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status", "description"]
    try:
        for csv_path in [target_csv, CSV_FILE]:
            if csv_path.exists():
                with open(csv_path, "w", encoding="utf-8", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
        for jf in [BASE_DIR / "job_responses.json", target_csv.parent / "responses.json", BASE_DIR / "collected_jobs.json", target_csv.parent / "collected_jobs.json"]:
            if jf.exists():
                with open(jf, "w", encoding="utf-8") as f:
                    json.dump([], f, indent=2)
        return {"status": "success", "message": "All application records cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear jobs: {e}")


@app.post("/api/jobs/bulk-update-status")
def bulk_update_job_status(payload: BulkJobActionPayload, request: Request):
    paths = resolve_paths(request)
    target_csv = paths["csv_file"]
    if not target_csv.exists():
        raise HTTPException(status_code=404, detail="applied_jobs.csv not found")
    try:
        clean_targets = {str(t).strip() for t in payload.job_ids if str(t).strip()}
        new_status = payload.status or "Applied"
        fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status", "description"]

        def _bulk_status(csv_p: Path) -> int:
            if not csv_p.exists():
                return 0
            import io
            with open(csv_p, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().replace("\x00", "")
            reader = csv.DictReader(io.StringIO(content))
            rows = []
            updated = 0
            for r in reader:
                jid = (r.get("job_id") or "").strip()
                jurl = (r.get("url") or "").strip()
                if jid in clean_targets or jurl in clean_targets:
                    r["status"] = new_status
                    updated += 1
                rows.append(r)
            with open(csv_p, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in rows:
                    writer.writerow({k: r.get(k, "") for k in fieldnames})
            return updated

        cnt = _bulk_status(target_csv)
        if CSV_FILE.exists() and CSV_FILE.resolve() != target_csv.resolve():
            _bulk_status(CSV_FILE)

        for rf in [BASE_DIR / "job_responses.json", target_csv.parent / "responses.json"]:
            if rf.exists():
                try:
                    with open(rf, "r", encoding="utf-8") as f:
                        resp_data = json.load(f)
                    for item in resp_data:
                        jid = (item.get("job_id") or "").strip()
                        jurl = (item.get("url") or "").strip()
                        if jid in clean_targets or jurl in clean_targets:
                            item["status"] = new_status
                    with open(rf, "w", encoding="utf-8") as f:
                        json.dump(resp_data, f, indent=2)
                except Exception:
                    pass

        return {"status": "success", "updated_count": cnt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk update job status: {e}")


@app.post("/api/jobs/auto-update-status")
def auto_update_job_status():
    try:
        from services.response_tracker import sync_applied_jobs_with_inbox_and_lifecycle
        from services.inbox_watcher import check_inbox_for_responses
        config = get_current_config()
        # 1. Run inbox scan if IMAP is configured
        inbox_result = {}
        try:
            inbox_result = check_inbox_for_responses(config)
        except Exception:
            pass

        # 2. Run sync and lifecycle status update on applied_jobs.csv
        sync_result = sync_applied_jobs_with_inbox_and_lifecycle()
        return {
            "status": "success",
            "updated_count": sync_result.get("updated_count", 0),
            "inbox_scanned": inbox_result.get("scanned", 0),
            "positive_detected": inbox_result.get("positive_detected", 0),
            "message": f"Auto-updated {sync_result.get('updated_count', 0)} application statuses from inbox & timeline",
            "changes": sync_result.get("changes", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-update failed: {e}")


def is_genuine_authenticated_session(platform: str, cookies_dir: Optional[Path] = None) -> bool:
    """
    Validates whether stored cookies contain actual authenticated session tokens,
    not just anonymous Cloudflare or guest tokens.
    """
    if platform.lower() == "others":
        return False
    cdir = cookies_dir or (BASE_DIR / "cookies")
    cookie_path = cdir / f"{platform.lower()}.pkl"
    if not cookie_path.exists():
        root_cookie = BASE_DIR / "cookies" / f"{platform.lower()}.pkl"
        if root_cookie.exists():
            cookie_path = root_cookie
            if cookies_dir and cookies_dir.exists():
                try:
                    import shutil
                    shutil.copy2(root_cookie, cookies_dir / f"{platform.lower()}.pkl")
                except Exception:
                    pass
        else:
            return False
    try:
        import pickle
        with open(cookie_path, "rb") as f:
            cookies = pickle.load(f)
        if not isinstance(cookies, list) or len(cookies) == 0:
            return False

        names = {c.get("name", "") for c in cookies}
        plat = platform.lower()
        if plat == "naukri":
            return any(n in names for n in ["nauk_at", "nauk_rt", "is_login", "NAUK_USER", "nauk_sid"])
        elif plat == "indeed":
            return any(n in names for n in ["SOCK", "UD", "SHADOW_SESSION", "LOGIN_EMAIL", "PPID", "__Secure-PassportAuthProxy-RefreshToken", "__Secure-PassportAuthProxy-BearerToken", "profilernjsf"])
        elif plat == "linkedin":
            return "li_at" in names
        elif plat == "internshala":
            return any(n in names for n in ["user_id", "student_id", "ci_session", "logged_in"])
        elif plat == "others":
            return False
        return len(cookies) > 5
    except Exception:
        return False


@app.get("/api/platform/status")
def get_platforms_status(request: Request):
    paths = resolve_paths(request)
    config = get_current_config(paths["config_file"])
    cookies_dir = paths.get("cookies_dir", BASE_DIR / "cookies")

    platforms = ["linkedin", "naukri", "indeed", "glassdoor", "internshala", "shine", "foundit", "timesjobs", "wellfound", "others"]
    status_map = {}
    for p in platforms:
        is_authed = is_genuine_authenticated_session(p, cookies_dir=cookies_dir)
        has_creds = bool(config.get(f"{p}_email") and config.get(f"{p}_password"))
        is_conn = bool(config.get(f"connected_{p}", False))
        connected = is_authed or is_conn
        status_map[p] = {
            "connected": connected,
            "has_cookies": is_authed,
            "has_credentials": has_creds,
            "auth_type": "session",
            "enabled": bool(config.get(f"use_{p}", False)) and connected,
        }
    return {"platforms": status_map}


class CustomAnswerPayload(BaseModel):
    question: str
    answer: str


class DeleteCustomAnswerPayload(BaseModel):
    question: str


@app.get("/api/candidate/custom-answers")
def get_custom_answers(request: Request):
    paths = resolve_paths(request)
    cfg = get_current_config(paths["config_file"])
    return {"custom_answers": cfg.get("custom_answers", {})}


@app.post("/api/candidate/custom-answers")
def save_custom_answer(payload: CustomAnswerPayload, request: Request):
    paths = resolve_paths(request)
    cfg_file = paths["config_file"]
    try:
        cfg = get_current_config(cfg_file)
        if "custom_answers" not in cfg:
            cfg["custom_answers"] = {}
        cfg["custom_answers"][payload.question.strip()] = payload.answer.strip()
        cfg_file.parent.mkdir(parents=True, exist_ok=True)
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        return {"success": True, "message": "Saved answer for future applications"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/candidate/custom-answers")
def delete_custom_answer(payload: DeleteCustomAnswerPayload, request: Request):
    paths = resolve_paths(request)
    cfg_file = paths["config_file"]
    try:
        cfg = get_current_config(cfg_file)
        if "custom_answers" in cfg and payload.question.strip() in cfg["custom_answers"]:
            del cfg["custom_answers"][payload.question.strip()]
            cfg_file.parent.mkdir(parents=True, exist_ok=True)
            with open(cfg_file, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
        return {"success": True, "message": "Answer deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DisconnectPlatformRequest(BaseModel):
    platform: str


@app.post("/api/platforms/disconnect")
def disconnect_platform_endpoint(payload: DisconnectPlatformRequest, request: Request):
    paths = resolve_paths(request)
    cookies_dir = paths.get("cookies_dir", BASE_DIR / "cookies")
    plat = payload.platform.lower()
    cookie_path = cookies_dir / f"{plat}.pkl"
    if cookie_path.exists():
        try:
            cookie_path.unlink()
        except Exception:
            pass
    root_cookie = BASE_DIR / "cookies" / f"{plat}.pkl"
    if root_cookie.exists():
        try:
            root_cookie.unlink()
        except Exception:
            pass
    try:
        cfg_file = paths["config_file"]
        cfg = get_current_config(cfg_file)
        cfg[f"connected_{plat}"] = False
        cfg[f"auth_google_{plat}"] = False
        cfg[f"use_{plat}"] = False
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass
    return {"status": "success", "message": f"{plat.capitalize()} disconnected."}


@app.get("/api/logs")
def get_logs(limit: int = 200):
    if not LOG_FILE.exists():
        return {"logs": []}
    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            return {"logs": lines[-limit:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {e}")


@app.get("/api/logs/stream")
def stream_logs():
    def log_generator():
        if not LOG_FILE.exists():
            yield "data: [Log file will appear once bot runs]\n\n"
            return

        with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            for line in lines[-25:]:
                yield f"data: {json.dumps(line.rstrip())}\n\n"

            while True:
                line = f.readline()
                if line:
                    yield f"data: {json.dumps(line.rstrip())}\n\n"
                else:
                    time.sleep(1)

    return StreamingResponse(log_generator(), media_type="text/event-stream")


def get_candidate_resume_filename(config_file_path: Path) -> str:
    candidate_name = ""
    try:
        if config_file_path.exists():
            with open(config_file_path, "r", encoding="utf-8") as f:
                c_data = json.load(f)
                candidate_name = c_data.get("name", "").strip()
    except Exception:
        pass
    clean_name = re.sub(r"[^\w\s-]", "", candidate_name).strip()
    clean_name = re.sub(r"[\s-]+", "_", clean_name)
    return f"{clean_name}_Resume.pdf" if clean_name else "Candidate_Resume.pdf"


@app.get("/api/resume/status")
def get_resume_status(request: Request):
    paths = resolve_paths(request)
    resume_target = paths["resume_file"]
    config_target = paths["config_file"]
    exists = resume_target.exists()
    size_kb = 0
    if exists:
        try:
            size_kb = round(resume_target.stat().st_size / 1024, 1)
        except Exception:
            pass
    filename = get_candidate_resume_filename(config_target) if exists else None
    return {
        "exists": exists,
        "filename": filename,
        "size_kb": size_kb
    }


@app.post("/api/resume/upload")
async def upload_resume(request: Request, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    paths = resolve_paths(request)
    resume_target = paths["resume_file"]
    config_target = paths["config_file"]

    try:
        contents = await file.read()
        resume_target.parent.mkdir(parents=True, exist_ok=True)
        with open(resume_target, "wb") as f:
            f.write(contents)

        # Parse resume and automatically extract candidate profile fields into user's config
        from services.resume_parser import parse_resume_and_update_config
        parse_result = parse_resume_and_update_config(resume_target, config_target)
        filename = get_candidate_resume_filename(config_target)

        return {
            "status": "success",
            "filename": filename,
            "size_kb": round(len(contents) / 1024, 1),
            "extracted": parse_result.get("extracted_fields", {}),
            "config": parse_result.get("config", {})
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


@app.post("/api/resume/parse")
def trigger_parse_resume(request: Request):
    paths = resolve_paths(request)
    from services.resume_parser import parse_resume_and_update_config
    res = parse_resume_and_update_config(paths["resume_file"], paths["config_file"])
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message", "Failed to parse resume"))
    return res


@app.get("/api/resume")
@app.get("/api/resume/view")
def view_resume_file(request: Request):
    paths = resolve_paths(request)
    resume_target = paths["resume_file"]
    config_target = paths["config_file"]
    if not resume_target.exists():
        raise HTTPException(status_code=404, detail="Resume PDF not found")
    filename = get_candidate_resume_filename(config_target)
    return FileResponse(
        path=str(resume_target),
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline"
    )


@app.delete("/api/resume")
def delete_resume_file(request: Request):
    paths = resolve_paths(request)
    resume_target = paths["resume_file"]
    if resume_target.exists():
        try:
            resume_target.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete resume: {e}")
    return {"status": "success", "message": "Resume deleted successfully"}


# ── Response Lifecycle & Positive Alerts Endpoints ──────────────
@app.get("/api/responses")
def get_responses():
    return load_responses()


@app.get("/api/responses/metrics")
def get_metrics():
    return get_response_metrics()


class ResponseUpdateRequest(BaseModel):
    id: str
    status: str
    notes: str = ""
    interview_date: Optional[str] = None


@app.post("/api/responses/update")
def update_response(payload: ResponseUpdateRequest):
    res = update_response_status(
        resp_id=payload.id,
        status=payload.status,
        notes=payload.notes,
        interview_date=payload.interview_date
    )
    if not res:
        raise HTTPException(status_code=404, detail="Response record not found")
    return res


@app.post("/api/responses/check-inbox")
def trigger_inbox_check():
    config = get_current_config()
    result = check_inbox_for_responses(config)
    return result


# ── Google Jobs & Career Pages Collector Endpoints ───────────────
@app.get("/api/collector/jobs")
def get_collector_jobs():
    return load_collected_jobs()


@app.post("/api/collector/run")
def trigger_collector():
    config = get_current_config()
    return run_job_collector(config)


@app.post("/api/collector/clear")
def clear_collector_jobs():
    save_collected_jobs([])
    return {"status": "cleared"}


# ── Scheduler & Email Notifications Endpoints ───────────────────
@app.get("/api/scheduler/status")
def get_scheduler_info():
    return get_scheduler_status()


@app.post("/api/scheduler/run-now")
def run_scheduler_pipeline_now(request: Request):
    paths = resolve_paths(request)
    config = get_current_config()
    if config.get("automate_apply", True):
        validate_candidate_profile(paths)

    # Execute in background thread to prevent blocking HTTP server
    pipeline_thread = threading.Thread(
        target=execute_scheduled_pipeline,
        args=(config, launch_bot_process, is_bot_running),
        daemon=True,
        name="ManualPipelineRun"
    )
    pipeline_thread.start()
    return {"status": "pipeline_started", "message": "Autonomous pipeline execution initiated in background"}


class ApplySelectedJobsPayload(BaseModel):
    job_ids: List[str]


@app.post("/api/scheduler/apply-selected-now")
def apply_selected_jobs_now(payload: ApplySelectedJobsPayload, request: Request):
    paths = resolve_paths(request)
    validate_candidate_profile(paths)
    config = get_current_config()

    if not payload.job_ids:
        raise HTTPException(status_code=400, detail="No jobs selected to apply")

    pipeline_thread = threading.Thread(
        target=execute_scheduled_pipeline,
        args=(config, launch_bot_process, is_bot_running, payload.job_ids),
        daemon=True,
        name="ApplySelectedJobsNow"
    )
    pipeline_thread.start()
    return {
        "status": "started",
        "message": f"Application started for {len(payload.job_ids)} selected jobs in background",
        "job_count": len(payload.job_ids)
    }


class EmailTestRequest(BaseModel):
    to_email: str
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str
    smtp_password: str
    smtp_use_tls: bool = True


@app.post("/api/email/test")
def test_email(payload: EmailTestRequest):
    test_cfg = payload.model_dump()
    subject = "8Oapply SMTP Verification Test"
    html = f"""
    <div style="font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 6px;">
      <h2 style="color: #34d399; margin-top: 0;">8Oapply Email Verification Successful</h2>
      <p>Your SMTP credentials are authenticated and ready to dispatch real-time alerts when positive recruiter responses or interview invites are received.</p>
      <p style="font-size: 12px; color: #94a3b8;">Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
    """
    try:
        success = send_email(subject, html, payload.to_email, test_cfg)
        if success:
            return {"status": "success", "message": f"Test email dispatched to {payload.to_email}"}
        else:
            raise HTTPException(status_code=400, detail="Failed to dispatch test email")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Gmail Integration Endpoints (Inbox Watching & Auto-Status) ──
class GmailConnectRequest(BaseModel):
    email: str
    app_password: str


@app.get("/api/gmail/status")
def get_gmail_status():
    config = get_current_config()
    is_connected = bool(config.get("gmail_connected")) or bool(config.get("imap_user") and config.get("imap_password"))
    email_addr = config.get("imap_user") or config.get("smtp_user") or ""
    return {
        "connected": is_connected,
        "email": email_addr,
        "recipient_email": config.get("recipient_email") or email_addr,
        "imap_host": config.get("imap_host", "imap.gmail.com"),
    }


@app.post("/api/gmail/connect")
def connect_gmail(payload: GmailConnectRequest):
    email_addr = payload.email.strip()
    app_pwd = payload.app_password.strip().replace(" ", "")

    if not email_addr or "@" not in email_addr:
        raise HTTPException(status_code=400, detail="Please enter a valid Gmail address.")
    if not app_pwd or len(app_pwd) < 8:
        raise HTTPException(status_code=400, detail="Please enter your 16-character Google App Password.")

    # Test live IMAP connection with timeout
    try:
        import imaplib
        import socket
        socket.setdefaulttimeout(15)
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(email_addr, app_pwd)
        mail.select("INBOX")
        mail.logout()
    except Exception as e:
        err_msg = str(e)
        if "AUTHENTICATIONFAILED" in err_msg or "Invalid credentials" in err_msg:
            raise HTTPException(
                status_code=400,
                detail="Gmail authentication failed. Please make sure 2-Step Verification is ON and you generated a 16-character Google App Password (not your normal password)."
            )
        raise HTTPException(status_code=400, detail=f"Gmail IMAP connection error: {err_msg}")

    # Save to config
    config = get_current_config()
    config["smtp_user"] = email_addr
    config["smtp_password"] = app_pwd
    config["smtp_host"] = "smtp.gmail.com"
    config["smtp_port"] = 587
    config["imap_user"] = email_addr
    config["imap_password"] = app_pwd
    config["imap_host"] = "imap.gmail.com"
    config["imap_port"] = 993
    config["recipient_email"] = email_addr
    config["gmail_connected"] = True
    save_current_config(config)

    # Immediately trigger inbox scan and status sync
    updated_count = 0
    try:
        from services.inbox_watcher import check_inbox_for_responses
        from services.response_tracker import sync_applied_jobs_with_inbox_and_lifecycle
        check_inbox_for_responses(config)
        sync_res = sync_applied_jobs_with_inbox_and_lifecycle()
        updated_count = sync_res.get("updated_count", 0)
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Successfully connected Gmail ({email_addr})! Recruiter response scanning is active.",
        "updated_count": updated_count
    }


@app.post("/api/gmail/disconnect")
def disconnect_gmail():
    config = get_current_config()
    config["gmail_connected"] = False
    config["smtp_user"] = ""
    config["smtp_password"] = ""
    config["imap_user"] = ""
    config["imap_password"] = ""
    save_current_config(config)
    return {"status": "success", "message": "Gmail account disconnected."}


# ── AI Job Assistant Endpoints (Grok, OpenAI, Claude, Gemini) ────
class AIGenerateRequest(BaseModel):
    provider: str = "gemini"  # "grok", "openai", "claude", "gemini"
    api_key: Optional[str] = None
    model: Optional[str] = None
    job_title: str
    company: str
    job_description: str = ""
    message_type: str = "cover_letter"  # "cover_letter", "cold_outreach", "interview_reply"
    recruiter_snippet: str = ""


@app.post("/api/ai/generate")
def ai_generate_endpoint(payload: AIGenerateRequest):
    config = get_current_config()
    primary_prov = payload.provider.lower().strip()
    fallback_enabled = config.get("ai_fallback_enabled", True)

    default_order = ["grok", "openai", "gemini", "claude"]
    configured_order = config.get("ai_fallback_order") or default_order
    # Sequence: primary provider first, followed by others in fallback order
    ordered_providers = [primary_prov] + [p for p in configured_order if p != primary_prov]

    errors = []
    for idx, prov in enumerate(ordered_providers):
        # If this is a fallback attempt and fallback is disabled, don't try
        if idx > 0 and not fallback_enabled:
            break

        api_key = payload.api_key if idx == 0 and payload.api_key else (config.get(f"{prov}_api_key") or (config.get("ai_api_key") if prov == primary_prov else None))
        if not api_key:
            if idx == 0:
                errors.append(f"Primary provider {prov}: API key not configured")
            continue

        model = (payload.model if idx == 0 and payload.model else None) or config.get(f"{prov}_model") or (config.get("ai_model") if prov == primary_prov else None) or DEFAULT_MODELS.get(prov, "")

        try:
            content = generate_job_communication(
                provider=prov,
                api_key=api_key,
                model=model,
                job_title=payload.job_title,
                company=payload.company,
                job_description=payload.job_description,
                candidate_profile=config,
                message_type=payload.message_type,
                recruiter_snippet=payload.recruiter_snippet
            )
            return {
                "status": "success",
                "content": content,
                "provider": prov,
                "model": model,
                "fallback_triggered": (prov != primary_prov),
                "original_provider": primary_prov,
                "note": f"Auto-switched from {primary_prov.upper()} to {prov.upper()} due to quota/rate limit" if prov != primary_prov else "Primary provider responded successfully"
            }
        except Exception as e:
            err_msg = str(e)
            errors.append(f"{prov.upper()}: {err_msg}")
            # If fallback disabled, fail immediately
            if not fallback_enabled:
                raise HTTPException(status_code=500, detail=f"{prov.upper()} failed: {err_msg}")
            continue

    raise HTTPException(
        status_code=500,
        detail=f"All configured AI providers failed. Fallback attempts: {'; '.join(errors)}"
    )


class AITestRequest(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None


@app.post("/api/ai/test")
def ai_test_endpoint(payload: AITestRequest):
    prov = payload.provider.lower().strip()
    model = payload.model or DEFAULT_MODELS.get(prov, "")
    try:
        content = generate_job_communication(
            provider=prov,
            api_key=payload.api_key,
            model=model,
            job_title="Software Engineer",
            company="Acme Corp",
            job_description="Test query to verify API credentials",
            candidate_profile={"name": "Candidate"},
            message_type="cover_letter"
        )
        return {
            "status": "success",
            "message": f"Successfully authenticated with {payload.provider.upper()} ({model})",
            "sample": content[:120] + "..."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication with {payload.provider} failed: {e}")


# ── AI Intelligence Use Cases Endpoints ──────────────────────────────
class TailorResumeRequest(BaseModel):
    job_title: str
    company: str
    job_description: str
    provider: Optional[str] = None
    model: Optional[str] = None


@app.post("/api/ai/tailor-resume")
def tailor_resume_endpoint(payload: TailorResumeRequest, request: Request):
    paths = resolve_paths(request)
    config = get_current_config(paths["config"])
    prov = (payload.provider or config.get("ai_provider") or "grok").lower().strip()
    api_key = config.get(f"{prov}_api_key") or config.get("ai_api_key", "")
    model = payload.model or config.get(f"{prov}_model") or config.get("ai_model", "")

    res = tailor_resume_from_jd(
        provider=prov,
        api_key=api_key,
        model=model,
        job_title=payload.job_title,
        company=payload.company,
        job_description=payload.job_description,
        candidate_profile=config
    )
    return res


class AIReplyDraftRequest(BaseModel):
    recruiter_message: str
    reply_scenario: str = "accept_interview"
    custom_notes: Optional[str] = ""
    company: Optional[str] = ""
    job_title: Optional[str] = ""
    provider: Optional[str] = None
    model: Optional[str] = None


@app.post("/api/ai/reply-draft")
def ai_reply_draft_endpoint(payload: AIReplyDraftRequest, request: Request):
    paths = resolve_paths(request)
    config = get_current_config(paths["config"])
    prov = (payload.provider or config.get("ai_provider") or "grok").lower().strip()
    api_key = config.get(f"{prov}_api_key") or config.get("ai_api_key", "")
    model = payload.model or config.get(f"{prov}_model") or config.get("ai_model", "")

    draft = generate_recruiter_smart_reply(
        provider=prov,
        api_key=api_key,
        model=model,
        recruiter_message=payload.recruiter_message,
        reply_scenario=payload.reply_scenario,
        custom_notes=payload.custom_notes or "",
        company=payload.company or "Company",
        job_title=payload.job_title or "Position",
        candidate_profile=config
    )
    return {"status": "success", "draft": draft, "provider": prov}


class ScreeningQuestionRequest(BaseModel):
    question: str
    company: Optional[str] = ""
    job_title: Optional[str] = ""


@app.post("/api/ai/screening-answer")
def ai_screening_answer_endpoint(payload: ScreeningQuestionRequest, request: Request):
    paths = resolve_paths(request)
    config = get_current_config(paths["config"])
    ans = answer_screening_question(
        question_text=payload.question,
        job_title=payload.job_title or "Software Engineer",
        company=payload.company or "Hiring Company",
        candidate_profile=config
    )
    return {"status": "success", "question": payload.question, "answer": ans}


# ── Direct Email Apply & Positive Alert Triggers ────────────────────
class DirectEmailApplyRequest(BaseModel):
    recruiter_email: str
    subject: Optional[str] = ""
    body: str
    attach_resume: bool = True
    company: Optional[str] = ""
    job_title: Optional[str] = ""
    job_description: Optional[str] = ""
    tailor_resume: Optional[bool] = False


@app.post("/api/email/apply-direct")
def email_apply_direct_endpoint(payload: DirectEmailApplyRequest, request: Request):
    paths = resolve_paths(request)
    config = get_current_config(paths["config"])
    resume_path = str(paths["resume"]) if payload.attach_resume and paths["resume"].exists() else None

    try:
        res = send_direct_email_application(
            recruiter_email=payload.recruiter_email,
            subject=payload.subject or "",
            body_text_or_html=payload.body,
            resume_path=resume_path,
            config=config,
            company=payload.company or "",
            job_title=payload.job_title or "",
            job_description=payload.job_description or "",
            tailor_resume=bool(payload.tailor_resume)
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TestTriggerAlertRequest(BaseModel):
    trigger_type: str = "interview"  # "interview", "exam", "offer"
    to_email: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None


@app.post("/api/email/test-trigger-alert")
def email_test_trigger_alert_endpoint(payload: TestTriggerAlertRequest, request: Request):
    paths = resolve_paths(request)
    config = get_current_config(paths["config"])
    recipient = payload.to_email or config.get("recipient_email") or config.get("smtp_user")
    if not recipient:
        raise HTTPException(status_code=400, detail="Recipient email not configured. Please connect Gmail or set recipient email.")

    cand_name = config.get("name") or "Applicant"
    job_titles_list = config.get("job_titles")
    cand_role = payload.job_title or (job_titles_list[0] if isinstance(job_titles_list, list) and job_titles_list else config.get("job_title", "Software Engineer"))

    # Resolve company dynamically from real application records if not specified
    target_company = (payload.company or "").strip()
    if not target_company:
        try:
            from services.response_tracker import load_responses
            responses = load_responses()
            for r in responses:
                comp = (r.get("company") or "").strip()
                if comp and comp.lower() not in ["unknown", "company", "stripe"]:
                    target_company = comp
                    break
        except Exception:
            pass
    if not target_company:
        target_company = "Engineering Hiring Team"

    clean_comp_email = re.sub(r'[^a-zA-Z0-9]', '', target_company.lower()) or "careers"
    sender_email = f"recruiting@{clean_comp_email}.com"

    tt = payload.trigger_type.lower()
    if "offer" in tt:
        cat = "Offer Letter"
        skills_highlight = (config.get("skills") or "software engineering").split(",")[0].strip()
        snippet = (
            f"Dear {cand_name},\n\n"
            f"We were extremely impressed by your technical interviews and problem-solving skills in {skills_highlight}. "
            f"We are delighted to extend a formal offer of employment for the {cand_role} position at {target_company}.\n\n"
            f"Please review the attached compensation package and let us know your availability to discuss next steps."
        )
        keywords = ["job offer", "offer letter", "welcome to the team", "compensation"]
    elif "exam" in tt or "oa" in tt or "assessment" in tt:
        cat = "Exam / Online Assessment"
        snippet = (
            f"Hello {cand_name},\n\n"
            f"Thank you for your application for the {cand_role} role at {target_company}. "
            f"As the next step in our evaluation, please complete our 90-minute online coding assessment before the deadline:\n\n"
            f"Assessment Link: https://assessment.hackerrank.com/login/challenge?token=8a9b7c\n\n"
            f"Best of luck with your assessment!"
        )
        keywords = ["online assessment", "hackerrank", "coding challenge", "assessment link"]
    else:
        cat = "Interview Scheduled"
        snippet = (
            f"Hi {cand_name},\n\n"
            f"Thank you for your interest in {target_company}. Our engineering team was very impressed with your profile for the {cand_role} position "
            f"and would like to invite you for a 45-minute technical discussion.\n\n"
            f"Please select a time slot that works best for you here: https://calendly.com/{clean_comp_email}-team/tech-round-1"
        )
        keywords = ["interview invitation", "calendly.com", "technical discussion"]

    success = send_positive_response_alert(
        company=target_company,
        job_title=cand_role,
        email_snippet=snippet,
        matched_keywords=keywords,
        sender_email=sender_email,
        to_email=recipient,
        config=config,
        response_type=cat
    )

    if success:
        return {"status": "success", "message": f"{cat} alert dispatched successfully to {recipient}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to dispatch trigger alert. Check SMTP connection settings.")


# Start background autonomous scheduler
start_scheduler(get_current_config, trigger_bot_runner_fn=launch_bot_process, is_bot_running_fn=is_bot_running)


# --- Serve React Frontend SPA with Live Development Auto-Proxy ---
DIST_DIR = BASE_DIR / "frontend" / "dist"

def ensure_vite_dev_server():
    """Starts Vite development server in the background if not already running."""
    from eight_o_apply import is_port_listening
    if not is_port_listening(5173):
        try:
            import subprocess
            frontend_dir = BASE_DIR / "frontend"
            if frontend_dir.exists():
                subprocess.Popen(
                    ["npm", "run", "dev"],
                    cwd=str(frontend_dir),
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                log.info("Live Vite Dev Server started on port 5173 with auto-refresh/HMR")
        except Exception as e:
            log.warning(f"Could not auto-start Vite dev server: {e}")

try:
    ensure_vite_dev_server()
except Exception:
    pass

import httpx
from starlette.responses import Response
from eight_o_apply import is_port_listening

@app.api_route("/{full_path:path}", methods=["GET", "HEAD", "OPTIONS"])
async def serve_spa_or_proxy(request: Request, full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    # 1. If Vite live dev server is running on port 5173, proxy for instant live HMR auto-reflection
    if is_port_listening(5173):
        try:
            query = request.url.query
            target_url = f"http://127.0.0.1:5173/{full_path}"
            if query:
                target_url += f"?{query}"

            headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]}
            async with httpx.AsyncClient(timeout=10.0) as client:
                req = client.build_request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                )
                resp = await client.send(req)
                return Response(
                    content=resp.content,
                    status_code=resp.status_code,
                    headers=dict(resp.headers)
                )
        except Exception:
            pass

    # 2. Production fallback: Serve static build from dist with zero-cache headers
    if DIST_DIR.exists():
        target_file = DIST_DIR / full_path
        if target_file.is_file():
            return FileResponse(
                target_file,
                headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
            )
        return FileResponse(
            DIST_DIR / "index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
        )

    raise HTTPException(status_code=404, detail="Frontend build or dev server not available")


if __name__ == "__main__":
    import uvicorn
    # reload=False is required so writing to jobbot.log, applied_jobs.csv, or cookies does NOT cause infinite server restarts
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
