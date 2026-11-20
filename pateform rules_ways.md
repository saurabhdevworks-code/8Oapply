# Platform Application Ways & Automation Rules

Comprehensive guide detailing job application methods across major job platforms (Naukri, LinkedIn, Indeed, Glassdoor, Internshala, Shine, Foundit, TimesJobs, Wellfound, Direct ATS) and the exact automation rules enforced by JobBot.

---

## 1. Naukri Application Methods (7 Core Ways)

Naukri.com provides 7 distinct ways for candidates to discover and apply for jobs. JobBot handles each method specifically based on execution mode:

| # | Application Method | Platform Mechanism | JobBot Action (Collect Only) | JobBot Action (Auto-Apply) |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Direct Apply** | Job listing has internal Naukri "Apply" button. Resume and profile are forwarded directly to recruiter. | Scrapes job metadata, title, company, URL, authentic description, and saves status as `Not Applied`. | Clicks `#apply-button`, answers screening questionnaire via `fill_screening_questions_on_page()`, confirms submission (`Applied`). |
| **2** | **Apply on Company Website** | Button redirects to external company career portal / ATS (Workday, Greenhouse, Lever, etc.). | Extracts direct external company URL and saves record as `Not Applied` for manual review. | Triggers `apply_to_job_live()` ATS engine or logs portal link without locking the session. |
| **3** | **Recommended Jobs** | Algorithm matches candidate profile, skills, and current designation (`/recommended-jobs`). | Scrapes recommended feed listings matching candidate criteria into the collection pool. | Filters by minimum match threshold and auto-applies to top matches. |
| **4** | **Job Alerts** | Daily digest and real-time email alerts matching custom saved search parameters. | Inbox scanner (`services/response_tracker.py`) extracts alert job links into queue. | Automatically processes alert queue during scheduled runs. |
| **5** | **Recruiter Invitations (Nvites)** | Recruiter shortlists profile on Resdex and sends direct in-platform invitation. | IMAP sync tracks incoming recruiter invitations and updates status to `Under Review` / `Interview`. | Generates alert notification on dashboard for manual response. |
| **6** | **Saved Jobs** | Candidate bookmarks listings to review and apply later. | **Active Default**: Entire discovery run acts as an automated Saved Jobs queue. | Users can trigger 1-click apply from Applications Log table. |
| **7** | **Walk-in Jobs** | Direct venue interview listings with physical address, dates, and reporting time windows. | Extracts venue address and interview dates from description and tags listing for offline interview. | Skips automated online submission and marks as offline interview notice. |

---

## 2. Indeed Application Methods (6 Core Ways)

Indeed is the largest global job portal with standardized candidate workflows. JobBot handles each Indeed application method as follows:

| # | Application Method | Platform Mechanism | JobBot Action (Collect Only) | JobBot Action (Auto-Apply) |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Apply Now (Indeed Apply)** | In-platform 1-click apply (`#indeedApplyButton`). Form remains inside Indeed. | Scrapes role, company, authentic description, and saves status as `Not Applied`. | Clicks Indeed Apply, auto-fills candidate inputs, handles multi-step dialogs, submits (`Applied`). |
| **2** | **Apply on Company Site** | Button redirects candidate to external company career page or ATS (Workday, etc.). | Extracts clean destination URL and saves as `Not Applied` for safe candidate review. | Launches live ATS handler or safely stores clean URL without triggering bot blocks. |
| **3** | **Screening Questions** | Employer prompts for experience, notice period, expected salary, and eligibility. | Saves full job description and requirements to CSV for candidate review. | `smart_answer()` automatically maps questions to candidate profile data & AI answers. |
| **4** | **Resume-Based Application** | Candidate selects between formatted PDF document and default Indeed web profile. | Captures job criteria without file attachment. | Injects verified `resume.pdf` directly into file upload element (`input[type='file']`). |
| **5** | **Employer Invitations** | Employers search Indeed Resume database and send direct application invitations. | Email tracker identifies incoming Indeed interview invites and updates records. | Syncs invitation status to `Under Review` / `Interview` in history log. |
| **6** | **Saved Jobs** | Candidate bookmarks listings with heart icon to review and apply later. | **Active Default**: Automatically populates `applied_jobs.csv` as an unapplied queue. | User can review descriptions and trigger 1-click live apply anytime from dashboard. |

---

## 3. LinkedIn Application Methods (7 Core Ways)

LinkedIn is the premier professional network with specialized Easy Apply, content feed post discovery, and referral workflows. JobBot handles each LinkedIn method as follows:

| # | Application Method | Platform Mechanism | JobBot Action (Collect Only) | JobBot Action (Auto-Apply) |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Easy Apply** | Native in-platform application popup. Direct resume upload & pre-filled contact details. | Scrapes job title, company, clean URL, full authentic JD, and logs as `Not Applied`. | Clicks Easy Apply button, steps through multi-page wizard, handles inputs, and clicks Submit (`Applied`). |
| **2** | **Apply (External Redirect)** | "Apply" button opens new tab redirecting to company ATS (Workday, Greenhouse, Taleo). | Captures destination company link, skips popup, saves record as `Not Applied` for review. | Safely logs redirect link without hanging the browser session. |
| **3** | **Application Questions** | Custom employer questionnaire (experience, work authorization, sponsorship, tech stack). | Saves complete requirements and JD in record description for candidate review. | Injects verified profile data (Notice, CTC, Visa status, years of experience) into form fields. |
| **4** | **Recruiter Direct Contact** | Recruiter reaches out via LinkedIn InMail, direct messaging, or job broadcast post. | Email & inbox listener captures recruiter messages and alerts candidate on dashboard. | Updates application record status to `Under Review` / `Interview`. |
| **5** | **Employee Referral** | "Ask for a referral" button showing mutual connections at the hiring company. | Extracts hiring company & role details so candidate can target alumni/connections. | Logs company name and role to assist targeted referral outreach. |
| **6** | **Saved Jobs** | Candidate bookmarks jobs using the ribbon icon to apply later. | **Active Default**: Entire discovery run populates `applied_jobs.csv` as an unapplied queue. | Candidate can trigger 1-click live apply anytime from the Applications Log. |
| **7** | **Search Posts (Content Feed Hiring)** | Founders, CTOs, and HR managers post direct openings on feed: *"Hiring Java Dev in Noida... DM/Email CV"*. | Scans `linkedin.com/search/results/content/` (sorted by date posted), extracts recruiter name, post text, links, and logs as `Not Applied`. | Opens hiring post directly for 1-click candidate DM or email application. |

---

## 4. Internshala Application Methods (6 Core Ways)

Internshala is India's leading platform for entry-level engineering jobs, fresher tech roles, and internships. JobBot automates each method as follows:

| # | Application Method | Platform Mechanism | JobBot Action (Collect Only) | JobBot Action (Auto-Apply) |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Apply Now** | Standardized "Apply Now" button (`#apply_now_btn`) on job/internship listing. | Scrapes job title, company, clean URL, stipend/salary, and logs as `Not Applied`. | Clicks Apply Now, handles in-platform modal, reviews submission, and records `Applied`. |
| **2** | **Cover Letter / Why Should You Be Hired?** | Mandatory prompt asking why candidate is suitable for the role. | Saves job description and criteria into database for manual review. | Injects dynamically tailored cover note using `get_tailored_cover_note(title, company)`. |
| **3** | **Profile-Based Application** | Education, graduation year, degree, and skills auto-pulled from Internshala profile. | Checks profile eligibility criteria before collection. | Synchronizes candidate credentials (VIT Bhopal University, MCA 8.5 CGPA, BCA 71%). |
| **4** | **Internship & Fresher Job Applications** | Support for Work From Home (WFH), full-time in-office, and hybrid roles. | Classifies listing types (Fresher Job vs Internship) and saves with full details. | Targets preferred work mode (e.g., Noida / Delhi in-office & remote). |
| **5** | **Custom Employer Questions** | Prompts on project portfolio, availability (immediate joiner), and GitHub links. | Captures question text and employer requirements in record. | Auto-injects candidate GitHub URL, portfolio link, and immediate joining confirmation. |
| **6** | **Application Tracking & Status Lifecycle** | Tracks employer application views, shortlisting, and assignment tasks. | Discovered jobs are tracked in `applied_jobs.csv` with real-time audit trail. | Tracks status progression (`Not Applied` $\to$ `Applied` $\to$ `Under Review`). |

---

## 5. Multi-Platform Application Matrix

| Platform | Primary Apply Method | Redirect Handling | Screening Questions | Cookie Auth Key |
| :--- | :--- | :--- | :--- | :--- |
| **Naukri** | Direct Apply & Company Site | Extracts clean redirect URL | Handled via modal question parser | `nauk_at` |
| **LinkedIn** | Easy Apply & External Apply | External opened in background | Auto-filled via multi-step wizard | `li_at` |
| **Indeed** | Indeed Apply (1-Click) & Company Site | Direct ATS parser | Form filling with resume upload | `SOCK`, `UD` |
| **Glassdoor** | Easy Apply & Company Site | External tab closed safely | Modal questionnaire parsing | `gdlk` |
| **Internshala** | In-Platform 1-Click Form | Native form submission | Tailored cover letter auto-injected | Session cookies |
| **Shine** | Direct Apply Button | Handled in-page | Profile data auto-attached | Session cookies |
| **Foundit** | Monster/Foundit 1-Click Apply | External link preserved | Profile data auto-attached | Session cookies |
| **TimesJobs** | Direct Apply Button | Redirection logged | Profile data auto-attached | Session cookies |
| **Wellfound** | AngelList Startup Form | In-place startup pitch form | Auto-types customized pitch | Session cookies |
| **Direct ATS / Others** | Lever, Greenhouse, Workday, SmartRecruiters | Strict domain validation | Multi-page ATS form auto-fill | Direct career URL |

---

## 6. JobBot Automation Rules

### Rule 1: Platform Priority Sequencing
The engine executes platforms strictly in the order defined by `platform_priority_order` in `config.json`:
$$\text{Priority Sequence} = [\text{Others} \longrightarrow \text{LinkedIn} \longrightarrow \text{Indeed} \longrightarrow \text{Naukri} \longrightarrow \text{Glassdoor} \longrightarrow \text{Internshala} \longrightarrow \dots]$$
* Platforms toggled OFF (`use_<platform> = false`) are skipped immediately with zero delay.
* Only platforms with verified session cookies (`connected: true`) are engaged.

### Rule 2: Volume Quota (Max Per Platform)
$$\text{Jobs Processed Per Platform} \le \text{CONFIG}["\text{max\_per\_platform}"]$$
* Once a platform reaches this threshold, the runner safely logs completion (`<Platform> DONE`) and transitions to the next priority platform.
* Prevents over-querying a single source and balances application volume across portals.

### Rule 3: 2-Way Execution Behavior (Manual Run vs Scheduler Triggered)
JobBot enforces a strict 2-way operational model:
1. **Manual User Run (`POST /api/bot/start` via UI Run Bot / Play Button):**
   * **Collect Jobs Only**: Discovers matching jobs across all enabled platforms (Others, LinkedIn, Indeed, Naukri, Glassdoor, Internshala, Shine, Foundit, TimesJobs, Wellfound).
   * Extracts clean metadata, job title, company, location, URL, and full job description.
   * Records all newly discovered jobs into `applied_jobs.csv` with status `Not Applied`.
   * **Strictly skips all apply and submit buttons**.
   * Does not require resume or academic profile to be pre-filled to start discovering jobs.
2. **Scheduler Triggered Run (`scheduler_worker` or `POST /api/scheduler/run-now`):**
   * Operates strictly on the basis of configured scheduler routine rules (`scheduler_action_mode` / routine settings):
     * **Mode 1: Fetch & Auto-Apply** (`fetch_and_apply` / `both`): Performs ATS discovery, auto-applies to queued jobs, triggers the live crawler with auto-apply enabled (`automate_apply: true`), and validates candidate resume & profile.
     * **Mode 2: Apply Selected Jobs** (`selected_jobs`): Processes specific jobs selected and queued by candidate.
     * **Mode 3: Discovery Only** (`collect_only` / `discovery_only`): Runs discovery and collection per routine schedule.
     * **Mode 4: Apply Only** (`apply_only`): Submits applications to unapplied listings already in queue.
   * Performs inbox recruiter response checking and sends daily digest email based on scheduler settings.

### Rule 4: Zero Duplicate Applications (Deduplication)
$$\forall \ \text{Job}_k, \quad \text{If } \text{Job}_k.\text{id} \in \text{applied\_jobs.csv} \implies \mathbf{SKIP}$$
* Every job has a unique identifier generated from its portal ID or URL hash.
* If a listing exists in `applied_jobs.csv` under any status (`Applied`, `Not Applied`, `Under Review`), it is never re-processed.

### Rule 5: Stealth Delays & Anti-Detection
$$\text{Interaction Delay} = \text{random}(\text{delay\_min}, \text{delay\_max}) \text{ seconds}$$
$$\text{Platform Rest Interval} = \text{random}(\text{platform\_rest\_min}, \text{platform\_rest\_max}) \text{ seconds}$$
* Emulates realistic human typing speeds (`type_human()` with randomized character delays).
* Randomized rest pauses between platforms to protect candidate accounts from automated rate-limiting.

### Rule 6: Live UI Platform Indicators
* The engine actively parses log output in real-time (`get_bot_progress()`).
* The UI displays the currently active platform badge (e.g. `[Naukri]`, `[Indeed]`, `[Glassdoor]`) and search targets (`Searching on Naukri...`) in the Runner Active card.
