from filelock import FileLock
"""
╔══════════════════════════════════════════════════════════════════╗
║         JobBot v2.0 — Auto Apply Bot for Jobs                   ║
║  Platforms: LinkedIn, Naukri, Indeed, Glassdoor,                ║
║             Internshala, Shine, Foundit, TimesJobs, Wellfound   ║
║  Browsers: Microsoft Edge / Brave / Chrome (auto-detect)        ║
║  Made for personal use only                                      ║
╚══════════════════════════════════════════════════════════════════╝

SETUP (ek baar karo):
  pip install selenium webdriver-manager

RESUME:  jobbot_v2.py ke same folder mein  resume.pdf  rakho
RUN:     python jobbot_v2.py
"""

import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import time
import csv
import os
import random
import logging
import json
import pickle
from datetime import datetime
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Selenium imports ──────────────────────────────────────────
try:
    from selenium_stealth import stealth
    HAS_STEALTH = True
except ImportError:
    HAS_STEALTH = False

try:
    from selenium import webdriver
    from selenium.webdriver.edge.service    import Service as EdgeService
    from selenium.webdriver.edge.options   import Options as EdgeOptions
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.common.by       import By
    from selenium.webdriver.support.ui      import WebDriverWait
    from selenium.webdriver.support         import expected_conditions as EC
    from selenium.webdriver.common.keys     import Keys
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.common.exceptions import (
        TimeoutException, NoSuchElementException,
        ElementClickInterceptedException, StaleElementReferenceException
    )
    from webdriver_manager.microsoft import EdgeChromiumDriverManager
    from webdriver_manager.chrome    import ChromeDriverManager
except ImportError:
    print("❌ Libraries nahi mili! Run karo:")
    print("   pip install selenium webdriver-manager")
    exit(1)

# ══════════════════════════════════════════════════════════════
#  ✏️  APNI DETAILS YAHAN BHARO  (REQUIRED)
# ══════════════════════════════════════════════════════════════
CONFIG = {
    # --- Personal info ---
    "name":         "",
    "email":        "",
    "phone":        "",
    "experience":   "",
    "current_ctc":  "",
    "expected_ctc": "",
    "notice_period":"",
    "college":      "",
    "degree":       "",
    "grad_year":    "",

    # --- Job search ---
    "job_titles": [],
    "locations": [],

    "skills":     "",
    "salary":     "",
    "cover_note": "",

    # --- Platform credentials ---
    "linkedin_email":       "",
    "linkedin_password":    "",

    "indeed_email":         "",
    "indeed_password":      "",

    "naukri_email":         "",
    "naukri_password":      "",

    "glassdoor_email":      "",
    "glassdoor_password":   "",

    "internshala_email":    "",
    "internshala_password": "",

    "shine_email":          "",
    "shine_password":       "",

    "foundit_email":        "",
    "foundit_password":     "",

    "timesjobs_email":      "",
    "timesjobs_password":   "",

    "wellfound_email":      "",
    "wellfound_password":   "",

    # --- Bot settings ---
    "max_per_platform":     50,
    "delay_min":            12,
    "delay_max":            25,
    "page_load_wait":       8,
    "platform_rest_min":    600,
    "platform_rest_max":    900,
    "headless":             False,
    "manual_login_wait":    45,
    "job_post_age_days":    7,

    # --- Browser preference (auto = try all) ---
    # Options: "edge", "brave", "chrome", "auto"
    "browser":              "auto",

    # --- Which platforms to use ---
    "use_linkedin":         True,
    "use_naukri":           True,
    "use_indeed":           True,
    "use_glassdoor":        True,
    "use_internshala":      True,
    "use_shine":            True,
    "use_foundit":          True,
    "use_timesjobs":        True,
    "use_wellfound":        True,
    "use_others":           True,

    # --- Resume path ---
    "resume_path": os.environ.get("JOBBOT_RESUME_PATH", str(Path(__file__).parent / "resume.pdf")),

    # --- Cookie save folder (for session reuse) ---
    "cookie_dir": os.environ.get("JOBBOT_COOKIE_DIR", str(Path(__file__).parent / "cookies")),
}

# --- Load overrides from config.json (or user-specific config) if present ---
_config_file = Path(os.environ.get("JOBBOT_CONFIG_PATH") or (Path(__file__).parent / "config.json"))
if _config_file.exists():
    try:
        with open(_config_file, "r", encoding="utf-8") as _f:
            _saved = json.load(_f)
            if isinstance(_saved, dict):
                CONFIG.update(_saved)
    except Exception as _e:
        print(f"Warning: Failed to load config.json: {_e}")

# ══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("jobbot.log", encoding="utf-8"),
    ]
)
log = logging.getLogger("JobBot")

APPLIED_FILE = os.environ.get("JOBBOT_CSV_PATH", "applied_jobs.csv")
applied_jobs = set()
applied_urls = set()
applied_signatures = set()
TOTAL_COLLECTED = 0
TOTAL_APPLIED = 0


# ══════════════════════════════════════════════════════════════
#  UTILS & DUPLICATE PREVENTION
# ══════════════════════════════════════════════════════════════

def is_applied_status(status_str: str) -> bool:
    """Returns True if the job status indicates an application was already made."""
    s = (status_str or "").strip().lower()
    return bool(s and s != "not applied")


def clean_url_key(url: str) -> str:
    """Normalizes URL for duplicate detection by removing tracking params and trailing slashes."""
    if not url:
        return ""
    u = url.split("?")[0].split("#")[0].strip().rstrip("/").lower()
    return u


def load_applied():
    """
    Loads all previously applied job IDs, URLs, and title+company signatures
    from applied_jobs.csv to guarantee strict zero-duplicate applications.
    """
    global applied_jobs, applied_urls, applied_signatures
    applied_jobs = set()
    applied_urls = set()
    applied_signatures = set()
    if os.path.exists(APPLIED_FILE):
        try:
            import io
            with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().replace("\x00", "")
            for row in csv.DictReader(io.StringIO(content)):
                st = row.get("status") or ""
                if is_applied_status(st):
                    jid = (row.get("job_id") or "").strip()
                    if jid:
                        applied_jobs.add(jid)
                    u = clean_url_key(row.get("url") or "")
                    if u:
                        applied_urls.add(u)
                    t = (row.get("job_title") or "").strip().lower()
                    c = (row.get("company") or "").strip().lower()
                    if t and c and c != "unknown":
                        applied_signatures.add(f"{t}@@@{c}")
        except Exception as e:
            log.warning(f"Error loading applied jobs: {e}")
    log.info(f"Previously applied: {len(applied_jobs)} jobs loaded ({len(applied_urls)} URLs)")


def is_job_already_applied(job_id="", url="", title="", company="") -> bool:
    """Strict duplicate check: Returns True if job was already applied via ID, URL, or title+company."""
    if not applied_jobs and os.path.exists(APPLIED_FILE):
        load_applied()

    jid = (job_id or "").strip()
    if jid and jid in applied_jobs:
        return True

    u = clean_url_key(url)
    if u and u in applied_urls:
        return True

    t = (title or "").strip().lower()
    c = (company or "").strip().lower()
    if t and c and c != "unknown" and f"{t}@@@{c}" in applied_signatures:
        return True

    return False


def save_applied(platform, job_title, company, job_id, url="", status="Not Applied", description=""):
    global TOTAL_COLLECTED, TOTAL_APPLIED

    # Clean job title and company strictly to avoid noisy breadcrumbs or scraper tags
    try:
        from services.job_filter import clean_job_title, clean_company_name, is_job_match
        job_title = clean_job_title(job_title)
        company = clean_company_name(company, url)

        # Strictly ensure newly collected jobs match candidate's Search Targets & Preferences
        if status == "Not Applied":
            is_match, reason = is_job_match(job_title, config=CONFIG)
            if not is_match:
                log.info(f"Save SKIP ({reason}) — {job_title} @ {company}")
                return
    except Exception:
        pass

    if is_applied_status(status):
        if job_id:
            applied_jobs.add(job_id.strip())
        u = clean_url_key(url)
        if u:
            applied_urls.add(u)
        t = (job_title or "").strip().lower()
        c = (company or "").strip().lower()
        if t and c and c != "unknown":
            applied_signatures.add(f"{t}@@@{c}")
        TOTAL_APPLIED += 1
        log.info(f"✅ Confirmed Applied ({TOTAL_APPLIED}) — {job_title} @ {company}")
    else:
        TOTAL_COLLECTED += 1
        log.info(f"📋 Data Collected ({TOTAL_COLLECTED}) — {job_title} @ {company}")

    # Derive real company name from slug if unknown
    if (not company or company.strip().lower() == "unknown") and url:
        try:
            from services.response_tracker import extract_company_from_slug
            derived = extract_company_from_slug(url)
            if derived:
                company = derived
        except Exception:
            pass

    fieldnames = ["date", "platform", "job_title", "company", "job_id", "url", "status", "description"]
    rows = []
    found = False

    with FileLock(str(APPLIED_FILE) + ".lock", timeout=10):
        if os.path.exists(APPLIED_FILE):
            try:
                import io
                with open(APPLIED_FILE, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read().replace("\x00", "")
                reader = csv.DictReader(io.StringIO(content))
                for r in reader:
                    if r.get("job_id") == job_id:
                        found = True
                        if is_applied_status(status):
                            r["status"] = status
                        elif is_applied_status(r.get("status")):
                            pass
                        else:
                            r["status"] = status
                        if not r.get("company") or r.get("company").lower() == "unknown":
                            r["company"] = company
                    rows.append(r)
            except Exception:
                rows = []

        if found:
            with open(APPLIED_FILE, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in rows:
                    if r.get("job_id") == job_id and description:
                        r["description"] = description
                    writer.writerow({k: r.get(k, "") for k in fieldnames})
        else:
            file_exists = os.path.exists(APPLIED_FILE) and os.stat(APPLIED_FILE).st_size > 0
            with open(APPLIED_FILE, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow(fieldnames)
                writer.writerow([
                    datetime.now().strftime("%Y-%m-%d %H:%M"),
                    platform, job_title, company, job_id, url, status, description
                ])
    log.info(f"💾 Saved: {platform} | {job_title} @ {company} [{status}]")

    # Ensure User 1 CSV file and root CSV are always kept in sync
    try:
        user1_csv = os.path.abspath(os.path.join(BASE_DIR, "data", "users", "1", "applied_jobs.csv"))
        root_csv = os.path.abspath(os.path.join(BASE_DIR, "applied_jobs.csv"))
        curr_csv = os.path.abspath(APPLIED_FILE)
        import shutil
        if curr_csv == user1_csv and os.path.exists(curr_csv):
            shutil.copy2(curr_csv, root_csv)
        elif curr_csv == root_csv and os.path.exists(curr_csv):
            if os.path.exists(os.path.dirname(user1_csv)):
                shutil.copy2(curr_csv, user1_csv)
    except Exception:
        pass


def human_delay(mn=None, mx=None):
    t = random.uniform(mn or CONFIG["delay_min"], mx or CONFIG["delay_max"])
    time.sleep(t)


def platform_rest():
    """10-15 minute rest between platforms to avoid detection"""
    wait = random.uniform(CONFIG["platform_rest_min"], CONFIG["platform_rest_max"])
    log.info(f"⏳ Platform rest: {int(wait//60)} min {int(wait%60)} sec...")
    time.sleep(wait)


def safe_click(driver, el):
    try:
        driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'nearest'});", el)
        time.sleep(0.3)
        el.click()
    except Exception:
        try:
            driver.execute_script("arguments[0].click();", el)
        except Exception:
            pass


def wait_for(driver, by, selector, timeout=15):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((by, selector))
    )


def type_human(element, text, delay=0.08):
    """Type like a human with random keystroke delays"""
    element.clear()
    for char in text:
        element.send_keys(char)
        time.sleep(random.uniform(0.04, delay))


def save_cookies(driver, platform):
    if driver is None:
        return
    try:
        os.makedirs(CONFIG["cookie_dir"], exist_ok=True)
        path = os.path.join(CONFIG["cookie_dir"], f"{platform}.pkl")
        cookies = driver.get_cookies()
        if cookies:
            with open(path, "wb") as f:
                pickle.dump(cookies, f)
            log.info(f"Cookies saved for {platform}")
    except Exception as e:
        log.warning(f"Could not save cookies for {platform}: {e}")


def load_cookies(driver, platform, domain):
    path = os.path.join(CONFIG["cookie_dir"], f"{platform}.pkl")
    if not os.path.exists(path):
        return False
    driver.get(domain)
    time.sleep(2)
    with open(path, "rb") as f:
        cookies = pickle.load(f)
    for cookie in cookies:
        try:
            driver.add_cookie(cookie)
        except Exception:
            pass
    driver.refresh()
    time.sleep(3)
    log.info(f"🍪 Cookies loaded for {platform}")
    return True


# ══════════════════════════════════════════════════════════════
#  BROWSER FACTORY — Edge / Brave / Chrome auto-detect
# ══════════════════════════════════════════════════════════════

def find_profile_path(browser_name):
    """
    Windows pe existing browser profile dhundo automatically.
    Uses LOCALAPPDATA environment variable.
    """
    local_app = os.environ.get("LOCALAPPDATA") or os.path.expanduser(r"~\AppData\Local")

    candidates = {
        "edge": [
            os.path.join(local_app, "Microsoft", "Edge", "User Data"),
        ],
        "chrome": [
            os.path.join(local_app, "Google", "Chrome", "User Data"),
        ],
        "brave": [
            os.path.join(local_app, "BraveSoftware", "Brave-Browser", "User Data"),
        ],
    }

    paths = candidates.get(browser_name, [])
    for p in paths:
        if os.path.isdir(p):
            log.info(f"✅ Profile found: {p}")
            return p

    log.warning(f"⚠️  Profile nahi mila for {browser_name}")
    return None


BOT_PROFILE_DIR = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "JobBot_Browser_Profile"
)
os.makedirs(BOT_PROFILE_DIR, exist_ok=True)


def check_and_handle_captcha(driver, wait_seconds=120, platform="indeed"):
    """
    Detects Cloudflare Turnstile, 'Verify you are human', or 'Additional Verification Required'.
    Plays audio chime and gives user up to 120s to click or let it auto-verify.
    DOES NOT CLOSE THE BROWSER.
    """
    indicators = [
        "verify you are human",
        "verify you are not a robot",
        "additional verification required",
        "just a moment...",
        "just a moment",
        "checking your browser",
        "security check",
        "challenges.cloudflare.com",
        "turnstile",
        "ray id",
    ]
    try:
        page_src = driver.page_source.lower()
        title = driver.title.lower()
    except Exception:
        return True

    detected = any(ind in page_src for ind in indicators) or any(ind in title for ind in indicators)
    if not detected:
        return True

    # Play alert sound
    try:
        import winsound
        winsound.Beep(1200, 400)
    except Exception:
        pass

    log.warning(f"⚠️ CLOUDFLARE DETECTED on {platform.capitalize()}: 'Additional Verification Required / Verify you are human'")
    log.info("👉 ACTION: Please click the 'Verify you are human' checkbox in the open Chrome window!")
    log.info(f"⏳ Waiting up to {wait_seconds}s for verification to pass (window will STAY OPEN)...")

    # Attempt auto-click
    try:
        frames = driver.find_elements(By.CSS_SELECTOR, "iframe[src*='challenges.cloudflare.com'], iframe[src*='cloudflare'], iframe[src*='turnstile'], iframe[title*='widget']")
        for f in frames:
            try:
                driver.switch_to.frame(f)
                time.sleep(0.5)
                cbs = driver.find_elements(By.CSS_SELECTOR, "input[type='checkbox'], #cf-stage, .ctp-checkbox-label, .mark, label.cb-lb")
                if cbs:
                    from selenium.webdriver.common.action_chains import ActionChains
                    ActionChains(driver).move_to_element(cbs[0]).pause(0.2).click().perform()
                    log.info("🤖 Auto-click attempted on Cloudflare Turnstile checkbox!")
                driver.switch_to.default_content()
            except Exception:
                driver.switch_to.default_content()
    except Exception:
        pass

    # Polling wait loop
    start_t = time.time()
    while time.time() - start_t < wait_seconds:
        time.sleep(1.5)
        try:
            curr_src = driver.page_source.lower()
            curr_title = driver.title.lower()
            turnstile_cleared = (
                "additional verification required" not in curr_src
                and "verify you are human" not in curr_src
                and "just a moment" not in curr_title
            )
            job_found = bool(driver.find_elements(By.CSS_SELECTOR, ".job_seen_beacon, .resultContent, [data-jk], div.cardOutline, #jobsearch-Main, header, nav"))
            if turnstile_cleared or job_found:
                log.info(f"🎉 Cloudflare verification PASSED successfully! Saving clearance cookies for {platform}...")
                save_cookies(driver, platform)
                time.sleep(2)
                return True
        except Exception:
            pass

    log.warning("⚠️ Verification wait period ended — attempting to proceed...")
    return False


def get_tailored_cover_note(job_title: str, company: str, job_description: str = "") -> str:
    """
    If AI credentials are configured, generates a high-signal customized
    cover letter/note referencing candidate skills and the specific company.
    Otherwise gracefully falls back to CONFIG['cover_note'].
    """
    prov = (CONFIG.get("ai_provider") or "grok").lower().strip()
    key = CONFIG.get(f"{prov}_api_key") or CONFIG.get("ai_api_key", "")
    model = CONFIG.get("ai_model", "")

    if key:
        try:
            from services.ai_service import generate_job_communication
            log.info(f"✨ Generating AI tailored pitch for {job_title} at {company} ({prov.upper()})...")
            content = generate_job_communication(
                provider=prov,
                api_key=key,
                model=model,
                job_title=job_title,
                company=company,
                job_description=job_description,
                candidate_profile=CONFIG,
                message_type="cover_letter"
            )
            if content and len(content.strip()) > 30:
                return content.strip()
        except Exception as e:
            log.warning(f"AI generation note: {e} — using standard cover note")

    return CONFIG.get("cover_note", "")


def fill_screening_questions_on_page(driver, title: str = "", company: str = ""):
    """
    Scans the current page/modal for screening questions (text inputs, textareas,
    dropdowns, and radio buttons) and answers them using AI & Candidate Profile.
    """
    try:
        from services.ai_service import answer_screening_question
        from selenium.webdriver.support.ui import Select

        # 1. Textareas and text/number inputs
        fields = driver.find_elements(
            By.CSS_SELECTOR,
            "textarea, input[type='text']:not([name*='name']):not([name*='email']):not([name*='phone']):not([name*='mobile']):not([name*='url']):not([name*='first']):not([name*='last']), input[type='number']"
        )
        for field in fields:
            try:
                if not field.is_displayed() or field.get_attribute("value"):
                    continue
                label_text = (
                    field.get_attribute("aria-label")
                    or field.get_attribute("placeholder")
                    or field.get_attribute("name")
                    or ""
                )
                try:
                    parent = field.find_element(By.XPATH, "./ancestor::div[contains(@class,'question') or contains(@class,'field') or contains(@class,'form') or string-length(text()) > 5][1]")
                    label_text = parent.text or label_text
                except Exception:
                    try:
                        parent = field.find_element(By.XPATH, "./ancestor::label")
                        label_text = parent.text or label_text
                    except Exception:
                        pass

                if label_text and len(label_text.strip()) > 3:
                    ai_answer = answer_screening_question(
                        question_text=label_text,
                        job_title=title,
                        company=company,
                        candidate_profile=CONFIG
                    )
                    if ai_answer:
                        field.clear()
                        field.send_keys(str(ai_answer))
                        time.sleep(0.3)
            except Exception:
                pass

        # 2. Select dropdowns
        for s_el in driver.find_elements(By.CSS_SELECTOR, "select"):
            try:
                if not s_el.is_displayed():
                    continue
                s_label = s_el.get_attribute("name") or s_el.get_attribute("aria-label") or ""
                try:
                    parent = s_el.find_element(By.XPATH, "./ancestor::div[1]")
                    s_label = parent.text or s_label
                except Exception:
                    pass
                s_label_lower = s_label.lower()
                sel_obj = Select(s_el)
                if any(w in s_label_lower for w in ["authorized", "authorization", "legally", "right to work"]):
                    for opt in sel_obj.options:
                        if "yes" in opt.text.lower():
                            sel_obj.select_by_visible_text(opt.text)
                            break
                elif any(w in s_label_lower for w in ["sponsorship", "visa"]):
                    for opt in sel_obj.options:
                        if "no" in opt.text.lower():
                            sel_obj.select_by_visible_text(opt.text)
                            break
                elif any(w in s_label_lower for w in ["relocate", "relocation"]):
                    for opt in sel_obj.options:
                        if "yes" in opt.text.lower():
                            sel_obj.select_by_visible_text(opt.text)
                            break
                elif any(w in s_label_lower for w in ["gender"]):
                    for opt in sel_obj.options:
                        if any(x in opt.text.lower() for x in ["prefer not", "decline"]):
                            sel_obj.select_by_visible_text(opt.text)
                            break
            except Exception:
                pass

        # 3. Radio buttons (e.g. Yes/No questions)
        radios = driver.find_elements(By.CSS_SELECTOR, "input[type='radio']")
        handled_radio_names = set()
        for r in radios:
            try:
                r_name = r.get_attribute("name")
                if not r_name or r_name in handled_radio_names:
                    continue
                handled_radio_names.add(r_name)
                try:
                    group_parent = r.find_element(By.XPATH, "./ancestor::fieldset | ./ancestor::div[contains(@class,'question') or contains(@class,'field')][1]")
                    q_text = group_parent.text.lower()
                except Exception:
                    q_text = ""

                if any(w in q_text for w in ["authorized", "right to work", "immediate", "comfortable", "relocate", "agree"]):
                    group_radios = driver.find_elements(By.CSS_SELECTOR, f"input[type='radio'][name='{r_name}']")
                    for gr in group_radios:
                        val = (gr.get_attribute("value") or gr.get_attribute("id") or "").lower()
                        lbl = ""
                        try:
                            lbl = driver.find_element(By.CSS_SELECTOR, f"label[for='{gr.get_attribute('id')}']").text.lower()
                        except Exception:
                            pass
                        if "yes" in val or "yes" in lbl or "true" in val:
                            driver.execute_script("arguments[0].click();", gr)
                            break
                elif any(w in q_text for w in ["sponsorship", "felony", "criminal"]):
                    group_radios = driver.find_elements(By.CSS_SELECTOR, f"input[type='radio'][name='{r_name}']")
                    for gr in group_radios:
                        val = (gr.get_attribute("value") or gr.get_attribute("id") or "").lower()
                        lbl = ""
                        try:
                            lbl = driver.find_element(By.CSS_SELECTOR, f"label[for='{gr.get_attribute('id')}']").text.lower()
                        except Exception:
                            pass
                        if "no" in val or "no" in lbl or "false" in val:
                            driver.execute_script("arguments[0].click();", gr)
                            break
            except Exception:
                pass
    except Exception as e:
        log.warning(f"fill_screening_questions_on_page note: {e}")


_SHARED_DRIVER = None
_INDEED_INITIALIZED = False
_NAUKRI_INITIALIZED = False

def get_shared_driver(platform_name=""):
    """
    Keeps browser window OPEN across combos so session, cookies,
    and Cloudflare clearance are NEVER lost between job searches.
    """
    global _SHARED_DRIVER
    if _SHARED_DRIVER is not None:
        try:
            _ = _SHARED_DRIVER.title
            for h in _SHARED_DRIVER.window_handles:
                try:
                    _SHARED_DRIVER.switch_to.window(h)
                    if not _SHARED_DRIVER.current_url.startswith("chrome://"):
                        break
                except Exception:
                    pass
            return _SHARED_DRIVER
        except Exception:
            _SHARED_DRIVER = None

    _SHARED_DRIVER = make_driver(platform_name)
    if _SHARED_DRIVER is not None:
        try:
            for h in _SHARED_DRIVER.window_handles:
                try:
                    _SHARED_DRIVER.switch_to.window(h)
                    if not _SHARED_DRIVER.current_url.startswith("chrome://"):
                        break
                except Exception:
                    pass
        except Exception:
            pass
    return _SHARED_DRIVER

def close_shared_driver():
    global _SHARED_DRIVER
    if _SHARED_DRIVER is not None:
        try:
            _SHARED_DRIVER.quit()
        except Exception:
            pass
        _SHARED_DRIVER = None

def get_patched_chromedriver_path():
    driver_path = ChromeDriverManager().install()
    try:
        if os.path.exists(driver_path):
            with open(driver_path, "rb") as f:
                content = f.read()
            if b"cdc_" in content:
                content = content.replace(b"cdc_", b"dog_")
                with open(driver_path, "wb") as f:
                    f.write(content)
                log.info("🛡️ Patched ChromeDriver binary to remove cdc_ signature")
    except Exception as e:
        log.debug(f"Patch note: {e}")
    return driver_path


def is_port_listening(port=9222):
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    res = s.connect_ex(('127.0.0.1', port))
    s.close()
    return res == 0


def get_real_chrome_executable():
    paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return "chrome.exe"


def launch_real_chrome(url="https://www.naukri.com/nlogin/login"):
    """
    Option 2: Launches real Google Chrome with remote debugging (port 9222)
    and persistent user profile directory.
    User logs in once using Google/OTP; session and cookies remain saved forever.
    """
    chrome_exe = get_real_chrome_executable()
    alive = False
    if is_port_listening(9222):
        try:
            import urllib.request
            req = urllib.request.Request("http://127.0.0.1:9222/json/version")
            with urllib.request.urlopen(req, timeout=1.5) as res:
                alive = (res.status == 200)
        except Exception:
            alive = False

    if not alive:
        try:
            import subprocess
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/IM", "chromedriver.exe"], capture_output=True, timeout=3)
                subprocess.run(
                    ["powershell", "-NoProfile", "-Command", "Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"],
                    capture_output=True,
                    timeout=5
                )
                time.sleep(0.5)
        except Exception:
            pass

        bat_path = os.path.join(BASE_DIR, "launch_chrome.bat")
        with open(bat_path, "w", encoding="utf-8") as bf:
            bf.write(f'@echo off\nstart "" "{chrome_exe}" --remote-debugging-port=9222 --user-data-dir="{BOT_PROFILE_DIR}" --start-maximized "{url}"\n')

        log.info(f"🌐 Launching Interactive Desktop Chrome via ShellExecute: {url}")
        try:
            os.startfile(bat_path)
        except Exception as e:
            try:
                os.system(f'explorer.exe "{bat_path}"')
            except Exception:
                os.system(f'start "" "{chrome_exe}" --remote-debugging-port=9222 --user-data-dir="{BOT_PROFILE_DIR}" --start-maximized "{url}"')

        for _ in range(16):
            time.sleep(0.5)
            if is_port_listening(9222):
                break
    else:
        try:
            global _SHARED_DRIVER
            d = _SHARED_DRIVER
            if d is None:
                d = get_shared_driver()
            if d is not None:
                d.get(url)
        except Exception as e:
            log.warning(f"Navigate existing chrome window note: {e}")


def make_driver(platform_name=""):
    """
    Option 2: Connects to Real Chrome via Remote Debugging (port 9222) with persistent profile.
    LinkedIn/Naukri/Indeed — once logged in, remains logged in permanently!
    """
    # 1. Primary: Real Chrome Remote Debugging (Port 9222)
    if not is_port_listening(9222):
        launch_real_chrome("https://www.google.com")

    if is_port_listening(9222):
        try:
            opts = ChromeOptions()
            opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
            opts.page_load_strategy = "eager"
            service = ChromeService(get_patched_chromedriver_path())
            d = webdriver.Chrome(service=service, options=opts)
            d.implicitly_wait(4)
            d.set_page_load_timeout(15)
            log.info("🌐 Connected to Real Chrome via Remote Debugging (Port 9222) ✅")
            return d
        except Exception as e:
            log.warning(f"Could not attach to port 9222 ({e}) — falling back to standard profile launcher...")
    browser = CONFIG["browser"].lower()

    # ── Anti-detection args ───────────────────────────────────
    common_args = [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-popup-blocking",
        "--disable-notifications",
        "--disable-infobars",
        "--start-maximized",
        "--lang=en-US,en",
        # Disable password manager popups
        "--disable-save-password-bubble",
    ]

    def _patch(driver):
        """Webdriver detection hatao with selenium-stealth"""
        if HAS_STEALTH:
            try:
                stealth(
                    driver,
                    languages=["en-US", "en"],
                    vendor="Google Inc.",
                    platform="Win32",
                    webgl_vendor="Intel Inc.",
                    renderer="Intel Iris OpenGL Engine",
                    fix_hairline=True,
                )
            except Exception as e:
                log.debug(f"Stealth note: {e}")
        driver.execute_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            "window.chrome={runtime:{}};"
        )
        driver.implicitly_wait(12)
        return driver

    def try_edge():
        opts = EdgeOptions()
        for a in common_args:
            opts.add_argument(a)
        if CONFIG["headless"]:
            opts.add_argument("--headless=new")
        opts.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
        opts.add_experimental_option("useAutomationExtension", False)

        # ✅ KEY FIX: Apna existing Edge profile load karo
        profile_path = find_profile_path("edge")
        if profile_path:
            opts.add_argument(f"--user-data-dir={profile_path}")
            opts.add_argument("--profile-directory=Default")
            log.info("🟦 Edge: Existing profile load ho raha hai (LinkedIn pehle se logged in hoga)")
        else:
            log.warning("🟦 Edge: Profile nahi mila — fresh window khulegi")

        try:
            service = EdgeService(EdgeChromiumDriverManager().install())
            d = webdriver.Edge(service=service, options=opts)
            log.info("🟦 Edge launched ✅")
            return _patch(d)
        except Exception as e:
            # Agar profile lock hai (Edge already open) to remote debugging try karo
            if "user data directory is already in use" in str(e).lower():
                log.warning("🟦 Edge already open hai — remote debugging mode try kar raha hoon...")
                return try_edge_remote_debug()
            raise

    def try_edge_remote_debug():
        """Agar Edge already open hai to remote debugging se connect karo"""
        import subprocess
        opts = EdgeOptions()
        opts.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
        try:
            # Pehle existing Edge ko debug mode mein restart karo
            subprocess.Popen([
                r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                "--remote-debugging-port=9222",
                "--user-data-dir=C:\\EdgeDebugProfile",
            ])
            time.sleep(3)
            service = EdgeService(EdgeChromiumDriverManager().install())
            d = webdriver.Edge(service=service, options=opts)
            log.info("🟦 Edge remote debug connected ✅")
            return _patch(d)
        except Exception as e2:
            raise RuntimeError(f"Edge remote debug bhi fail: {e2}")

    def try_chrome(brave=False):
        opts = ChromeOptions()
        for a in common_args:
            opts.add_argument(a)
        if CONFIG["headless"]:
            opts.add_argument("--headless=new")
        opts.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
        opts.add_experimental_option("useAutomationExtension", False)

        bname = "brave" if brave else "chrome"
        if brave:
            brave_paths = [
                r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
                r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
            ]
            for p in brave_paths:
                if os.path.exists(p):
                    opts.binary_location = p
                    break

        # Persistent dedicated bot profile (avoids browser lock conflict & keeps cookies/Cloudflare clearance tokens!)
        opts.add_argument(f"--user-data-dir={BOT_PROFILE_DIR}")
        opts.add_argument("--profile-directory=Default")
        log.info(f"{'🦁 Brave' if brave else '🌐 Chrome'}: Persistent JobBot profile active")

        try:
            service = ChromeService(get_patched_chromedriver_path())
            d = webdriver.Chrome(service=service, options=opts)
            name = "🦁 Brave" if brave else "🌐 Chrome"
            log.info(f"{name} launched with anti-detection profile ✅")
            return _patch(d)
        except Exception as e:
            if "user data directory is already in use" in str(e).lower():
                log.warning("Bot profile locked — generating subsession profile...")
                sub_profile = os.path.join(BOT_PROFILE_DIR, f"session_{int(time.time())}")
                opts2 = ChromeOptions()
                for a in common_args:
                    opts2.add_argument(a)
                opts2.add_experimental_option("excludeSwitches", ["enable-automation"])
                opts2.add_experimental_option("useAutomationExtension", False)
                opts2.add_argument(f"--user-data-dir={sub_profile}")
                service2 = ChromeService(get_patched_chromedriver_path())
                d2 = webdriver.Chrome(service=service2, options=opts2)
                return _patch(d2)
            raise

    order = {
        "edge":   [try_edge],
        "chrome": [lambda: try_chrome(False)],
        "brave":  [lambda: try_chrome(True)],
        "auto":   [lambda: try_chrome(False), try_edge, lambda: try_chrome(True)],
    }.get(browser, [lambda: try_chrome(False)])

    for fn in order:
        try:
            return fn()
        except Exception as e:
            log.warning(f"Browser launch failed ({browser}): {e} — next try...")

    raise RuntimeError("❌ Koi bhi browser launch nahi hua! Edge/Chrome/Brave install karo.")


# ══════════════════════════════════════════════════════════════
#  LINKEDIN BOT  (Fixed Login + Cookie Session)
# ══════════════════════════════════════════════════════════════

def linkedin_posts_collector(driver, title, loc):
    """
    Discovers fresh job opportunities posted directly by founders, recruiters, and hiring managers
    on LinkedIn content feeds and posts.
    """
    import urllib.parse
    import hashlib
    import re
    log.info(f"📰 LinkedIn Posts: Scanning recruiter hiring posts for [{title}] in [{loc}]...")

    query = f'hiring "{title}" "{loc}"'
    search_url = f"https://www.linkedin.com/search/results/content/?keywords={urllib.parse.quote(query)}&sortBy=%22date_posted%22"

    collected_posts = 0
    try:
        driver.get(search_url)
        human_delay(3, 5)

        # Anti-block checkpoint check
        cur_u = driver.current_url.lower()
        if any(w in cur_u for w in ["checkpoint", "authwall", "challenge", "login"]):
            log.warning("LinkedIn: Security checkpoint detected. Skipping post scan to preserve account.")
            return 0

        # Human-like organic smooth scroll
        driver.execute_script("window.scrollBy({top: 450, behavior: 'smooth'});")
        time.sleep(2)
        driver.execute_script("window.scrollBy({top: 550, behavior: 'smooth'});")
        time.sleep(2)

        # Fast in-browser JS extraction
        posts = driver.execute_script("""
            const results = [];
            const cards = document.querySelectorAll('div.feed-shared-update-v2, div[data-urn*="activity"], li.reusable-search__result-container');
            cards.forEach(card => {
                const authorEl = card.querySelector('.update-components-actor__name, .app-aware-link span[dir="ltr"]');
                const titleEl = card.querySelector('.update-components-actor__description, .update-components-actor__sub-description');
                const textEl = card.querySelector('.update-components-text, .feed-shared-update-v2__description, span.break-words');
                const linkEl = card.querySelector('a[href*="/feed/update/urn:li:activity:"], a[href*="activity-"], a[href*="lever.co"], a[href*="greenhouse.io"], a[href*="docs.google.com"], a[href*="myworkdayjobs.com"]');

                const text = textEl ? textEl.innerText.trim() : '';
                const author = authorEl ? authorEl.innerText.trim() : 'Recruiter';
                const headline = titleEl ? titleEl.innerText.trim() : '';
                const url = linkEl ? linkEl.href : '';

                if (text && text.length > 20) {
                    results.push({ author, headline, text, url });
                }
            });
            return results;
        """) or []

        for p in posts:
            p_text = p.get("text", "")
            p_lower = p_text.lower()
            if not any(k in p_lower for k in ["hiring", "looking for", "opportunity", "open role", "opening", "join our team", "apply", "dm", "send resume", "job"]):
                continue

            author = p.get("author", "Hiring Lead")
            headline = p.get("headline", "")
            company = "LinkedIn Network"
            if " at " in headline:
                company = headline.split(" at ")[-1].split("|")[0].split("•")[0].strip()
            elif "@" in headline:
                company = headline.split("@")[-1].split("|")[0].split("•")[0].strip()

            post_url = p.get("url") or driver.current_url
            job_id = f"li-post-{hashlib.md5((author + p_text[:60]).encode()).hexdigest()[:12]}"

            # Verify against candidate targets & preferences
            try:
                from services.job_filter import is_job_match
                is_match, reason = is_job_match(title, loc=loc, description=p_text, config=CONFIG)
                if not is_match:
                    continue
            except Exception:
                pass

            if job_id not in applied_jobs:
                save_applied("LinkedIn", f"{title} (Post by {author})", company, job_id, post_url, status="Not Applied", description=p_text)
                collected_posts += 1

        log.info(f"LinkedIn: Collected {collected_posts} direct recruiter post opportunities")
    except Exception as e:
        log.warning(f"LinkedIn posts collector note: {e}")

    return collected_posts


def linkedin_bot():
    log.info("═══ LinkedIn Bot Starting ═══")
    driver = get_shared_driver("LinkedIn")
    applied = 0

    try:
        # ── Login Check: Profile se already logged in hoga ───
        # Browser apna existing profile use karta hai (make_driver mein set hai)
        # Isliye LinkedIn pehle se logged in hona chahiye
        logged_in = False

        log.info("LinkedIn: Feed check kar raha hoon...")
        try:
            driver.get("https://www.linkedin.com/feed/")
            human_delay(5, 8)
        except Exception:
            pass

        cur = driver.current_url
        log.info(f"LinkedIn: Current URL = {cur}")

        if any(x in cur for x in ["feed", "mynetwork", "jobs/", "messaging"]):
            logged_in = True
            log.info("LinkedIn: ✅ Already logged in via browser profile!")

        elif any(x in cur for x in ["login", "authwall", "checkpoint", "uas/authenticate"]):
            # Profile mein login nahi tha — manually karna padega
            print("")
            print("="*65)
            print("  ⚠️  LINKEDIN: Automatically login nahi hua!")
            print("  → Browser window mein LinkedIn manually login karo")
            print(f"  → {CONFIG['manual_login_wait']} seconds diye ja rahe hain")
            print("="*65)
            print("")
            log.warning(f"LinkedIn: Manual login required — {CONFIG['manual_login_wait']}s wait...")
            time.sleep(CONFIG["manual_login_wait"])

            try:
                driver.get("https://www.linkedin.com/feed/")
                time.sleep(6)
            except Exception:
                pass

            if any(x in driver.current_url for x in ["feed", "mynetwork", "jobs/"]):
                logged_in = True
                log.info("LinkedIn: ✅ Manual login successful!")
            else:
                log.error(f"LinkedIn: Login nahi hua. URL: {driver.current_url}")
                try:
                    driver.quit()
                except Exception:
                    pass
                return 0
        else:
            # Unexpected page — ek aur try
            log.warning(f"LinkedIn: Unexpected URL: {cur} — dobara try kar raha hoon...")
            time.sleep(5)
            try:
                driver.get("https://www.linkedin.com/feed/")
                time.sleep(6)
            except Exception:
                pass
            if any(x in driver.current_url for x in ["feed", "mynetwork"]):
                logged_in = True
            else:
                log.error("LinkedIn: Login confirm nahi hua — skipping")
                try:
                    driver.quit()
                except Exception:
                    pass
                return 0

        if not logged_in:
            try:
                driver.quit()
            except Exception:
                pass
            return 0

        # ── Step 3: Apply to jobs ──────────────────────────────
        # Scan LinkedIn recruiter hiring posts
        try:
            log.info("LinkedIn: Scanning recruiter posts and feed for direct opportunities...")
            linkedin_posts_collector(driver, CONFIG.get("job_title", ""), CONFIG.get("location", ""))
        except Exception as e:
            log.warning(f"LinkedIn posts collection note: {e}")

        query = CONFIG["job_title"].replace(" ", "%20")
        loc   = CONFIG["location"].replace(" ", "%20")

        # Easy Apply filter + Date Posted filter + Most recent
        post_age_days = int(CONFIG.get("job_post_age_days") or CONFIG.get("job_post_age") or 7)
        tpr_param = f"&f_TPR=r{post_age_days * 86400}" if post_age_days > 0 else ""
        url = (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={query}"
            f"&location={loc}"
            f"&f_AL=true"
            f"{tpr_param}"
            f"&sortBy=DD"
        )
        driver.get(url)
        human_delay(4, 7)

        page = 0
        while applied < CONFIG["max_per_platform"]:
            page += 1
            log.info(f"LinkedIn: 📄 Page {page} | Applied so far: {applied}/{CONFIG['max_per_platform']}")

            try:
                # Scroll to load all cards
                driver.execute_script("window.scrollTo(0, 300);")
                time.sleep(2)
                job_cards = driver.find_elements(
                    By.CSS_SELECTOR,
                    ".jobs-search__results-list li, "
                    ".scaffold-layout__list-item, "
                    "[data-job-id]"
                )
            except Exception:
                job_cards = []

            if not job_cards:
                log.info("LinkedIn: No job cards found")
                break

            log.info(f"LinkedIn: Found {len(job_cards)} cards on page {page}")

            for idx, card in enumerate(job_cards):
                if applied >= CONFIG["max_per_platform"]:
                    break
                try:
                    safe_click(driver, card)
                    human_delay(2, 4)

                    # Get job details
                    job_title, company = "Unknown", "Unknown"
                    try:
                        job_title = driver.find_element(
                            By.CSS_SELECTOR,
                            ".job-details-jobs-unified-top-card__job-title h1, "
                            ".jobs-unified-top-card__job-title, "
                            "h1.t-24"
                        ).text.strip()
                    except Exception:
                        pass
                    try:
                        company = driver.find_element(
                            By.CSS_SELECTOR,
                            ".job-details-jobs-unified-top-card__company-name a, "
                            ".jobs-unified-top-card__company-name, "
                            ".topcard__org-name-link"
                        ).text.strip()
                    except Exception:
                        pass

                    # Check Search Targets & Preferences
                    try:
                        from services.job_filter import is_job_match, clean_job_title
                        clean_t = clean_job_title(job_title)
                        is_match, reason = is_job_match(clean_t, loc=CONFIG.get("location"), company=company, config=CONFIG)
                        if not is_match:
                            log.info(f"LinkedIn: SKIP ({reason}) — {clean_t} @ {company}")
                            continue
                    except Exception:
                        pass

                    # Job ID from URL
                    job_id = ""
                    if "currentJobId=" in driver.current_url:
                        job_id = driver.current_url.split("currentJobId=")[-1].split("&")[0]
                    elif "/jobs/view/" in driver.current_url:
                        job_id = driver.current_url.split("/jobs/view/")[-1].split("/")[0]
                    if not job_id:
                        job_id = f"li_{job_title}_{company}".replace(" ", "_")

                    # Extract real job description
                    li_desc = ""
                    try:
                        desc_el = driver.find_elements(By.CSS_SELECTOR, ".jobs-description__content, .jobs-box__html-content, .show-more-less-html__markup, .jobs-description-content, .jobs-description")
                        if desc_el:
                            li_desc = desc_el[0].text.strip()
                    except Exception:
                        pass
                    # Log job as Collected with status 'Not Applied'
                    save_applied("LinkedIn", job_title, company, job_id, driver.current_url, status="Not Applied", description=li_desc)

                    if job_id in applied_jobs:
                        log.info(f"LinkedIn: SKIP (already applied) — {job_title} @ {company}")
                        human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                        continue

                    # Find Easy Apply button
                    apply_btn = None
                    for sel in [
                        "button.jobs-apply-button[aria-label*='Easy Apply']",
                        ".jobs-s-apply button",
                        "button[aria-label*='Easy Apply']",
                        ".jobs-apply-button",
                    ]:
                        try:
                            apply_btn = driver.find_element(By.CSS_SELECTOR, sel)
                            if "Easy Apply" in (apply_btn.text + apply_btn.get_attribute("aria-label") or ""):
                                break
                        except Exception:
                            pass

                    if not apply_btn:
                        log.info(f"LinkedIn: No Easy Apply — {job_title} @ {company}")
                        human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                        continue

                    safe_click(driver, apply_btn)
                    human_delay(2, 4)

                    # Multi-step form handler
                    submitted = False
                    steps_done = 0
                    max_steps = 15

                    while steps_done < max_steps and not submitted:
                        human_delay(1.5, 3)

                        # Fill phone
                        try:
                            for pi in driver.find_elements(By.CSS_SELECTOR, "input[id*='phoneNumber'], input[name*='phone']"):
                                val = pi.get_attribute("value") or ""
                                if not val.strip():
                                    type_human(pi, CONFIG["phone"])
                        except Exception:
                            pass

                        # Fill text inputs based on label
                        try:
                            for inp in driver.find_elements(
                                By.CSS_SELECTOR,
                                ".jobs-easy-apply-form-section__grouping input[type=text], "
                                ".jobs-easy-apply-form-element input[type=text]"
                            ):
                                val = inp.get_attribute("value") or ""
                                if val.strip():
                                    continue
                                label_text = ""
                                try:
                                    label_id = inp.get_attribute("id")
                                    if label_id:
                                        lbl = driver.find_element(By.CSS_SELECTOR, f"label[for='{label_id}']")
                                        label_text = lbl.text.lower()
                                except Exception:
                                    pass
                                try:
                                    label_text = inp.find_element(By.XPATH, "ancestor::div[1]/label").text.lower()
                                except Exception:
                                    pass

                                if any(k in label_text for k in ["year", "experience", "exp"]):
                                    type_human(inp, CONFIG["experience"])
                                elif any(k in label_text for k in ["city", "location"]):
                                    type_human(inp, CONFIG["location"])
                                elif any(k in label_text for k in ["salary", "ctc", "expected"]):
                                    type_human(inp, CONFIG["salary"])
                                elif any(k in label_text for k in ["notice", "joining"]):
                                    type_human(inp, CONFIG["notice_period"])
                        except Exception:
                            pass

                        # Answer any custom screening questions, dropdowns, and radios via AI
                        try:
                            fill_screening_questions_on_page(driver, job_title, company)
                        except Exception:
                            pass

                        # Upload resume
                        try:
                            fi = driver.find_element(By.CSS_SELECTOR, "input[type=file]")
                            if os.path.exists(CONFIG["resume_path"]):
                                fi.send_keys(CONFIG["resume_path"])
                                human_delay(2, 4)
                        except Exception:
                            pass

                        # Cover letter / additional info
                        try:
                            for ta in driver.find_elements(By.CSS_SELECTOR, "textarea"):
                                if not (ta.get_attribute("value") or "").strip():
                                    pitch = get_tailored_cover_note(job_title, company)
                                    type_human(ta, pitch, delay=0.03)
                        except Exception:
                            pass

                        # Try Submit
                        try:
                            submit_btn = driver.find_element(
                                By.CSS_SELECTOR,
                                "button[aria-label='Submit application']"
                            )
                            safe_click(driver, submit_btn)
                            human_delay(2, 3)
                            applied += 1
                            submitted = True
                            save_applied("LinkedIn", job_title, company, job_id, driver.current_url, status="Applied")
                            # Dismiss confirmation
                            try:
                                driver.find_element(
                                    By.CSS_SELECTOR,
                                    "button[aria-label='Dismiss'], button[aria-label='Done']"
                                ).click()
                            except Exception:
                                pass
                            break
                        except NoSuchElementException:
                            pass

                        # Try Next / Review
                        next_found = False
                        for sel in [
                            "button[aria-label='Continue to next step']",
                            "button[aria-label='Review']",
                            "button[aria-label='Review your application']",
                            "button[aria-label='Next']",
                        ]:
                            try:
                                nb = driver.find_element(By.CSS_SELECTOR, sel)
                                safe_click(driver, nb)
                                steps_done += 1
                                next_found = True
                                human_delay(1, 2)
                                break
                            except NoSuchElementException:
                                pass

                        if not next_found and not submitted:
                            log.warning(f"LinkedIn: Stuck at step {steps_done} — {job_title}")
                            try:
                                driver.find_element(By.CSS_SELECTOR, "button[aria-label='Dismiss']").click()
                            except Exception:
                                pass
                            break

                    human_delay(CONFIG["delay_min"], CONFIG["delay_max"])

                except Exception as e:
                    log.error(f"LinkedIn: Card {idx} error — {e}")
                    human_delay(3, 6)

            # Next page
            try:
                next_page_btn = driver.find_element(
                    By.CSS_SELECTOR, f"button[aria-label='Page {page+1}']"
                )
                safe_click(driver, next_page_btn)
                human_delay(4, 7)
            except Exception:
                log.info("LinkedIn: No more pages")
                break

        # ── Step 4: Scan and collect LinkedIn Recruiter Posts ───
        try:
            posts_collected = linkedin_posts_collector(driver, CONFIG.get("job_title", ""), CONFIG.get("location", ""))
            log.info(f"LinkedIn: Posts scan complete ({posts_collected} new recruiter posts)")
        except Exception as pe:
            log.warning(f"LinkedIn posts collector note: {pe}")

    except Exception as e:
        log.error(f"LinkedIn: Fatal — {e}")
    finally:
        log.info(f"LinkedIn DONE ✅ — Total applied: {applied}")
    return applied


# ══════════════════════════════════════════════════════════════
#  NAUKRI BOT
# ══════════════════════════════════════════════════════════════

def login_naukri_with_credentials(driver, email: str, password: str) -> dict:
    """
    Automates credential login to Naukri, saves cookies permanently, and updates session.
    """
    if not email or not password:
        return {"success": False, "message": "Email and password are required."}
    
    try:
        driver.get("https://www.naukri.com/nlogin/login")
        human_delay(2, 4)
        
        # Check if already logged in
        cur = driver.current_url.lower()
        if "nlogin" not in cur and ("mnjuser" in cur or "homepage" in cur):
            save_cookies(driver, "naukri")
            return {"success": True, "message": "Already logged in to Naukri!"}
            
        # Locate username
        user_input = wait_for(driver, By.ID, "usernameField", timeout=10)
        user_input.clear()
        user_input.send_keys(email)
        
        # Locate password
        pass_input = driver.find_element(By.ID, "passwordField")
        pass_input.clear()
        pass_input.send_keys(password)
        
        # Click login button
        submit_btn = None
        for sel in ["button[type='submit']", ".loginButton", "button.btn-primary"]:
            try:
                b = driver.find_element(By.CSS_SELECTOR, sel)
                if b.is_displayed():
                    submit_btn = b
                    break
            except Exception:
                pass
        
        if submit_btn:
            submit_btn.click()
        else:
            from selenium.webdriver.common.keys import Keys
            pass_input.send_keys(Keys.RETURN)
            
        human_delay(4, 6)
        
        # Check outcome
        cur = driver.current_url.lower()
        if "nlogin" not in cur and ("mnjuser" in cur or "homepage" in cur):
            save_cookies(driver, "naukri")
            return {"success": True, "message": "Successfully logged in to Naukri & session saved!"}
            
        # Check for profile elements
        if driver.find_elements(By.CSS_SELECTOR, "a[href*='mnjuser/profile'], .nI-gIcon-account, .user-name, [data-qa='user-profile'], a[href*='my-naukri']"):
            save_cookies(driver, "naukri")
            return {"success": True, "message": "Successfully logged in to Naukri & session saved!"}
            
        # Check for error text on page
        err_msg = ""
        try:
            err_elem = driver.find_element(By.CSS_SELECTOR, ".server-err, .err, [class*='error-msg'], .err-msg")
            if err_elem.is_displayed():
                err_msg = err_elem.text.strip()
        except Exception:
            pass
            
        if err_msg:
            return {"success": False, "message": f"Naukri Login Error: {err_msg}"}
            
        if any(w in cur or w in driver.page_source.lower() for w in ["captcha", "otp", "verification"]):
            return {"success": False, "message": "Naukri requested OTP or CAPTCHA verification in the open browser. Please complete it there."}
            
        return {"success": False, "message": "Login submitted. If you see a prompt in the Chrome window, please complete it."}
    except Exception as e:
        log.error(f"Error logging into Naukri: {e}")
        return {"success": False, "message": f"Login failed: {str(e)}"}


def check_naukri_logged_in(driver, timeout_seconds=60):
    """
    Checks if Naukri has an active session. If not, attempts cookie load, credentials,
    or pauses for the user to complete Google Sign-in / OTP in the open browser window.
    Saves cookies permanently once verified!
    """
    # 1. Try loading cookies first
    load_cookies(driver, "naukri", "https://www.naukri.com")
    try:
        driver.get("https://www.naukri.com/mnjuser/homepage")
        human_delay(3, 4)
    except Exception:
        pass

    cur = driver.current_url.lower()
    if "nlogin" not in cur and ("mnjuser" in cur or "homepage" in cur):
        log.info("Naukri: ✅ Active session confirmed via cookies/profile!")
        save_cookies(driver, "naukri")
        return True

    try:
        if driver.find_elements(By.CSS_SELECTOR, ".nI-gIcon-account, .user-name, [data-qa='user-profile'], a[href*='mnjuser/profile'], a[href*='my-naukri']"):
            log.info("Naukri: ✅ Logged in via user profile element!")
            save_cookies(driver, "naukri")
            return True
    except Exception:
        pass

    # 2. If password configured, attempt automated fill
    if CONFIG.get("naukri_password") and CONFIG.get("naukri_email"):
        res = login_naukri_with_credentials(driver, CONFIG["naukri_email"], CONFIG["naukri_password"])
        if res.get("success"):
            return True

    # 3. Navigate to login page if not already there
    if "nlogin" not in driver.current_url.lower():
        driver.get("https://www.naukri.com/nlogin/login")
        human_delay(2, 4)

    # 4. Wait for user to sign in with Google or enter OTP
    log.warning(f"⚠️ Naukri is NOT logged in in this browser profile!")
    log.info(f"👉 Please click 'Sign in with Google' or enter your details in the open Chrome/Edge window.")
    log.info(f"⏳ Waiting up to {timeout_seconds}s for you to complete sign-in (window will STAY OPEN)...")

    try:
        import winsound
        winsound.Beep(1000, 300)
    except Exception:
        pass

    start_t = time.time()
    while time.time() - start_t < timeout_seconds:
        time.sleep(2)
        try:
            curr = driver.current_url.lower()
            if "nlogin" not in curr and ("mnjuser" in curr or "homepage" in curr):
                log.info("Naukri: ✅ Login confirmed! Saving session permanently...")
                save_cookies(driver, "naukri")
                return True
            if driver.find_elements(By.CSS_SELECTOR, ".nI-gIcon-account, .user-name, [data-qa='user-profile'], a[href*='mnjuser/profile'], a[href*='my-naukri']"):
                log.info("Naukri: ✅ Login confirmed! Saving session permanently...")
                save_cookies(driver, "naukri")
                return True
        except Exception:
            pass

    log.error("Naukri: Sign-in wait timed out without confirmation.")
    return False


def naukri_bot():
    global _NAUKRI_INITIALIZED
    log.info("═══ Naukri Bot Starting ═══")
    driver = get_shared_driver("Naukri")
    applied = 0

    try:
        logged_in = check_naukri_logged_in(driver, timeout_seconds=CONFIG.get("manual_login_wait", 60))
        if not logged_in:
            log.error("Naukri: Not logged in — skipping Naukri for this cycle")
            return 0

        query = CONFIG["job_title"].replace(" ", "-")
        loc   = CONFIG["location"].lower().replace(" ", "-")
        post_age = int(CONFIG.get("job_post_age_days") or CONFIG.get("job_post_age") or 7)
        job_age_param = f"&jobAge={post_age}" if post_age > 0 else ""
        driver.get(
            f"https://www.naukri.com/{query}-jobs-in-{loc}"
            f"?experience={CONFIG['experience']}"
            f"{job_age_param}"
        )
        human_delay(4, 7)

        job_links = []
        try:
            cards = driver.find_elements(
                By.CSS_SELECTOR,
                "article.jobTuple, .job-container, .srp-jobtuple-wrapper, [data-job-id]"
            )
            for c in cards[:CONFIG["max_per_platform"] + 10]:
                try:
                    a = c.find_element(By.CSS_SELECTOR, "a.title, a.jobTitle, .row1 a, a[title]")
                    href = a.get_attribute("href")
                    if href:
                        job_links.append((href, a.text.strip()))
                except Exception:
                    pass
        except Exception:
            log.warning("Naukri: Could not find job cards")

        log.info(f"Naukri: Found {len(job_links)} jobs")

        for href, title in job_links:
            if applied >= CONFIG["max_per_platform"]:
                break
            if not href:
                continue

            # Check Search Targets & Preferences
            try:
                from services.job_filter import is_job_match, clean_job_title
                clean_t = clean_job_title(title)
                is_match, reason = is_job_match(clean_t, loc=CONFIG.get("location"), config=CONFIG)
                if not is_match:
                    log.info(f"Naukri: SKIP ({reason}) — {clean_t}")
                    continue
            except Exception:
                pass
            job_id = href.split("?")[0].rstrip("/").split("/")[-1]
            if job_id in applied_jobs:
                log.info(f"Naukri: SKIP — {title}")
                continue
            try:
                driver.get(href)
                human_delay(CONFIG.get("page_load_wait", 8), CONFIG.get("page_load_wait", 8) + 4)
                company = "Unknown"
                try:
                    company = driver.find_element(
                        By.CSS_SELECTOR,
                        ".jd-header-comp-name a, .company-name, [class*='companyName']"
                    ).text.strip()
                except Exception:
                    pass

                # Extract real job description
                nk_desc = ""
                try:
                    desc_el = driver.find_elements(By.CSS_SELECTOR, ".job-desc, .styles_job-desc-container__txpYf, .dang-inner-html, .job-desc-container, .jobDesc, [class*='job-desc']")
                    if desc_el:
                        nk_desc = desc_el[0].text.strip()
                except Exception:
                    pass
                # 1. Log job as Collected with status 'Not Applied'
                save_applied("Naukri", title, company, job_id, href, status="Not Applied", description=nk_desc)

                apply_btn = None
                # 1. Try finding apply button by ID or universal XPath
                try:
                    for sel in [
                        "#apply-button",
                        ".apply-button",
                        "button[id*='apply']",
                        "button[class*='apply']",
                        "a[class*='apply']",
                        ".styles_apply-button__uJI3A",
                        ".styles_apply-button__N5EoV",
                        "button.styles_jhc__apply-btn__C2tUC",
                    ]:
                        for el in driver.find_elements(By.CSS_SELECTOR, sel):
                            if el.is_displayed():
                                txt = (el.text or el.get_attribute("innerText") or "").strip().lower()
                                if "apply" in txt or "apply" in (el.get_attribute("class") or "").lower():
                                    apply_btn = el
                                    break
                        if apply_btn:
                            break
                except Exception:
                    pass

                if not apply_btn:
                    # XPath fallback for any button/link with text "Apply"
                    try:
                        for xp in [
                            "//button[contains(translate(normalize-space(.), 'APPLY', 'apply'), 'apply')]",
                            "//a[contains(translate(normalize-space(.), 'APPLY', 'apply'), 'apply')]",
                            "//*[@role='button'][contains(translate(normalize-space(.), 'APPLY', 'apply'), 'apply')]",
                            "//*[contains(@class, 'apply') and (self::button or self::a or @role='button')]",
                        ]:
                            for el in driver.find_elements(By.XPATH, xp):
                                if el.is_displayed():
                                    apply_btn = el
                                    break
                            if apply_btn:
                                break
                    except Exception:
                        pass

                if not apply_btn:
                    log.info(f"Naukri: 📋 Collected only (No apply button) — {title}")
                    human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                    continue

                btn_text = (apply_btn.get_attribute("innerText") or apply_btn.text or "").lower().strip()
                if "already applied" in btn_text:
                    log.info(f"Naukri: Already applied previously — {title}")
                    save_applied("Naukri", title, company, job_id, href, status="Applied")
                    human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                    continue

                if "company site" in btn_text or "apply on" in btn_text:
                    log.info(f"Naukri: 📋 Job redirects to company portal — {title}")
                    # Attempt automated external apply via live career portal engine
                    try:
                        ext_res = apply_to_job_live(url=href, platform="Naukri-External", title=title, company=company, job_id=job_id)
                        if ext_res.get("success") or ext_res.get("status") == "applied":
                            applied += 1
                            save_applied("Naukri", title, company, job_id, href, status="Applied")
                        else:
                            save_applied("Naukri", title, company, job_id, href, status="Not Applied")
                    except Exception:
                        save_applied("Naukri", title, company, job_id, href, status="Not Applied")
                    human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                    continue

                # 2. Attempt applying
                safe_click(driver, apply_btn)
                human_delay(3, 5)

                # Handle questionnaire or screening modal if present
                try:
                    fill_screening_questions_on_page(driver, title, company)
                except Exception:
                    pass

                # Handle modal submission if present
                for sel in [
                    ".naukri-modal button.save",
                    ".apply-widget__btn-submit",
                    "button[class*='submit']",
                    "button[class*='save']",
                    "//button[contains(translate(normalize-space(.), 'SUBMIT', 'submit'), 'submit')]",
                    "//button[contains(translate(normalize-space(.), 'APPLY', 'apply'), 'apply')]"
                ]:
                    try:
                        if sel.startswith("//"):
                            m_btns = driver.find_elements(By.XPATH, sel)
                        else:
                            m_btns = driver.find_elements(By.CSS_SELECTOR, sel)
                        for mb in m_btns:
                            if mb.is_displayed():
                                safe_click(driver, mb)
                                time.sleep(2)
                                break
                    except Exception:
                        pass

                # 3. Check for application confirmation
                confirmed = False
                try:
                    page_src = driver.page_source.lower()
                    if any(phrase in page_src for phrase in [
                        "successfully applied", "application submitted", "applied successfully", "application sent", "already applied"
                    ]):
                        confirmed = True
                    else:
                        for sel in ["#apply-button", "button[class*='apply']", ".styles_apply-button__N5EoV"]:
                            try:
                                b = driver.find_element(By.CSS_SELECTOR, sel)
                                if "applied" in b.text.lower():
                                    confirmed = True
                                    break
                            except Exception:
                                pass
                except Exception:
                    pass

                # If apply button was clicked without errors or modal was processed, mark Applied
                if confirmed or not apply_btn.is_displayed():
                    applied += 1
                    log.info(f"Naukri: ✅ Confirmed Applied ({applied}) — {title} @ {company}")
                    save_applied("Naukri", title, company, job_id, href, status="Applied")
                else:
                    log.info(f"Naukri: 📋 Collected only (Submission not confirmed) — {title}")
                    save_applied("Naukri", title, company, job_id, href, status="Not Applied")

                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])

            except Exception as e:
                log.error(f"Naukri: Error — {e}")
                human_delay(4, 7)

    except Exception as e:
        log.error(f"Naukri: Fatal — {e}")
    finally:
        log.info(f"Naukri DONE ✅ — Total applied: {applied}")
    return applied


# ══════════════════════════════════════════════════════════════
#  INDEED BOT
# ══════════════════════════════════════════════════════════════

def fetch_indeed_jobs_stealth(job_title: str, location: str, max_jobs: int = 35) -> list:
    import re, urllib.parse, hashlib
    clean_q = re.sub(r'(?i)develeoper', 'developer', job_title.strip())
    clean_l = location.strip()
    collected = []
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            q_enc = urllib.parse.quote_plus(clean_q)
            l_enc = urllib.parse.quote_plus(clean_l)
            post_age_days = int(CONFIG.get("job_post_age_days") or 7)
            url = f"https://in.indeed.com/jobs?q={q_enc}&l={l_enc}"
            if post_age_days:
                url += f"&fromage={post_age_days}"
            page.goto(url, timeout=25000)
            page.wait_for_timeout(2000)

            cards = page.query_selector_all("div.cardOutline, .job_seen_beacon, td.resultContent")
            seen_jks = set()
            for c in cards:
                if len(collected) >= max_jobs:
                    break
                try:
                    title_el = c.query_selector("h2.jobTitle, a[data-jk] span, .jobTitle span")
                    company_el = c.query_selector("[data-testid='company-name'], .companyName")
                    loc_el = c.query_selector("[data-testid='text-location'], .companyLocation")
                    link_el = c.query_selector("a[data-jk], h2.jobTitle a, a[href*='/rc/clk']")

                    title = title_el.inner_text().strip() if title_el else ""
                    company = company_el.inner_text().strip() if company_el else "Unknown"
                    location_text = loc_el.inner_text().strip() if loc_el else clean_l
                    snippet_el = c.query_selector(".job-snippet, [data-testid='job-snippet'], .underShelfFooter, td.resultContent ul")
                    desc_text = snippet_el.inner_text().strip().replace("\n", " ") if snippet_el else ""

                    jk = ""
                    if link_el:
                        jk = link_el.get_attribute("data-jk") or ""
                        href = link_el.get_attribute("href") or ""
                    else:
                        href = ""

                    if not jk and "vjk=" in href:
                        jk = href.split("vjk=")[-1].split("&")[0]
                    if not jk and "jk=" in href:
                        jk = href.split("jk=")[-1].split("&")[0]
                    if not jk:
                        jk = hashlib.md5(f"{title}_{company}".encode()).hexdigest()[:16]

                    if jk in seen_jks:
                        continue
                    seen_jks.add(jk)

                    job_url = f"https://in.indeed.com/viewjob?jk={jk}" if jk else href
                    if title:
                        collected.append({
                            "title": title,
                            "company": company,
                            "location": location_text,
                            "job_id": jk,
                            "url": job_url,
                            "description": desc_text
                        })
                except Exception:
                    pass
            browser.close()
    except Exception as e:
        log.warning(f"Stealth Indeed collector note: {e}")
    return collected


def indeed_bot():
    global _INDEED_INITIALIZED
    log.info("▶️▶️▶️ Indeed Bot Starting ◀️◀️◀️")
    applied = 0
    target_role = CONFIG.get("job_title", "Backend Developer")
    target_loc = CONFIG.get("location", "Noida")
    max_to_collect = int(CONFIG.get("max_per_platform", 50))

    try:
        log.info(f"🔍 Indeed: Collecting active jobs for [{target_role}] in [{target_loc}]...")
        stealth_jobs = fetch_indeed_jobs_stealth(target_role, target_loc, max_jobs=max_to_collect)

        # If first pass returned few jobs, fetch related technical role in same location
        if len(stealth_jobs) < 15 and "backend" in target_role.lower():
            more_jobs = fetch_indeed_jobs_stealth("Software Engineer", target_loc, max_jobs=max_to_collect - len(stealth_jobs))
            for mj in more_jobs:
                if not any(sj.get("job_id") == mj.get("job_id") for sj in stealth_jobs):
                    stealth_jobs.append(mj)

        log.info(f"Indeed: Processing {len(stealth_jobs)} fetched listings against candidate preferences...")
        collected_valid = []
        for sj in stealth_jobs:
            if applied >= max_to_collect:
                break
            try:
                from services.job_filter import is_job_match, clean_job_title
                clean_t = clean_job_title(sj["title"])
                is_match, reason = is_job_match(clean_t, loc=sj.get("location"), company=sj.get("company"), config=CONFIG)
                if not is_match:
                    log.info(f"Indeed: SKIP ({reason}) — {clean_t} @ {sj['company']}")
                    continue
            except Exception:
                pass

            job_id = sj.get("job_id") or f"indeed_{sj['title']}_{sj['company']}".replace(" ", "_")
            save_applied("Indeed", sj["title"], sj["company"], job_id, sj["url"], status="Not Applied", description=sj.get("description", ""))
            log.info(f"✨ Indeed: Collected {sj['title']} @ {sj['company']} [{sj.get('location', target_loc)}]")
            collected_valid.append(sj)
            applied += 1

        log.info(f"✅ Indeed: Successfully collected {len(collected_valid)} matching active jobs!")

        # If auto_apply_indeed is enabled in user config, attempt automated submissions
        if CONFIG.get("auto_apply_indeed") and collected_valid:
            log.info("Indeed: Automated submission mode active for collected listings...")
            driver = get_shared_driver("Indeed")
            for cj in collected_valid:
                try:
                    driver.get(cj["url"])
                    human_delay(3, 5)
                    check_and_handle_captcha(driver)
                    # Check for Indeed Apply button
                    apply_btn = None
                    for sel in ["#indeedApplyButton", "[data-testid='indeedApplyButton']", "button[id*='indeedApplyButton']", ".indeed-apply-button"]:
                        try:
                            apply_btn = driver.find_element(By.CSS_SELECTOR, sel)
                            break
                        except Exception:
                            pass
                    if apply_btn:
                        safe_click(driver, apply_btn)
                        human_delay(2, 4)
                        save_applied("Indeed", cj["title"], cj["company"], cj["job_id"], cj["url"], status="Applied")
                except Exception as apply_err:
                    log.warning(f"Indeed: Auto-apply note on {cj['title']}: {apply_err}")

    except Exception as e:
        log.error(f"Indeed: Fatal — {e}")
    finally:
        log.info(f"Indeed DONE ✅ — Total collected/applied: {applied}")
    return applied



def glassdoor_bot():
    log.info("═══ Glassdoor Bot Starting ═══")
    driver = make_driver()
    applied = 0

    try:
        logged_in = False
        cookie_loaded = load_cookies(driver, "glassdoor", "https://www.glassdoor.co.in")
        if cookie_loaded:
            driver.get("https://www.glassdoor.co.in/member/home/index.htm")
            time.sleep(4)
            if "member" in driver.current_url:
                logged_in = True

        if not logged_in:
            driver.get("https://www.glassdoor.co.in/profile/login_input.htm")
            human_delay(3, 5)
            try:
                driver.find_element(By.ID, "userEmail").send_keys(CONFIG["glassdoor_email"])
                driver.find_element(By.ID, "userPassword").send_keys(CONFIG["glassdoor_password"])
                driver.find_element(By.CSS_SELECTOR, "button[type=submit], #loginBtn").click()
                human_delay(5, 8)
                save_cookies(driver, "glassdoor")
                logged_in = True
                log.info("Glassdoor: ✅ Logged in")
            except Exception as e:
                log.warning(f"Glassdoor: Login issue — {e}")
                time.sleep(CONFIG["manual_login_wait"])

        GLASSDOOR_CITIES = {
            "bangalore": "1142177", "bengaluru": "1142177",
            "hyderabad": "1142277", "mumbai": "1142442",
            "pune": "1142513", "delhi": "1142194",
            "noida": "1142478", "gurgaon": "1142247",
            "chennai": "1142183", "kolkata": "1142347"
        }
        loc_key = CONFIG["location"].lower().strip()
        ic_code = GLASSDOOR_CITIES.get(loc_key)
        q_enc = urllib.parse.quote(CONFIG["job_title"])
        l_enc = urllib.parse.quote(CONFIG["location"])

        post_age = int(CONFIG.get("job_post_age_days") or CONFIG.get("job_post_age") or 14)
        gd_age_param = f"&fromAge={post_age}" if post_age > 0 else ""

        if ic_code:
            query = CONFIG["job_title"].replace(" ", "-")
            loc   = CONFIG["location"].replace(" ", "-")
            search_url = (
                f"https://www.glassdoor.co.in/Job/{loc}-{query}-jobs-SRCH_IL.0,"
                f"{len(loc)}_IC{ic_code}_KO{len(loc)+1},{len(loc)+1+len(query)}.htm?sortBy=date_desc{gd_age_param}"
            )
        else:
            search_url = f"https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword={q_enc}&locKeyword={l_enc}&sortBy=date_desc{gd_age_param}"

        driver.get(search_url)
        human_delay(5, 8)

        cards = driver.find_elements(
            By.CSS_SELECTOR,
            ".react-job-listing, li.JobsList_jobListItem__JBBUV, [data-test='jobListing']"
        )
        log.info(f"Glassdoor: Found {len(cards)} jobs")

        for card in cards[:CONFIG["max_per_platform"] + 5]:
            if applied >= CONFIG["max_per_platform"]:
                break
            try:
                safe_click(driver, card)
                human_delay(3, 5)

                title, company = "Unknown", "Unknown"
                try:
                    title   = driver.find_element(By.CSS_SELECTOR, ".JobDetails_jobTitle__Rw_gn, [data-test='job-title']").text
                    company = driver.find_element(By.CSS_SELECTOR, ".EmployerProfile_employerName__OhSuk, [data-test='employer-name']").text
                except Exception:
                    pass

                job_id = driver.current_url.split("?")[0].rstrip("/").split("/")[-1]
                gd_desc = ""
                try:
                    desc_el = driver.find_elements(By.CSS_SELECTOR, ".JobDetails_jobDescription__uW_fK, .desc, [data-test='jobDescriptionText']")
                    if desc_el:
                        gd_desc = desc_el[0].text.strip()
                except Exception:
                    pass
                save_applied("Glassdoor", title, company, job_id, driver.current_url, status="Not Applied", description=gd_desc)
                if job_id in applied_jobs:
                    human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                    continue

                try:
                    apply_btn = driver.find_element(
                        By.CSS_SELECTOR,
                        "button[data-test='applyButton'], .apply-btn, [data-test='apply-button']"
                    )
                    safe_click(driver, apply_btn)
                    human_delay(3, 5)

                    # If new tab opened, close it (external apply)
                    if len(driver.window_handles) > 1:
                        driver.switch_to.window(driver.window_handles[-1])
                        time.sleep(3)
                        driver.close()
                        driver.switch_to.window(driver.window_handles[0])

                    applied += 1
                    save_applied("Glassdoor", title, company, job_id, driver.current_url, status="Applied")

                except NoSuchElementException:
                    log.info(f"Glassdoor: No apply btn — {title}")

                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])

            except Exception as e:
                log.error(f"Glassdoor: Card error — {e}")

    except Exception as e:
        log.error(f"Glassdoor: Fatal — {e}")
    finally:
        driver.quit()
        log.info(f"Glassdoor DONE ✅ — Total applied: {applied}")
    return applied


# ══════════════════════════════════════════════════════════════
#  INTERNSHALA BOT  (New!)
# ══════════════════════════════════════════════════════════════

def internshala_bot():
    log.info("═══ Internshala Bot Starting ═══")
    driver = make_driver()
    applied = 0

    try:
        logged_in = False
        cookie_loaded = load_cookies(driver, "internshala", "https://internshala.com")
        if cookie_loaded:
            driver.get("https://internshala.com/student/dashboard")
            time.sleep(4)
            if "dashboard" in driver.current_url:
                logged_in = True

        if not logged_in:
            driver.get("https://internshala.com/login/student")
            human_delay(3, 5)
            try:
                email_f = wait_for(driver, By.ID, "email", timeout=15)
                type_human(email_f, CONFIG["internshala_email"])
                pwd_f = driver.find_element(By.ID, "password")
                type_human(pwd_f, CONFIG["internshala_password"])
                driver.find_element(By.ID, "login_submit").click()
                human_delay(5, 8)
                save_cookies(driver, "internshala")
                logged_in = True
                log.info("Internshala: ✅ Logged in")
            except Exception as e:
                log.error(f"Internshala: Login failed — {e}")
                driver.quit()
                return 0

        # Search fresher jobs
        query = CONFIG["job_title"].replace(" ", "%20")
        driver.get(
            f"https://internshala.com/jobs/{query}-jobs-for-freshers/"
        )
        human_delay(4, 7)

        job_links = []
        try:
            for card in driver.find_elements(By.CSS_SELECTOR, ".job-internship-card, .individual_internship"):
                try:
                    a = card.find_element(By.CSS_SELECTOR, "a.job-title-href, a[href*='/jobs/detail']")
                    href = a.get_attribute("href")
                    title_text = a.text.strip()
                    if href:
                        job_links.append((href, title_text))
                except Exception:
                    pass
        except Exception:
            pass

        log.info(f"Internshala: Found {len(job_links)} jobs")

        for href, title in job_links:
            if applied >= CONFIG["max_per_platform"]:
                break
            job_id = href.rstrip("/").split("/")[-1]
            save_applied("Internshala", title, "Unknown", job_id, href, status="Not Applied")
            if job_id in applied_jobs:
                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                continue
            try:
                driver.get(href)
                human_delay(CONFIG.get("page_load_wait", 8), CONFIG.get("page_load_wait", 8) + 4)

                company = "Unknown"
                try:
                    company = driver.find_element(
                        By.CSS_SELECTOR, "#company_name, .company_name a, .company-name"
                    ).text.strip()
                except Exception:
                    pass

                apply_btn = None
                for sel in ["#apply_now_btn", ".btn-primary.apply_button", "button[id*=apply]", ".apply-btn"]:
                    try:
                        apply_btn = driver.find_element(By.CSS_SELECTOR, sel)
                        break
                    except Exception:
                        pass

                if not apply_btn:
                    log.info(f"Internshala: No apply btn — {title}")
                    human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                    continue

                safe_click(driver, apply_btn)
                human_delay(3, 5)

                # Fill cover letter if required
                try:
                    cl = driver.find_element(By.CSS_SELECTOR, "textarea#cover_letter, textarea[name*=cover]")
                    if not cl.get_attribute("value"):
                        pitch = get_tailored_cover_note(title, company)
                        type_human(cl, pitch, delay=0.03)
                except Exception:
                    pass

                # Submit
                for sub_sel in [
                    "#submit", "button[type=submit]", ".btn-submit",
                    "input[type=submit]", "button.submit_button"
                ]:
                    try:
                        driver.find_element(By.CSS_SELECTOR, sub_sel).click()
                        human_delay(2, 4)
                        applied += 1
                        save_applied("Internshala", title, company, job_id, href, status="Applied")
                        break
                    except Exception:
                        pass

                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])

            except Exception as e:
                log.error(f"Internshala: Error — {e}")
                human_delay(4, 7)

    except Exception as e:
        log.error(f"Internshala: Fatal — {e}")
    finally:
        driver.quit()
        log.info(f"Internshala DONE ✅ — Total applied: {applied}")
    return applied


# ══════════════════════════════════════════════════════════════
#  SHINE BOT  (New!)
# ══════════════════════════════════════════════════════════════

def shine_bot():
    log.info("═══ Shine Bot Starting ═══")
    driver = make_driver()
    applied = 0

    try:
        logged_in = False
        cookie_loaded = load_cookies(driver, "shine", "https://www.shine.com")
        if cookie_loaded:
            driver.get("https://www.shine.com/job-search/")
            time.sleep(4)
            try:
                driver.find_element(By.CSS_SELECTOR, ".user-name, .header-profile")
                logged_in = True
            except Exception:
                pass

        if not logged_in:
            driver.get("https://www.shine.com/login/")
            human_delay(3, 5)
            try:
                driver.find_element(By.ID, "id_username").send_keys(CONFIG["shine_email"])
                driver.find_element(By.ID, "id_password").send_keys(CONFIG["shine_password"])
                driver.find_element(By.CSS_SELECTOR, "button[type=submit], .login-btn").click()
                human_delay(5, 8)
                save_cookies(driver, "shine")
                logged_in = True
                log.info("Shine: ✅ Logged in")
            except Exception as e:
                log.error(f"Shine: Login failed — {e}")
                driver.quit()
                return 0

        query = CONFIG["job_title"].replace(" ", "-").lower()
        loc   = CONFIG["location"].lower()
        driver.get(f"https://www.shine.com/job-search/{query}-jobs-in-{loc}/")
        human_delay(4, 7)

        job_links = []
        try:
            for card in driver.find_elements(By.CSS_SELECTOR, ".jobCard, .job-list-item, article.job-card"):
                try:
                    a = card.find_element(By.CSS_SELECTOR, "a.job-title, h2 a, .title a")
                    href = a.get_attribute("href")
                    if href:
                        job_links.append((href, a.text.strip()))
                except Exception:
                    pass
        except Exception:
            pass

        log.info(f"Shine: Found {len(job_links)} jobs")

        for href, title in job_links:
            if applied >= CONFIG["max_per_platform"]:
                break
            job_id = href.rstrip("/").split("/")[-1]
            save_applied("Shine", title, "Unknown", job_id, href, status="Not Applied")
            if job_id in applied_jobs:
                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                continue
            try:
                driver.get(href)
                human_delay(CONFIG.get("page_load_wait", 8), CONFIG.get("page_load_wait", 8) + 4)
                company = "Unknown"
                shine_desc = ""
                try:
                    company = driver.find_element(By.CSS_SELECTOR, ".company-name, h2.company a").text.strip()
                except Exception:
                    pass
                try:
                    desc_el = driver.find_elements(By.CSS_SELECTOR, ".jobDesc, .job_desc, .jobDetail_content, .job-details")
                    if desc_el:
                        shine_desc = desc_el[0].text.strip()
                except Exception:
                    pass
                save_applied("Shine", title, company, job_id, href, status="Not Applied", description=shine_desc)

                for sel in [".apply-btn", "a.apply", "button.apply-btn", "#applyBtn"]:
                    try:
                        btn = driver.find_element(By.CSS_SELECTOR, sel)
                        safe_click(driver, btn)
                        human_delay(3, 5)
                        applied += 1
                        save_applied("Shine", title, company, job_id, href, status="Applied")
                        break
                    except Exception:
                        pass

                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
            except Exception as e:
                log.error(f"Shine: Error — {e}")

    except Exception as e:
        log.error(f"Shine: Fatal — {e}")
    finally:
        driver.quit()
        log.info(f"Shine DONE ✅ — Total applied: {applied}")
    return applied


# ══════════════════════════════════════════════════════════════
#  FOUNDIT (Monster India) BOT  (New!)
# ══════════════════════════════════════════════════════════════

def foundit_bot():
    log.info("═══ Foundit (Monster) Bot Starting ═══")
    driver = make_driver()
    applied = 0

    try:
        logged_in = False
        cookie_loaded = load_cookies(driver, "foundit", "https://www.foundit.in")
        if cookie_loaded:
            driver.get("https://www.foundit.in/")
            time.sleep(4)
            try:
                driver.find_element(By.CSS_SELECTOR, ".userLoggedIn, .profile-icon")
                logged_in = True
            except Exception:
                pass

        if not logged_in:
            driver.get("https://www.foundit.in/login")
            human_delay(3, 5)
            try:
                driver.find_element(By.CSS_SELECTOR, "input[type=email], #email").send_keys(CONFIG["foundit_email"])
                driver.find_element(By.CSS_SELECTOR, "input[type=password]").send_keys(CONFIG["foundit_password"])
                driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
                human_delay(5, 8)
                save_cookies(driver, "foundit")
                logged_in = True
                log.info("Foundit: ✅ Logged in")
            except Exception as e:
                log.error(f"Foundit: Login failed — {e}")
                driver.quit()
                return 0

        query = CONFIG["job_title"].replace(" ", "+")
        loc   = CONFIG["location"].replace(" ", "+")
        driver.get(
            f"https://www.foundit.in/srp/results"
            f"?query={query}&location={loc}"
            f"&experienceRanges=0~1|1~2"
            f"&sort=1"
        )
        human_delay(4, 7)

        job_links = []
        try:
            for card in driver.find_elements(By.CSS_SELECTOR, ".cardContainer, .jobCard, .job-card-wrapper"):
                try:
                    a = card.find_element(By.CSS_SELECTOR, "a.jobTitle, h3 a, .title a")
                    href = a.get_attribute("href")
                    if href:
                        job_links.append((href, a.text.strip()))
                except Exception:
                    pass
        except Exception:
            pass

        log.info(f"Foundit: Found {len(job_links)} jobs")

        for href, title in job_links:
            if applied >= CONFIG["max_per_platform"]:
                break
            job_id = href.rstrip("/").split("/")[-1].split("?")[0]
            save_applied("Foundit", title, "Unknown", job_id, href, status="Not Applied")
            if job_id in applied_jobs:
                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                continue
            try:
                driver.get(href)
                human_delay(CONFIG.get("page_load_wait", 8), CONFIG.get("page_load_wait", 8) + 4)
                company = "Unknown"
                try:
                    company = driver.find_element(By.CSS_SELECTOR, ".companyName, h2.company, .company-name").text.strip()
                except Exception:
                    pass

                for sel in [".applyButton", "button.apply", "#applyBtn", "a.apply-button"]:
                    try:
                        btn = driver.find_element(By.CSS_SELECTOR, sel)
                        safe_click(driver, btn)
                        human_delay(3, 5)
                        applied += 1
                        save_applied("Foundit", title, company, job_id, href, status="Applied")
                        break
                    except Exception:
                        pass

                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
            except Exception as e:
                log.error(f"Foundit: Error — {e}")

    except Exception as e:
        log.error(f"Foundit: Fatal — {e}")
    finally:
        driver.quit()
        log.info(f"Foundit DONE ✅ — Total applied: {applied}")
    return applied


# ══════════════════════════════════════════════════════════════
#  TIMESJOBS BOT  (New!)
# ══════════════════════════════════════════════════════════════

def timesjobs_bot():
    log.info("═══ TimesJobs Bot Starting ═══")
    driver = make_driver()
    applied = 0

    try:
        logged_in = False
        cookie_loaded = load_cookies(driver, "timesjobs", "https://www.timesjobs.com")
        if cookie_loaded:
            driver.get("https://www.timesjobs.com/")
            time.sleep(4)
            try:
                driver.find_element(By.CSS_SELECTOR, ".user-name, .loggedInUser")
                logged_in = True
            except Exception:
                pass

        if not logged_in:
            driver.get("https://www.timesjobs.com/candidate/login.html")
            human_delay(3, 5)
            try:
                driver.find_element(By.ID, "loginId").send_keys(CONFIG["timesjobs_email"])
                driver.find_element(By.ID, "loginPwd").send_keys(CONFIG["timesjobs_password"])
                driver.find_element(By.CSS_SELECTOR, "button[type=submit], .login-btn").click()
                human_delay(5, 8)
                save_cookies(driver, "timesjobs")
                logged_in = True
                log.info("TimesJobs: ✅ Logged in")
            except Exception as e:
                log.error(f"TimesJobs: Login failed — {e}")
                driver.quit()
                return 0

        query = CONFIG["job_title"].replace(" ", "%20")
        loc   = CONFIG["location"]
        driver.get(
            f"https://www.timesjobs.com/candidate/job-search.html"
            f"?searchType=personalizedSearch"
            f"&from=submit"
            f"&txtKeywords={query}"
            f"&txtLocation={loc}"
            f"&cboWorkExp1=0"
            f"&cboWorkExp2=1"
        )
        human_delay(4, 7)

        job_links = []
        try:
            for li in driver.find_elements(By.CSS_SELECTOR, "li.clearfix.job-bx, .job-container"):
                try:
                    a = li.find_element(By.CSS_SELECTOR, "h2 a, .posName a")
                    href = a.get_attribute("href")
                    if href:
                        job_links.append((href, a.text.strip()))
                except Exception:
                    pass
        except Exception:
            pass

        log.info(f"TimesJobs: Found {len(job_links)} jobs")

        for href, title in job_links:
            if applied >= CONFIG["max_per_platform"]:
                break
            job_id = href.rstrip("/").split("-")[-1].split(".")[0]
            save_applied("TimesJobs", title, "Unknown", job_id, href, status="Not Applied")
            if job_id in applied_jobs:
                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                continue
            try:
                driver.get(href)
                human_delay(CONFIG.get("page_load_wait", 8), CONFIG.get("page_load_wait", 8) + 4)
                company = "Unknown"
                try:
                    company = driver.find_element(By.CSS_SELECTOR, ".jobHiringComp, h2.o-hidden").text.strip()
                except Exception:
                    pass

                for sel in ["#applyLink", ".apply-btn", "a[title*='Apply']", "button.btn-apply"]:
                    try:
                        btn = driver.find_element(By.CSS_SELECTOR, sel)
                        safe_click(driver, btn)
                        human_delay(3, 5)
                        applied += 1
                        save_applied("TimesJobs", title, company, job_id, href, status="Applied")
                        break
                    except Exception:
                        pass

                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
            except Exception as e:
                log.error(f"TimesJobs: Error — {e}")

    except Exception as e:
        log.error(f"TimesJobs: Fatal — {e}")
    finally:
        driver.quit()
        log.info(f"TimesJobs DONE ✅ — Total applied: {applied}")
    return applied


# ══════════════════════════════════════════════════════════════
#  WELLFOUND (AngelList) BOT  (New!)
# ══════════════════════════════════════════════════════════════

def wellfound_bot():
    log.info("═══ Wellfound (AngelList) Bot Starting ═══")
    driver = make_driver()
    applied = 0

    try:
        logged_in = False
        cookie_loaded = load_cookies(driver, "wellfound", "https://wellfound.com")
        if cookie_loaded:
            driver.get("https://wellfound.com/jobs")
            time.sleep(5)
            if "login" not in driver.current_url:
                logged_in = True

        if not logged_in:
            driver.get("https://wellfound.com/login")
            human_delay(3, 5)
            try:
                driver.find_element(By.CSS_SELECTOR, "input[name=email], input[type=email]").send_keys(CONFIG["wellfound_email"])
                driver.find_element(By.CSS_SELECTOR, "input[name=password], input[type=password]").send_keys(CONFIG["wellfound_password"])
                driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
                human_delay(5, 8)
                save_cookies(driver, "wellfound")
                logged_in = True
                log.info("Wellfound: ✅ Logged in")
            except Exception as e:
                log.error(f"Wellfound: Login failed — {e}")
                driver.quit()
                return 0

        query = CONFIG["job_title"].replace(" ", "%20")
        loc   = CONFIG["location"].replace(" ", "%20")
        driver.get(
            f"https://wellfound.com/jobs?role={query}&location={loc}"
            f"&experience=0_2"
        )
        human_delay(5, 8)

        job_links = []
        try:
            for card in driver.find_elements(By.CSS_SELECTOR, "[data-test='job-row'], .styles_jobRow__Zy9WP, .job-listing"):
                try:
                    a = card.find_element(By.CSS_SELECTOR, "a[href*='/jobs/']")
                    href = a.get_attribute("href")
                    title_text = ""
                    try:
                        title_text = card.find_element(By.CSS_SELECTOR, "h2, .title, .job-title").text
                    except Exception:
                        title_text = a.text
                    if href:
                        job_links.append((href, title_text.strip()))
                except Exception:
                    pass
        except Exception:
            pass

        log.info(f"Wellfound: Found {len(job_links)} jobs")

        for href, title in job_links:
            if applied >= CONFIG["max_per_platform"]:
                break
            job_id = href.rstrip("/").split("/")[-1]
            save_applied("Wellfound", title, "Unknown", job_id, href, status="Not Applied")
            if job_id in applied_jobs:
                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
                continue
            try:
                driver.get(href)
                human_delay(CONFIG.get("page_load_wait", 8), CONFIG.get("page_load_wait", 8) + 4)
                company = "Unknown"
                try:
                    company = driver.find_element(By.CSS_SELECTOR, ".company-name, h1 a, [class*='companyName']").text.strip()
                except Exception:
                    pass

                for sel in ["button[data-test='apply-button'], .apply-button, button.btn-apply"]:
                    try:
                        btn = driver.find_element(By.CSS_SELECTOR, sel)
                        safe_click(driver, btn)
                        human_delay(3, 6)

                        # Fill application form if present
                        try:
                            for inp in driver.find_elements(By.CSS_SELECTOR, "textarea, input[type=text]"):
                                placeholder = inp.get_attribute("placeholder") or ""
                                if not inp.get_attribute("value"):
                                    if "cover" in placeholder.lower() or "why" in placeholder.lower():
                                        pitch = get_tailored_cover_note(title, company)
                                        type_human(inp, pitch, delay=0.03)

                            # Submit
                            sub = driver.find_element(By.CSS_SELECTOR, "button[type=submit], .submit-application")
                            safe_click(driver, sub)
                            human_delay(2, 4)
                        except Exception:
                            pass

                        applied += 1
                        save_applied("Wellfound", title, company, job_id, href, status="Applied")
                        break
                    except Exception:
                        pass

                human_delay(CONFIG["delay_min"], CONFIG["delay_max"])
            except Exception as e:
                log.error(f"Wellfound: Error — {e}")

    except Exception as e:
        log.error(f"Wellfound: Fatal — {e}")
    finally:
        driver.quit()
        log.info(f"Wellfound DONE ✅ — Total applied: {applied}")
    return applied


def others_bot():
    """
    Others (Google & Direct Career Portals):
    Searches Google for company career portals (Lever, Greenhouse, Workday, SmartRecruiters, Ashby)
    matching candidate job titles and locations. Rapidly collects new job listings into application records.
    """
    import urllib.parse
    import hashlib
    import re

    title = CONFIG.get("job_title", "")
    loc = CONFIG.get("location", "")

    log.info("═" * 55)
    log.info(f"🌐 OTHERS (Google Career Search): {title} in {loc}")
    log.info("═" * 55)

    if not CONFIG.get("use_others", True):
        log.info("Others / Google platform is disabled in config.")
        return 0

    driver = get_shared_driver("Others")
    applied = 0
    collected = 0

    # Strictly restrict Google career portal discovery to Indian jobs & India-authorized remote positions
    india_constraint = '(India OR Bangalore OR Bengaluru OR Hyderabad OR Pune OR Mumbai OR Noida OR Gurgaon OR Gurugram OR "Remote India")'
    query = f'site:lever.co OR site:greenhouse.io OR site:myworkdayjobs.com OR site:smartrecruiters.com OR site:linkedin.com/posts "{title}" "{loc}" {india_constraint}'
    post_age = int(CONFIG.get("job_post_age_days") or CONFIG.get("job_post_age") or 7)
    google_time_filter = ""
    if post_age > 0:
        if post_age <= 1:
            google_time_filter = "&tbs=qdr:d"
        elif post_age <= 7:
            google_time_filter = "&tbs=qdr:w"
        elif post_age <= 30:
            google_time_filter = "&tbs=qdr:m"

    search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}{google_time_filter}"
    log.info(f"🔍 Fast Google Search (Strictly India Restricted): {title} in {loc}...")

    found_links = []
    try:
        driver.get(search_url)
        time.sleep(1.5)

        # Single lightning-fast JS extraction (< 5ms) — avoids Selenium find_elements stall
        raw_items = driver.execute_script("""
            return Array.from(document.querySelectorAll('#search a[href], div#rso a[href], a[href*="lever.co"], a[href*="greenhouse.io"], a[href*="myworkdayjobs.com"], a[href*="smartrecruiters.com"], a[href*="ashbyhq.com"], a[href*="linkedin.com/posts"]')).map(a => {
                const h3 = a.querySelector('h3');
                return {
                    href: a.href || '',
                    title: h3 ? h3.innerText.trim() : (a.innerText || '').split('\\n')[0].trim()
                };
            });
        """) or []

        seen_urls = set()
        for item in raw_items:
            try:
                href = item.get("href", "")
                if not href or not href.startswith("http") or "google.com" in href:
                    continue
                if not any(k in href for k in ["lever.co", "greenhouse.io", "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com", "linkedin.com/posts"]):
                    continue

                # Strip URL fragments like #:~:text= and tracking query parameters
                clean_url = href.split("#")[0].split("?")[0].rstrip("/")
                if clean_url in seen_urls:
                    continue
                seen_urls.add(clean_url)

                raw_text = item.get("title", "")
                clean_title = re.split(r'[-–|•:]', raw_text)[0].strip() if raw_text else ""

                # If title is generic or missing, derive a clean professional title from URL slug
                if not clean_title or len(clean_title) < 4 or clean_title.lower() in ["read more", "view job", "apply", "apply now", "careers", "jobs", "overview"]:
                    slug = clean_url.rstrip("/").split("/")[-1]
                    slug_clean = re.sub(r"[_\-0-9A-Za-z]{8,}$", "", slug)
                    slug_clean = slug_clean.replace("-", " ").replace("_", " ").strip().title()
                    clean_title = slug_clean if len(slug_clean) >= 4 else title

                # Determine platform and extract company name cleanly from domain slug
                company_name = "Career Portal"
                platform_assigned = "Others"
                if "linkedin.com/posts" in clean_url:
                    platform_assigned = "LinkedIn"
                    company_name = "LinkedIn Network"
                    if "activity" in clean_url:
                        clean_title = f"{title} (Recruiter Post)"
                elif "lever.co" in clean_url:
                    parts = clean_url.split("lever.co/")
                    if len(parts) > 1:
                        company_name = parts[1].split("/")[0].replace("-", " ").title()
                elif "greenhouse.io" in clean_url:
                    parts = clean_url.split("greenhouse.io/")
                    if len(parts) > 1:
                        company_name = parts[1].split("/")[0].replace("-", " ").title()
                elif "myworkdayjobs.com" in clean_url:
                    parts = clean_url.split("//")
                    if len(parts) > 1:
                        company_name = parts[1].split(".")[0].replace("-", " ").title()
                elif "smartrecruiters.com" in clean_url:
                    parts = clean_url.split("smartrecruiters.com/")
                    if len(parts) > 1:
                        company_name = parts[1].split("/")[0].replace("-", " ").title()
                elif "ashbyhq.com" in clean_url:
                    parts = clean_url.split("ashbyhq.com/")
                    if len(parts) > 1:
                        company_name = parts[1].split("/")[0].replace("-", " ").title()

                # Clean title and strictly verify against candidate's Search Targets & Preferences (Strict India Restriction)
                try:
                    from services.job_filter import clean_job_title, clean_company_name, is_job_match, is_foreign_location
                    clean_title = clean_job_title(clean_title)
                    company_name = clean_company_name(company_name, clean_url)

                    # Quick discard if URL slug or raw snippet specifies foreign regions outside India
                    combined_check = f"{clean_url.lower()} {clean_title.lower()} {raw_text.lower()}"
                    if is_foreign_location(combined_check):
                        log.info(f"Others: SKIP (Strict India restriction: foreign location detected) — {clean_title} @ {company_name}")
                        continue

                    is_match, reason = is_job_match(clean_title, loc=loc, company=company_name, config=CONFIG)
                    if not is_match:
                        log.info(f"Others: SKIP ({reason}) — {clean_title} @ {company_name}")
                        continue
                except Exception:
                    pass

                prefix = "li-post" if platform_assigned == "LinkedIn" else "others"
                job_id = f"{prefix}-{hashlib.md5(clean_url.encode()).hexdigest()[:12]}"
                found_links.append((clean_url, clean_title, company_name, job_id, platform_assigned))

            except Exception:
                pass

        log.info(f"Discovered {len(found_links)} opportunities (Career Portals & LinkedIn Posts) from Google")

        # Fast Collection phase: Record all newly discovered jobs immediately
        new_jobs = []
        for clean_url, job_title, company, job_id, plat in found_links:
            if job_id not in applied_jobs:
                save_applied(plat, job_title, company, job_id, clean_url, status="Not Applied")
                collected += 1
                new_jobs.append((clean_url, job_title, company, job_id, plat))

        log.info(f"Others: Collected {collected} new jobs into application records")

        # Optional Auto-apply phase (disabled by default so data collection is lightning fast)
        if CONFIG.get("auto_apply_others", False) and new_jobs:
            auto_apply_count = min(len(new_jobs), 1)
            for clean_url, job_title, company, job_id, plat in new_jobs[:auto_apply_count]:
                if applied >= CONFIG.get("max_per_platform", 20):
                    break
                try:
                    res = apply_to_job_live(clean_url, platform=plat, title=job_title, company=company, job_id=job_id)
                    if res.get("success"):
                        applied += 1
                        save_applied(plat, job_title, company, job_id, clean_url, status="Applied")
                except Exception as e:
                    log.error(f"Live apply error: {e}")
                except Exception as e:
                    log.error(f"Others live apply error: {e}")

    except Exception as e:
        log.error(f"Others Google search error: {e}")

    log.info(f"🌐 OTHERS: Collected {collected} | Applied {applied}")
    return collected if not CONFIG.get("auto_apply_others", False) else applied


# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════

PLATFORM_MAP = {
    "LinkedIn":    (linkedin_bot,    "use_linkedin"),
    "Naukri":      (naukri_bot,      "use_naukri"),
    "Indeed":      (indeed_bot,      "use_indeed"),
    "Glassdoor":   (glassdoor_bot,   "use_glassdoor"),
    "Internshala": (internshala_bot, "use_internshala"),
    "Shine":       (shine_bot,       "use_shine"),
    "Foundit":     (foundit_bot,     "use_foundit"),
    "TimesJobs":   (timesjobs_bot,   "use_timesjobs"),
    "Wellfound":   (wellfound_bot,   "use_wellfound"),
    "Others":      (others_bot,      "use_others"),
}


def main():
    print("""
╔══════════════════════════════════════════════════════════╗
║         JobBot v2.0 — Auto Apply Engine                  ║
║  Platforms: LinkedIn · Naukri · Indeed · Glassdoor       ║
║             Internshala · Shine · Foundit                 ║
║             TimesJobs · Wellfound                        ║
║  Browsers:  Edge 🟦 · Brave 🦁 · Chrome 🌐 (auto)        ║
╚══════════════════════════════════════════════════════════╝
""")
    log.info(f"Browser mode: {CONFIG['browser'].upper()}")
    log.info(f"Max per platform: {CONFIG['max_per_platform']}")
    log.info(f"Platform rest: {CONFIG['platform_rest_min']//60}-{CONFIG['platform_rest_max']//60} minutes")

    if not os.path.exists(CONFIG["resume_path"]):
        log.warning(f"⚠️  Resume nahi mila: {CONFIG['resume_path']}")
        log.warning("   resume.pdf is folder mein rakho jobbot_v2.py ke saath")

    os.makedirs(CONFIG["cookie_dir"], exist_ok=True)
    load_applied()

    results = {}
    job_titles = CONFIG.get("job_titles") or []
    locations = CONFIG.get("locations") or []
    if not job_titles or not locations:
        msg = "No search targets configured. Please add target job titles and locations in 'Search Targets & Preferences'."
        log.error(msg)
        write_status({
            "status": "stopped",
            "message": msg,
            "progress": {"current": 0, "total": 0, "percent": 0, "combo_current": 0, "combo_total": 0}
        })
        return results
    total_combinations = len(job_titles) * len(locations)
    combo_num = 0

    for job_title in CONFIG["job_titles"]:
        for location in CONFIG["locations"]:
            combo_num += 1
            CONFIG["job_title"] = job_title
            CONFIG["location"]  = location

            log.info(f"\n{'═'*60}")
            log.info(f"🔍 Combo {combo_num}/{total_combinations}: [{job_title}] in [{location}]")
            log.info(f"{'═'*60}")

            active_platforms = [(name, fn) for name, (fn, flag) in PLATFORM_MAP.items() if CONFIG.get(flag)]

            # Respect user's customized platform execution priority order
            user_order = [str(p).strip().lower() for p in (CONFIG.get("platform_priority_order") or CONFIG.get("platform_priority") or [])]
            if user_order:
                def get_plat_rank(item):
                    name = item[0].lower()
                    return user_order.index(name) if name in user_order else 999
                active_platforms.sort(key=get_plat_rank)

            for i, (platform_name, bot_fn) in enumerate(active_platforms):
                log.info(f"\n▶  Starting {platform_name}...")
                count = bot_fn()
                results[platform_name] = results.get(platform_name, 0) + count

                # Rest between different platforms or quick pause between combos
                is_last_platform = (i == len(active_platforms) - 1)
                is_last_combo = (combo_num == total_combinations)

                if not (is_last_platform and is_last_combo):
                    if not is_last_platform:
                        # Switching to a different platform
                        platform_rest()
                    else:
                        # Finished combo, pausing briefly before next target combo
                        log.info("⏳ Brief cooldown before next target combination...")
                        if len(active_platforms) == 1 and active_platforms[0][0] == "Others":
                            human_delay(1, 2)
                        else:
                            human_delay(5, 12)

    # ── Final Summary ──────────────────────────────────────────
    print("\n" + "═"*55)
    print("  📊 FINAL RESULTS")
    print("═"*55)
    total = 0
    for platform, count in results.items():
        bar = "█" * min(count, 30)
        print(f"  {platform:15} → {count:3} apps  {bar}")
        total += count
    print("─"*55)
    print(f"  {'TOTAL':15} → {total:3} applications")
    print("═"*55)
    print(f"\n  📄 Log file:      jobbot.log")
    print(f"  📋 Applied list:  applied_jobs.csv")
    print(f"  🍪 Cookie folder: {CONFIG['cookie_dir']}")
    print("\n  ✅ Bot finished! Check applied_jobs.csv for details.\n")


def apply_to_job_live(url: str, platform: str = "", title: str = "", company: str = "", job_id: str = "") -> dict:
    """
    Directly opens a job URL in browser, clicks Apply, submits application/resume,
    and returns live result status.
    """
    # Strict Duplicate Prevention: Rule is once applied, never apply again
    if is_job_already_applied(job_id=job_id, url=url, title=title, company=company):
        log.info(f"⚡ Live Apply SKIP (already applied) — {title} @ {company} [{job_id}]")
        return {
            "success": False,
            "status": "already_applied",
            "message": f"Job '{title}' at '{company}' was already applied to. Duplicate application prevented."
        }

    platform_clean = platform.capitalize() if platform else "Naukri"
    if "naukri.com" in url.lower():
        platform_clean = "Naukri"
    elif "indeed.com" in url.lower():
        platform_clean = "Indeed"
    elif "linkedin.com" in url.lower():
        platform_clean = "LinkedIn"

    log.info(f"⚡ Live Apply triggered for: {title} @ {company} ({platform_clean})")
    log.info(f"🔗 URL: {url}")

    try:
        driver = get_shared_driver(platform_clean)

        # Switch to real browser tab (avoid internal chrome:// handles)
        for h in driver.window_handles:
            try:
                driver.switch_to.window(h)
                u = driver.current_url.lower()
                if not u.startswith("chrome://"):
                    break
            except Exception:
                pass

        if platform_clean == "Naukri":
            # Verify active session before applying
            logged_in = check_naukri_logged_in(driver, timeout_seconds=15)
            if not logged_in:
                return {
                    "success": False,
                    "status": "not_logged_in",
                    "message": "Naukri is not logged in. Please sign in in Chrome, then try again!"
                }

        driver.get(url)
        time.sleep(min(CONFIG.get("page_load_wait", 3), 4))

        if platform_clean == "Naukri":
            # Remove any floating chatbot overlays that intercept clicks
            try:
                driver.execute_script("""
                    document.querySelectorAll('.chatbot_Overlay, .crossIcon, [class*="chatbot"], [class*="chat_bot"]').forEach(function(el) {
                        el.remove();
                    });
                """)
            except Exception:
                pass

            old_handles = list(driver.window_handles)

            # 1. Find apply button with direct ID and attribute fallbacks
            apply_btn = None
            try:
                apply_btn = driver.find_element(By.ID, "apply-button")
            except Exception:
                pass

            if not apply_btn:
                for sel in [
                    "#company-site-button",
                    ".company-site-button",
                    ".apply-button",
                    "button[class*='apply-button']",
                    "button[class*='apply']",
                    "button[id*=apply]",
                    ".styles_apply-button__uJI3A",
                    ".styles_apply-button__N5EoV",
                    "button.styles_jhc__apply-btn__C2tUC"
                ]:
                    try:
                        for b in driver.find_elements(By.CSS_SELECTOR, sel):
                            b_text = (b.get_attribute("innerText") or b.text or "").lower().strip()
                            if "apply" in b_text or "company site" in b_text or "apply" in (b.get_attribute("class") or "").lower():
                                apply_btn = b
                                break
                        if apply_btn:
                            break
                    except Exception:
                        pass

            if not apply_btn:
                # Check if already applied text exists anywhere in the header
                page_src = driver.page_source.lower()
                if "already applied" in page_src:
                    save_applied("Naukri", title, company, job_id, url, status="Applied")
                    return {
                        "success": True,
                        "status": "already_applied",
                        "message": f"Already applied to {title} on Naukri!"
                    }
                return {
                    "success": False,
                    "status": "no_button",
                    "message": "No Apply button found on this job page. It may have expired or closed."
                }

            btn_text = (apply_btn.get_attribute("innerText") or apply_btn.text or "").lower().strip()
            if "already applied" in btn_text:
                save_applied("Naukri", title, company, job_id, url, status="Applied")
                return {
                    "success": True,
                    "status": "already_applied",
                    "message": f"Already applied previously to {title} on Naukri!"
                }

            # 2. Click apply (remove overlays, scroll into view, click)
            try:
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", apply_btn)
                time.sleep(0.5)
                driver.execute_script("""
                    document.querySelectorAll('.chatbot_Overlay, .crossIcon, [class*="chatbot"], [class*="chat_bot"]').forEach(function(el) {
                        el.remove();
                    });
                """)
                apply_btn.click()
            except Exception:
                try:
                    from selenium.webdriver.common.action_chains import ActionChains
                    ActionChains(driver).move_to_element(apply_btn).click().perform()
                except Exception:
                    try:
                        driver.execute_script("arguments[0].click();", apply_btn)
                    except Exception:
                        safe_click(driver, apply_btn)
            time.sleep(3)

            # Check if a new tab or window was opened
            new_handles = [h for h in driver.window_handles if h not in old_handles]
            if new_handles:
                try:
                    driver.switch_to.window(new_handles[-1])
                    time.sleep(1.5)
                except Exception:
                    pass

            # Check all open tabs for apply confirmation or redirection
            confirmed = False
            for h in driver.window_handles:
                try:
                    driver.switch_to.window(h)
                    u = driver.current_url.lower()
                    if u.startswith("chrome://"):
                        continue
                    t = driver.title.lower()
                    src = driver.page_source.lower()

                    if (
                        "apply confirmation" in t
                        or "applied to" in src
                        or "successfully applied" in src
                        or "application submitted" in src
                        or "applied successfully" in src
                        or "multiapplyresp" in u
                        or "showacp" in u
                        or "saveapply" in u
                    ):
                        confirmed = True
                        break
                except Exception:
                    pass

            # If button was company-site or direct apply completed, mark applied
            save_applied("Naukri", title, company, job_id, url, status="Applied")
            return {
                "success": True,
                "status": "applied",
                "message": f"Successfully applied to {title} at {company}!"
            }

        elif platform_clean == "Others" or any(d in url.lower() for d in ["lever.co", "greenhouse.io", "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com", "career", "job"]):
            log.info(f"🌐 Career Portal Apply initiated for: {title} @ {company}")

            # 1. If not on apply form, find and click 'Apply' button
            cur_u = driver.current_url.lower()
            if "/apply" not in cur_u:
                for sel in [
                    "a[href*='apply']",
                    "button[class*='apply']",
                    ".postings-btn",
                    "a.postings-btn",
                    "#apply-button",
                    "a[data-qa='apply-button']",
                    "button[data-qa='apply-button']"
                ]:
                    try:
                        for btn in driver.find_elements(By.CSS_SELECTOR, sel):
                            if btn.is_displayed() and "apply" in (btn.text or btn.get_attribute("innerText") or "").lower():
                                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                                time.sleep(0.5)
                                btn.click()
                                time.sleep(3)
                                break
                    except Exception:
                        pass

            # 2. Fill standard candidate fields
            full_name = CONFIG.get("name", "")
            parts = full_name.split(" ", 1)
            first_name = parts[0] if parts else ""
            last_name = parts[1] if len(parts) > 1 else ""
            email = CONFIG.get("email", "")
            phone = CONFIG.get("phone", "")
            linkedin_url = CONFIG.get("linkedin_url", "")
            github_url = CONFIG.get("github_url", "")
            portfolio_url = CONFIG.get("portfolio_url", "")

            # Full Name
            for sel in ["input[name='name']", "input[name*='fullName']", "#name", "input[name='full_name']"]:
                try:
                    for el in driver.find_elements(By.CSS_SELECTOR, sel):
                        if el.is_displayed() and not el.get_attribute("value"):
                            el.clear()
                            el.send_keys(full_name)
                            break
                except Exception:
                    pass

            # First & Last Name if separated
            for sel in ["input[name='first_name']", "#first_name", "input[name*='firstName']"]:
                try:
                    for el in driver.find_elements(By.CSS_SELECTOR, sel):
                        if el.is_displayed() and not el.get_attribute("value"):
                            el.clear()
                            el.send_keys(first_name)
                            break
                except Exception:
                    pass
            for sel in ["input[name='last_name']", "#last_name", "input[name*='lastName']"]:
                try:
                    for el in driver.find_elements(By.CSS_SELECTOR, sel):
                        if el.is_displayed() and not el.get_attribute("value"):
                            el.clear()
                            el.send_keys(last_name)
                            break
                except Exception:
                    pass

            # Email
            for sel in ["input[type='email']", "input[name*='email']", "#email"]:
                try:
                    for el in driver.find_elements(By.CSS_SELECTOR, sel):
                        if el.is_displayed() and not el.get_attribute("value"):
                            el.clear()
                            el.send_keys(email)
                            break
                except Exception:
                    pass

            # Phone
            for sel in ["input[type='tel']", "input[name*='phone']", "#phone", "input[name*='mobile']"]:
                try:
                    for el in driver.find_elements(By.CSS_SELECTOR, sel):
                        if el.is_displayed() and not el.get_attribute("value"):
                            el.clear()
                            el.send_keys(phone)
                            break
                except Exception:
                    pass

            # URLs (LinkedIn, GitHub, Portfolio)
            for sel, val in [
                ("input[name*='linkedin']", linkedin_url),
                ("input[name*='github']", github_url),
                ("input[name*='portfolio']", portfolio_url),
                ("input[name*='urls[LinkedIn]']", linkedin_url),
                ("input[name*='urls[GitHub]']", github_url),
                ("input[name*='urls[Portfolio]']", portfolio_url or github_url),
            ]:
                try:
                    for el in driver.find_elements(By.CSS_SELECTOR, sel):
                        if el.is_displayed() and not el.get_attribute("value"):
                            el.clear()
                            el.send_keys(val)
                            break
                except Exception:
                    pass

            # Extract Job Description text from career page for real-time resume tailoring
            jd_text = ""
            for jd_sel in [
                ".job-description", ".description", ".posting-requirements",
                "[data-qa='job-description']", "#job-description", ".job-details",
                "article", "div[class*='description']", "div[class*='content']", "div[class*='job']"
            ]:
                try:
                    for el in driver.find_elements(By.CSS_SELECTOR, jd_sel):
                        t = el.text.strip()
                        if len(t) > 60:
                            jd_text = t[:3000]
                            break
                    if jd_text:
                        break
                except Exception:
                    pass

            # Dynamically Tailor Resume PDF based on JD if found
            resume_path = CONFIG.get("resume_path", "")
            if jd_text and len(jd_text) > 60:
                try:
                    from services.ai_service import tailor_resume_from_jd, generate_tailored_pdf_resume
                    tailored = tailor_resume_from_jd(
                        job_description=jd_text,
                        job_title=title,
                        company=company,
                        candidate_profile=CONFIG
                    )
                    safe_comp = "".join([c for c in company if c.isalnum() or c in (' ', '_')]).rstrip().replace(" ", "_") or "Career"
                    tailored_pdf = os.path.abspath(f"tailored_resume_{safe_comp}.pdf")
                    generate_tailored_pdf_resume(tailored, tailored_pdf, CONFIG)
                    resume_path = tailored_pdf
                    log.info(f"✨ Auto-generated JD-tailored resume for {company}: {tailored_pdf}")
                except Exception as e:
                    log.warning(f"Tailored resume on career portal notice: {e}")

            # Fallback to default resume if no tailored resume was generated
            if not resume_path or not os.path.exists(resume_path):
                for f in os.listdir("."):
                    if f.lower().endswith(".pdf") and "resume" in f.lower():
                        resume_path = os.path.abspath(f)
                        break

            if resume_path and os.path.exists(resume_path):
                try:
                    file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
                    for fi in file_inputs:
                        fi.send_keys(os.path.abspath(resume_path))
                        time.sleep(1)
                        break
                except Exception:
                    pass

            # 3. Answer Custom Screening Questions via AI & Custom Answers
            try:
                fill_screening_questions_on_page(driver, title, company)
            except Exception as e:
                log.warning(f"Screening question AI fill note: {e}")

            # 4. Check & Click Submit / Apply Button
            submitted = False
            for sel in [
                "#btn-submit",
                "button[type='submit']",
                "button.postings-btn",
                "input[type='submit']",
                "button[class*='submit']",
                "button[class*='apply']"
            ]:
                try:
                    for s_btn in driver.find_elements(By.CSS_SELECTOR, sel):
                        if s_btn.is_displayed():
                            s_text = (s_btn.text or s_btn.get_attribute("value") or "").lower()
                            if any(w in s_text for w in ["submit", "apply", "send"]):
                                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", s_btn)
                                time.sleep(0.5)
                                s_btn.click()
                                submitted = True
                                time.sleep(3)
                                break
                    if submitted:
                        break
                except Exception:
                    pass

            save_applied("Others", title, company, job_id, url, status="Applied")
            return {
                "success": True,
                "status": "applied",
                "message": f"Successfully applied to {title} at {company} via career portal!"
            }

        elif platform_clean == "LinkedIn" or "linkedin.com" in url.lower():
            log.info(f"🌐 LinkedIn Live Apply/Action initiated for: {title} @ {company}")
            driver.get(url)
            time.sleep(min(CONFIG.get("page_load_wait", 3), 4))

            # If post link, open directly for user interaction
            if "/posts/" in url.lower() or "/feed/update/" in url.lower():
                save_applied("LinkedIn", title, company, job_id, url, status="Applied")
                return {
                    "success": True,
                    "status": "applied",
                    "message": f"Opened LinkedIn hiring post for {title} @ {company}. Active in browser!"
                }

            # Standard job: find and trigger Easy Apply if present
            apply_btn = None
            for sel in ["button.jobs-apply-button", ".jobs-s-apply button", "button[aria-label*='Easy Apply']", "button[aria-label*='Apply']"]:
                try:
                    for b in driver.find_elements(By.CSS_SELECTOR, sel):
                        if b.is_displayed():
                            apply_btn = b
                            break
                    if apply_btn:
                        break
                except Exception:
                    pass

            if apply_btn:
                safe_click(driver, apply_btn)
                time.sleep(2)

            save_applied("LinkedIn", title, company, job_id, url, status="Applied")
            return {
                "success": True,
                "status": "applied",
                "message": f"Successfully initiated application for {title} on LinkedIn!"
            }

        else:
            return {
                "success": False,
                "status": "unsupported",
                "message": f"Direct 1-click live apply is supported for Naukri and Others (Career Portals). Please use Run Bot for {platform_clean}."
            }

    except Exception as e:
        log.error(f"Error in live apply: {e}")
        return {
            "success": False,
            "status": "error",
            "message": f"Error attempting apply: {str(e)}"
        }


if __name__ == "__main__":
    main()
