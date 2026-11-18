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

def apply_to_unapplied_collected_jobs(config: Dict[str, Any], target_job_ids: Optional[List[str]] = None) -> int:
    """
    Directly applies to unapplied collected jobs in applied_jobs.csv
    using verified profile & resume.
    If target_job_ids is provided, applies ONLY to those specified jobs (Mode 2: Targeted Queue).
    """
    try:
        from server import resolve_paths
        import eight_o_apply

        paths = resolve_paths()
        csv_file = paths["csv_file"]
        if not csv_file.exists():
            return 0

        import io
        with open(csv_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().replace("\x00", "")
        reader = csv.DictReader(io.StringIO(content))
        
        if target_job_ids is not None:
            target_set = set(str(jid).strip() for jid in target_job_ids if str(jid).strip())
            unapplied_jobs = [r for r in reader if (r.get("status") or "").strip().lower() == "not applied" and r.get("job_id") in target_set and r.get("url")]
        else:
            unapplied_jobs = [r for r in reader if (r.get("status") or "").strip().lower() == "not applied" and r.get("url")]

        if not unapplied_jobs:
            return 0

        applied_count = 0
        limit = len(unapplied_jobs) if target_job_ids is not None else int(config.get("max_per_platform", 20))
        for job in unapplied_jobs[:limit]:
            url = job.get("url", "")
            platform = job.get("platform", "")
            title = job.get("job_title", "")
            company = job.get("company", "")
            job_id = job.get("job_id", "")
            if not url:
                continue

            # Gating: only apply if the platform is enabled in configuration (unless explicitly selected)
            if target_job_ids is None:
                plat_key = f"use_{platform.lower().replace(' ', '_').replace('-', '_')}"
                if plat_key in config and not config.get(plat_key, False):
                    continue

            try:
                res = eight_o_apply.apply_to_job_live(url=url, platform=platform, title=title, company=company, job_id=job_id)
                if res.get("success") or res.get("status") == "applied":
                    applied_count += 1
                    eight_o_apply.save_applied(platform, title, company, job_id, url, status="Applied")
            except Exception as e:
                print(f"Collected job apply error: {e}")

        return applied_count
    except Exception as e:
        print(f"Error in apply_to_unapplied_collected_jobs: {e}")
        return 0


def execute_scheduled_pipeline(config: Dict[str, Any], trigger_bot_runner_fn=None, is_bot_running_fn=None, target_job_ids_override=None):
    global last_run_date, last_run_time, last_run_status, current_step, step_description, pipeline_executing
    pipeline_executing = True
    last_run_date = datetime.now().strftime("%Y-%m-%d")
    last_run_time = datetime.now().strftime("%H:%M:%S")

    action_mode = (config.get("scheduler_action_mode") or "fetch_and_apply").strip().lower()

    # ── MODE 2: Apply to Selected Unapplied Jobs ────────────────────
    if action_mode == "selected_jobs" or target_job_ids_override is not None:
        selected_ids = target_job_ids_override if target_job_ids_override is not None else config.get("scheduled_selected_jobs", [])
        current_step = 1
        step_description = f"Applying to {len(selected_ids)} Selected Jobs from Queue"
        last_run_status = step_description

        applied_count = apply_to_unapplied_collected_jobs(config, target_job_ids=selected_ids)

        try:
            from services.response_tracker import sync_applied_jobs_with_inbox_and_lifecycle
            sync_applied_jobs_with_inbox_and_lifecycle()
        except Exception:
            pass

        # Clear processed job IDs from scheduled queue
        try:
            from server import get_current_config, save_current_config
            curr_cfg = get_current_config()
            remaining = [jid for jid in curr_cfg.get("scheduled_selected_jobs", []) if jid not in selected_ids]
            curr_cfg["scheduled_selected_jobs"] = remaining
            save_current_config(curr_cfg)
        except Exception:
            pass

        current_step = 0
        pipeline_executing = False
        step_description = f"Completed: {applied_count} Selected Jobs Applied"
        last_run_status = step_description
        record_scheduler_history({
            "timestamp": f"{last_run_date} {last_run_time}",
            "status": last_run_status,
            "collected": 0,
            "applied": applied_count,
            "positive": 0,
            "actions": [f"{applied_count} Selected Jobs Applied"]
        })
        return

    # ── MODE 1: Autonomous Fetch & Auto-Apply ───────────────────────
    pipeline_mode = (config.get("pipeline_mode") or "").strip().lower()
    if pipeline_mode == "collect_only":
        do_discovery = True
        do_apply = False
    elif pipeline_mode == "apply_only":
        do_discovery = False
        do_apply = True
    elif pipeline_mode in ["collect_and_apply", "both"]:
        do_discovery = True
        do_apply = True
    else:
        do_discovery = bool(config.get("automate_discovery", True))
        do_apply = bool(config.get("automate_apply", True))

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

        # Immediately update status of newly applied jobs
        try:
            from services.response_tracker import sync_applied_jobs_with_inbox_and_lifecycle
            sync_applied_jobs_with_inbox_and_lifecycle()
        except Exception:
            pass

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

                # Check cadence mode matching
                if scheduler_mode == "weekend":
                    day_matches = (current_day in ["sat", "sun"])
                elif scheduler_mode in ["weekly", "weekdays"]:
                    if scheduled_days:
                        day_matches = (current_day in [d.lower()[:3] for d in scheduled_days])
                    else:
                        day_matches = (current_day in ["mon", "tue", "wed", "thu", "fri"])
                elif scheduler_mode == "onetime":
                    day_matches = True
                else:  # everyday
                    day_matches = (not scheduled_days) or (current_day in [d.lower()[:3] for d in scheduled_days])

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
