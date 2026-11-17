from __future__ import annotations
import os
import re
import csv
import json
import time
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from services.job_collector import run_job_collector
from services.inbox_watcher import check_inbox_for_responses
from services.email_service import send_daily_digest
from services.response_tracker import get_response_metrics

BASE_DIR = Path(__file__).resolve().parent.parent
APPLIED_FILE = BASE_DIR / "applied_jobs.csv"
HISTORY_FILE = BASE_DIR / "scheduler_history.json"

scheduler_thread: Optional[threading.Thread] = None
scheduler_running = False
pipeline_executing = False
last_run_date: Optional[str] = None
last_run_time: Optional[str] = None
last_run_status: str = "Idle"
current_step: int = 0
step_description: str = "Idle"

def load_scheduler_history() -> List[Dict[str, Any]]:
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def record_scheduler_history(entry: Dict[str, Any]):
    try:
        history = load_scheduler_history()
        history.insert(0, entry)
        history = history[:15] # Keep last 15 execution runs
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Failed to record scheduler history: {e}")

def get_scheduler_status() -> Dict[str, Any]:
    history = load_scheduler_history()
    return {
        "active": scheduler_running,
        "executing": pipeline_executing,
        "last_run_date": last_run_date,
        "last_run_time": last_run_time,
        "last_run_status": last_run_status,
        "current_step": current_step,
        "step_description": step_description,
        "history": history
    }

def normalize_time(t_str: str) -> str:
    s = str(t_str or "").strip()
    match = re.match(r'^(\d{1,2}):(\d{2})\s*(am|pm)?$', s, re.IGNORECASE)
    if not match:
        return s
    h, m, period = int(match.group(1)), int(match.group(2)), match.group(3)
    if period:
        period = period.lower()
        if period == "pm" and h < 12: h += 12
        elif period == "am" and h == 12: h = 0
    return f"{h:02d}:{m:02d}"

def get_today_applied_jobs() -> List[Dict[str, str]]:
    today_str = datetime.now().strftime("%Y-%m-%d")
    results = []
    if APPLIED_FILE.exists():
        try:
            with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    date_val = row.get("date", "")
                    if today_str in date_val:
                        results.append(row)
        except Exception:
            pass
    return results

def apply_to_unapplied_collected_jobs(config: Dict[str, Any]) -> int:
    """
    Directly applies to unapplied collected jobs in applied_jobs.csv
    using verified profile & resume.
    """
    try:
        from server import resolve_paths
        import jobbot

        paths = resolve_paths()
        csv_file = paths["csv_file"]
        if not csv_file.exists():
            return 0

        import io
        with open(csv_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().replace("\x00", "")
        reader = csv.DictReader(io.StringIO(content))
        unapplied_jobs = [r for r in reader if (r.get("status") or "").strip().lower() == "not applied" and r.get("url")]

        if not unapplied_jobs:
            return 0

        applied_count = 0
        max_apply = config.get("max_per_platform", 20)
        for job in unapplied_jobs[:max_apply]:
            url = job.get("url", "")
            platform = job.get("platform", "")
            title = job.get("job_title", "")
            company = job.get("company", "")
            job_id = job.get("job_id", "")
            if not url:
                continue

            # Gating: only apply if the platform is enabled in configuration
            plat_key = f"use_{platform.lower().replace(' ', '_').replace('-', '_')}"
            if plat_key in config and not config.get(plat_key, False):
                continue

            try:
                res = jobbot.apply_to_job_live(url=url, platform=platform, title=title, company=company, job_id=job_id)
                if res.get("success") or res.get("status") == "applied":
                    applied_count += 1
                    jobbot.save_applied(platform, title, company, job_id, url, status="Applied")
            except Exception as e:
                print(f"Collected job apply error: {e}")

        return applied_count
    except Exception as e:
        print(f"Error in apply_to_unapplied_collected_jobs: {e}")
        return 0


def execute_scheduled_pipeline(config: Dict[str, Any], trigger_bot_runner_fn=None, is_bot_running_fn=None):
    global last_run_date, last_run_time, last_run_status, current_step, step_description, pipeline_executing
    pipeline_executing = True
    last_run_date = datetime.now().strftime("%Y-%m-%d")
    last_run_time = datetime.now().strftime("%H:%M:%S")

    do_discovery = config.get("automate_discovery", True)
    do_apply = config.get("automate_apply", True)

    collected_count = 0
    # Step 1: Collect jobs from Greenhouse/Lever & Direct Career Portals (Only if both Discovery & Others are enabled)
    if do_discovery and config.get("use_others", False):
        current_step = 1
        step_description = "Step 1/4: Collecting Jobs from Career Portals & ATS"
        last_run_status = step_description
        try:
            collector_res = run_job_collector(config)
            collected_count = collector_res.get("new_collected", 0)
        except Exception as e:
            print(f"Job collector step notice: {e}")
    else:
        current_step = 1
        step_description = "Step 1/4: Job Discovery Skipped (Per User Choice)"
        last_run_status = step_description

    # Step 2: Auto-Apply execution
    collected_applied_count = 0
    if do_apply:
        current_step = 2
        step_description = "Step 2/4: Applying to Collected Jobs in Queue"
        last_run_status = step_description

        # 1. Apply to already collected jobs in queue
        try:
            collected_applied_count = apply_to_unapplied_collected_jobs(config)
        except Exception as e:
            print(f"Apply to collected jobs notice: {e}")

        # 2. Trigger live crawler runner if apply is enabled
        if trigger_bot_runner_fn:
            try:
                trigger_bot_runner_fn()
                if is_bot_running_fn:
                    time.sleep(5)
                    wait_start = time.time()
                    while is_bot_running_fn() and time.time() - wait_start < 7200: # Max 2 hour wait
                        time.sleep(10)
                        step_description = f"Step 2/4: Auto-Applying in progress ({int((time.time() - wait_start)//60)}m elapsed)"
                        last_run_status = step_description
            except Exception as e:
                print(f"Scheduler trigger bot runner error: {e}")
    else:
        current_step = 2
        step_description = "Step 2/4: Auto-Apply Skipped (Per User Choice)"
        last_run_status = step_description

    # Step 3: Check Inbox for recruiter responses & alerts
    current_step = 3
    step_description = "Step 3/4: Scanning Recruiter Inbox for Responses"
    last_run_status = step_description
    positive_count = 0
    try:
        inbox_res = check_inbox_for_responses(config)
        positive_count = inbox_res.get("positive_detected", 0)
    except Exception as e:
        print(f"Inbox scan notice: {e}")

    # Step 4: Dispatch Daily Digest Email with real application table
    current_step = 4
    step_description = "Step 4/4: Generating & Sending Daily Digest"
    last_run_status = step_description
    today_applications = get_today_applied_jobs()

    if config.get("daily_digest", True):
        try:
            recipient = config.get("recipient_email", config.get("smtp_user", ""))
            metrics = get_response_metrics()
            send_daily_digest(
                applied_count=len(today_applications),
                positive_count=metrics.get("positive", 0),
                applications=today_applications[:15],
                to_email=recipient,
                config=config
            )
        except Exception as e:
            print(f"Daily digest dispatch notice: {e}")

    current_step = 0
    pipeline_executing = False
    actions_ran = []
    if do_discovery:
        actions_ran.append(f"{collected_count} Collected")
    if do_apply:
        actions_ran.append(f"{len(today_applications)} Applied")
    actions_ran.append(f"{positive_count} +ve Alerts")

    step_description = "Pipeline Completed Successfully"
    last_run_status = f"Completed: {' | '.join(actions_ran)}"

    # Save to persistent history
    record_scheduler_history({
        "timestamp": f"{last_run_date} {last_run_time}",
        "status": last_run_status,
        "collected": collected_count,
        "applied": len(today_applications),
        "positive": positive_count,
        "actions": actions_ran
    })

def scheduler_worker(get_config_fn, trigger_bot_runner_fn, is_bot_running_fn=None):
    global scheduler_running
    last_minute_checked = ""
    last_inbox_check_time = 0

    while scheduler_running:
        try:
            config = get_config_fn() or {}
            enabled = config.get("scheduler_enabled", False)

            if enabled:
                now = datetime.now()
                current_hm = now.strftime("%H:%M")
                current_ymd = now.strftime("%Y-%m-%d")
                scheduled_times = config.get("scheduled_times", ["09:30", "17:00"])
                scheduled_days = config.get("scheduler_days", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
                scheduler_mode = config.get("scheduler_mode", "everyday")
                scheduler_date = config.get("scheduler_date", "")
                current_day = now.strftime("%a").lower()[:3]

                # Normalize scheduled times to standard HH:MM
                norm_scheduled = [normalize_time(t) for t in scheduled_times]

                # Check date match for onetime mode
                date_matches = True
                if scheduler_mode == "onetime":
                    if scheduler_date:
                        # If date is today, match! If date was in the past (e.g. yesterday), auto-match today so user's schedule executes
                        date_matches = (scheduler_date <= current_ymd)
                    else:
                        date_matches = True

                # Check if current day matches scheduled days
                day_matches = (scheduler_mode == "onetime") or (not scheduled_days) or (current_day in [d.lower()[:3] for d in scheduled_days])

                # Check time match
                time_matches = (current_hm in norm_scheduled)

                if date_matches and day_matches and time_matches and current_hm != last_minute_checked:
                    last_minute_checked = current_hm
                    print(f"⏰ Scheduler triggered pipeline run at {current_hm} ({scheduler_mode})")
                    # Run in separate thread so worker loop does not stall
                    threading.Thread(
                        target=execute_scheduled_pipeline,
                        args=(config, trigger_bot_runner_fn, is_bot_running_fn),
                        daemon=True,
                        name="ScheduledPipelineRun"
                    ).start()

                    # If onetime execution, auto-pause scheduler after run
                    if scheduler_mode == "onetime":
                        try:
                            config["scheduler_enabled"] = False
                            from server import save_current_config
                            save_current_config(config)
                        except Exception as e:
                            print(f"Failed to auto-pause onetime scheduler: {e}")

                # Periodic background inbox check every 3 minutes (180s) for +ve responses
                if time.time() - last_inbox_check_time > 180:
                    last_inbox_check_time = time.time()
                    try:
                        check_inbox_for_responses(config)
                    except Exception as e:
                        print(f"Periodic inbox check notice: {e}")

        except Exception as e:
            print(f"Scheduler worker error: {e}")

        time.sleep(20)

def start_scheduler(get_config_fn, trigger_bot_runner_fn, is_bot_running_fn=None):
    global scheduler_thread, scheduler_running
    if scheduler_running:
        return
    scheduler_running = True
    scheduler_thread = threading.Thread(
        target=scheduler_worker,
        args=(get_config_fn, trigger_bot_runner_fn, is_bot_running_fn),
        daemon=True,
        name="8OMateScheduler"
    )
    scheduler_thread.start()

def stop_scheduler():
    global scheduler_running
    scheduler_running = False
