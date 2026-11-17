# 📊 JobBot Project Status: Real Accomplishments vs. Pending Tasks

> **Last Updated:** November 2026  
> **Repository:** `JobBot` — Autonomous Multi-Portal Job Application & Recruiter Response System

---

## 📌 Executive Summary

| Category | Status | Completion | Key Highlights |
|---|:---:|:---:|---|
| **Core Automation Engine (`jobbot.py`)** | ✅ Real & Functional | 90% | 9 Indian job portals supported; human-like delays; anti-bot profile |
| **FastAPI Backend Server (`server.py`)** | ✅ Real & Functional | 95% | 20+ REST & SSE endpoints; process management; logs streaming |
| **React Web Dashboard (`frontend/`)** | ✅ Real & Functional | 95% | Complete page-wise UI (Dashboard, Platforms, Targets, History, Responses, Scheduler, Settings, Profile) |
| **Recruiter Inbox & Sentiment (`inbox_watcher.py`)** | ✅ Real & Functional | 85% | IMAP reader, keyword sentiment engine, positive interview trigger |
| **Email Notification System (`email_service.py`)** | ✅ Real & Functional | 90% | SMTP transactional alerts, daily digest HTML templates |
| **AI Assistant (`ai_service.py`)** | ✅ Real & Functional | 95% | 4 AI providers (Grok, OpenAI, Claude, Gemini) for pitches & email replies |
| **Autonomous Scheduler (`scheduler_service.py`)** | ✅ Real & Functional | 90% | Scheduled routine runner, weekend filter, auto-trigger pipeline |
| **ATS & External Job Collector (`job_collector.py`)** | ⚠️ Partial | 40% | Greenhouse & Lever API collectors working; Google Jobs & direct auto-applier pending |
| **Storage & Persistence** | ⚠️ Baseline | 75% | CSV & JSON files working; SQLite migration pending |

---

## ✅ What is DONE (Real in Code & Tested)

### 1. 🤖 Selenium Multi-Portal Application Engine (`jobbot.py`)
* **9 Indian Job Platforms Implemented:**
  1. **Naukri.com:** Full flow working (tested in live runs with 19+ real applications logged). Handles credential login, session cookie recovery, Easy Apply, screening forms, and anti-bot Chrome sessions.
  2. **LinkedIn:** Easy Apply automated multi-step form handling (experience, phone, screening questions, PDF resume upload, review, and submit).
  3. **Indeed India:** Indeed Apply form filling, resume attachment, and anti-Turnstile waiting logic.
  4. **Glassdoor:** Easy Apply automation, salary/city filters, and modal handling.
  5. **Internshala:** Fresher/internship application flow, assignment answers, and cover note injection.
  6. **Shine.com:** Automated search and 1-click submission.
  7. **Foundit (Monster):** Cookie and credential login, quick apply automation.
  8. **TimesJobs:** Portal search and submission logic.
  9. **Wellfound (AngelList):** Startup job search and personalized pitch injection.
* **Anti-Detection & Humanized Dynamics:**
  * Multi-browser auto-detection (Microsoft Edge, Google Chrome, Brave).
  * Random keystroke typing simulation (`type_human()`) with random jitter (40ms – 120ms).
  * Dynamic delays between applications (`delay_min` to `delay_max`) and platform rest cycles (`platform_rest_min` to `platform_rest_max`).
  * Chrome Remote Debugging port bypass (`Launch_JobBot_Chrome.bat` and `launch_debug_chrome()`) to defeat Cloudflare/Turnstile detection on Naukri and Indeed.
* **Persistent Sessions & Deduplication:**
  * Session cookies stored and reloaded from `cookies/*.pkl`.
  * Every submitted job recorded in `applied_jobs.csv` with unique `job_id`, title, company, date, and link.
  * Checks previous IDs before applying to prevent duplicate submissions.
* **On-Demand Live Apply:**
  * `apply_to_job_live()` enables users to trigger a one-off application to any specific job URL directly from the dashboard.

---

### 2. ⚡ FastAPI Backend Server (`server.py`)
* **Process Lifecycle:**
  * Background subprocess controller for `jobbot.py` (`/api/bot/start`, `/api/bot/stop`).
  * Real-time bot progress calculation (`/api/status`) parsing live combo steps, platform names, and jobs applied.
* **Endpoints Implemented:**
  * **Configuration:** `GET` / `POST` `/api/config` for real-time config updates.
  * **Job History Management:** `/api/jobs` (load), `/api/jobs/update-status`, `/api/jobs/bulk-update-status`, `/api/jobs/delete`, `/api/jobs/bulk-delete`, `/api/jobs/apply-live`.
  * **Real-time Logs:** `/api/logs` and `/api/logs/stream` using Server-Sent Events (SSE).
  * **Resume Upload:** `POST` `/api/resume/upload` and status check `GET` `/api/resume/status`.
  * **Platform Session Helpers:** `/api/platforms/open-login-browser`, `/api/platforms/connect-credentials`, `/api/platforms/verify-session`, `/api/platforms/check-login-status`.
  * **Recruiter Responses:** `/api/responses`, `/api/responses/metrics`, `/api/responses/update`, `/api/responses/check-inbox`.
  * **Job Collector:** `/api/collector/jobs`, `/api/collector/run`, `/api/collector/clear`.
  * **Scheduler:** `/api/scheduler/status`, `/api/scheduler/run-now`.
  * **Email & Alerts:** `/api/email/test`, `/api/gmail/status`, `/api/gmail/connect`, `/api/gmail/disconnect`.
  * **AI Generation:** `/api/ai/generate`, `/api/ai/test`.
* **SPA Serving:** Serves compiled Vite React app seamlessly on port 8000 alongside API routes.

---

### 3. 💻 Modern React Web Dashboard (`frontend/`)
* **Page-Wise Navigation & Architecture:**
  * **`DashboardPage` (`/`):** Engine status indicator (IDLE/RUNNING/CLOUDFLARE), Start/Stop buttons, live combo counters, and an embedded SSE **Live Terminal**.
  * **`PlatformsPage` (`/platforms`):** Cards for all 9 platforms with individual enable/disable switches, credential management with reveal/hide toggle, and one-click manual browser login.
  * **`TargetsPage` (`/targets`):** Interactive chip inputs for Target Roles, Target Locations, Candidate Skills, Expected CTC, and Cover Note editor.
  * **`HistoryPage` (`/history`):** Complete interactive table displaying `applied_jobs.csv` with search, platform filters, status badges, single/bulk deletion, CSV export, and "Live Apply" button.
  * **`ResponsesPage` (`/responses`):** Visual recruiter response pipeline with KPI cards (Applied, Under Review, OA, Interview, Offer, Rejected), sentiment badges, "Check Inbox Now" button, and modal with 1-click **AI Reply Generator**.
  * **`SchedulerPage` (`/scheduler`):** Schedule configuration (run times, weekend skipping, daily cap), status indicators, and manual "Run Scheduled Pipeline Now" trigger.
  * **`ProfilePage` (`/profile`):** Candidate profile details editor and PDF Resume dropzone/file manager.
  * **`SettingsPage` (`/settings`):** Browser selection, headless toggle, safety timing sliders, AI Provider settings (Grok, OpenAI, Claude, Gemini with API key testing), and Gmail/SMTP configuration modal.

---

### 4. 📬 Recruiter Inbox Watcher & Response Tracker (`services/`)
* **`inbox_watcher.py`:**
  * IMAP connection to Gmail / custom mail server.
  * Scans unread recruiter emails and prevents reprocessing via `seen_message_ids`.
  * MIME parsing and email body text extraction.
  * **Sentiment Classification:** Categorizes emails as **Positive** (Interview / OA / Next Steps), **Negative** (Rejection), or **Neutral** based on recruiter keyword heuristics.
  * Extracts recruiter company names and matches with applied jobs.
* **`response_tracker.py`:**
  * Maintains `job_responses.json`.
  * Automatically associates incoming recruiter emails with entries in `applied_jobs.csv`.
  * Calculates response metrics across application lifecycle stages.

---

### 5. 📧 Email Notification Dispatcher (`services/email_service.py`)
* Standard SMTP connection supporting Gmail App Passwords and custom SMTP relays.
* **Instant Positive Response Alert:** Dispatches an immediate HTML alert when an interview invitation or Online Assessment (OA) is detected in the candidate's inbox.
* **Daily Application Digest:** Formats and sends an end-of-day summary email of total applications submitted, platform breakdown, and any bot errors.
* **Test Email Endpoint:** Instant test button in the UI to confirm SMTP credentials.

---

### 6. 🧠 Multi-Provider AI Copywriter (`services/ai_service.py`)
* Direct API integrations with 4 leading AI model providers:
  1. **xAI (Grok):** `grok-2-latest`, `grok-2-mini`, `grok-beta`
  2. **OpenAI:** `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
  3. **Anthropic Claude:** `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`
  4. **Google Gemini:** `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`
* **Use Cases Handled:**
  * Custom Cover Pitch generation tailored to candidate skills and target roles.
  * Cold outreach messages for LinkedIn/recruiter emails.
  * 1-Click polished interview acceptance and scheduling replies.
  * In-UI API connection validation tests.

---

### 7. ⏰ Daily Autonomous Scheduler (`services/scheduler_service.py`)
* Background threading daemon executing on specified wall-clock times (e.g., `["09:30", "17:00"]`).
* Option to pause on weekends (`skip_weekends`).
* Orchestrates:
  1. Job Collector run
  2. Bot runner execution (if not already running)
  3. Inbox response check
  4. Daily digest email dispatch

---

## ⚠️ What is PARTIALLY DONE (Requires Polishing or Integration)

| Component | Current State | What is Missing / Needs Work |
|---|---|---|
| **ATS Job Collector (`job_collector.py`)** | Greenhouse (`boards-api.greenhouse.io`) and Lever (`api.lever.co`) public API crawlers are implemented and save matching jobs to `collected_jobs.json`. | Crawled jobs are only collected and stored; there is currently **no automated form-submission bot** to automatically fill and submit applications on Greenhouse/Lever portals. |
| **Cloudflare / Turnstile Captcha** | Detection logic and remote-debugging Chrome profiles exist; the bot pauses and waits for user resolution. | No third-party automated captcha solving service (e.g., 2Captcha, CapSolver) is integrated; requires human interaction when a challenge appears. |
| **Job Portal DOM Selectors** | Selectors for all 9 platforms are written and functional. | Job portals (especially Naukri, Indeed, and LinkedIn) frequently update their CSS classes and DOM layouts, requiring periodic selector updates. |
| **Email Auth (Gmail)** | Implemented using IMAP and SMTP with Gmail 16-character App Passwords. | True Google OAuth 2.0 web consent flow is not implemented; users must generate a Google App Password. |

---

## ❌ What is PENDING (Not Yet Implemented / Future Roadmap)

### 1. 🔍 Google Jobs Aggregator
* **Goal:** Scrape Google Search's structured job listings widget (`https://www.google.com/search?ibp=htl;jobs`).
* **Current Status:** Documented in `FEATURES.md`, but no code exists yet in `services/job_collector.py` or elsewhere.
* **Pending Work:**
  * Build a Google Jobs scraper (via direct HTML parsing or SerpApi/Google Custom Search API).
  * Filter and extract direct application links and insert into `collected_jobs.json`.

### 2. 🏢 Additional ATS Crawlers
* **Goal:** Expand ATS coverage to Ashby, Workday, and SmartRecruiters.
* **Current Status:** Only Greenhouse and Lever are currently implemented.
* **Pending Work:**
  * Implement Ashby job API client (`api.ashbyhq.com`).
  * Implement Workday search scraper (`<company>.myworkdayjobs.com`).
  * Implement SmartRecruiters API crawler (`api.smartrecruiters.com`).

### 3. 📝 Autonomous Direct ATS Form Applier
* **Goal:** Automatically fill and submit job applications on Greenhouse, Lever, and Ashby postings.
* **Current Status:** Not started. The collector collects job URLs, but the Selenium engine only applies on the 9 primary aggregator portals.
* **Pending Work:**
  * Create standardized Selenium form fillers for Greenhouse and Lever application forms (First Name, Last Name, Email, Phone, Resume file attachment, LinkedIn URL, GitHub URL).

### 4. 🗄️ Database Migration (CSV / JSON ➔ SQLite)
* **Goal:** Replace `applied_jobs.csv` and `job_responses.json` with a structured local SQLite database (`jobbot.db`).
* **Current Status:** Baseline file-based storage works well for <5,000 jobs, but lacks relational integrity, indexing, and transactional locking during concurrent writes.
* **Pending Work:**
  * Create SQLite schema for `jobs`, `applications`, and `recruiter_messages`.
  * Add automatic migration script from existing `applied_jobs.csv` and `job_responses.json`.

### 5. 📱 Additional Instant Alert Channels
* **Goal:** Deliver instant notifications for recruiter interview invites via Telegram or WhatsApp.
* **Current Status:** Only Email (SMTP) alerts are implemented.
* **Pending Work:**
  * Integrate Telegram Bot API (`send_message`).
  * Integrate WhatsApp Business API or Twilio for urgent interview alerts.

### 6. 🐳 Docker & Headless Linux Deployment
* **Goal:** Package JobBot into a Docker container for 24/7 VPS deployment (AWS EC2, DigitalOcean, Hetzner).
* **Current Status:** Configured and tested primarily on Windows using local Chrome/Edge installations.
* **Pending Work:**
  * Create `Dockerfile` with headless Chromium, Xvfb (virtual display for anti-detection), and Python dependencies.
  * Provide `docker-compose.yml` for unified backend and frontend execution.

---

## 📋 Comprehensive Feature Checklist

```
JobBot Core Engine:
  [x] Selenium multi-browser support (Edge, Chrome, Brave)
  [x] Anti-detection profile & random human delay typing
  [x] Chrome remote debugging session attachment
  [x] Cookie session persistence (cookies/*.pkl)
  [x] Deduplication via applied_jobs.csv
  [x] Naukri.com auto-apply runner (Tested & verified)
  [x] LinkedIn Easy Apply runner
  [x] Indeed Apply runner
  [x] Glassdoor Easy Apply runner
  [x] Internshala auto-apply runner
  [x] Shine.com auto-apply runner
  [x] Foundit (Monster) auto-apply runner
  [x] TimesJobs auto-apply runner
  [x] Wellfound pitch & apply runner
  [x] One-click Live Apply endpoint
  [ ] Automatic Cloudflare / Turnstile solver (currently waits for manual solve)
  [ ] Automated external redirect job application (currently skips redirect links)

FastAPI Server & Services:
  [x] Bot process manager (Start/Stop/PID tracking)
  [x] SSE Live log streamer
  [x] Config read/write REST endpoints
  [x] Application history CRUD endpoints
  [x] Resume PDF uploader & status
  [x] Recruiter inbox IMAP scanner
  [x] Sentiment analysis engine (Positive/Negative/Neutral)
  [x] Recruiter response lifecycle tracker
  [x] SMTP email alert dispatcher (Instant alerts + Daily digest)
  [x] Multi-model AI copywriter (Grok, OpenAI, Claude, Gemini)
  [x] Autonomous scheduler daemon (Time-of-day + weekend skip)
  [x] Greenhouse ATS job collector
  [x] Lever ATS job collector
  [ ] Google Jobs aggregator scraper
  [ ] Ashby, Workday, SmartRecruiters ATS collectors
  [ ] Direct ATS automated form applier
  [ ] SQLite database migration
  [ ] Telegram / WhatsApp notification channels

React Frontend:
  [x] Dashboard with live PID, stats, controls & streaming terminal
  [x] Platforms page with switches, credentials & manual login trigger
  [x] Targets page with roles, locations, skills chips & cover note editor
  [x] History page with search, filters, pagination, delete & CSV export
  [x] Responses page with stage metrics, recruiter list & AI reply drafter
  [x] Scheduler page with time tags & manual run trigger
  [x] Profile page with candidate details & resume uploader
  [x] Settings page with safety sliders, AI keys & Gmail setup
  [ ] Direct ATS collection viewer / reviewer UI
  [ ] Visual Kanban board drag-and-drop for application statuses
```
