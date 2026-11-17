# 🤖 8Oapply — Autonomous Job Application Platform

> Apply to hundreds of jobs automatically across 9 platforms — LinkedIn, Naukri, Indeed, Glassdoor, Internshala, Shine, Foundit, TimesJobs, and Wellfound.

![Python](https://img.shields.io/badge/Python-3.8%2B-blue?style=flat-square&logo=python)
![Selenium](https://img.shields.io/badge/Selenium-4.x-green?style=flat-square&logo=selenium)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Platforms](https://img.shields.io/badge/Platforms-9-orange?style=flat-square)
![Made for](https://img.shields.io/badge/Made%20for-India%20Job%20Market-red?style=flat-square)

---

## ✨ Features

- **9 platforms** — LinkedIn Easy Apply, Naukri, Indeed, Glassdoor, Internshala, Shine, Foundit (Monster), TimesJobs, Wellfound
- **Multi-browser support** — Microsoft Edge 🟦, Brave 🦁, Chrome 🌐 (auto-detect)
- **Uses your existing browser profile** — no re-login needed if already signed in
- **Human-like behaviour** — random delays, human typing speed, anti-detection patches
- **Duplicate prevention** — tracks all applied jobs in `applied_jobs.csv`
- **Cookie session reuse** — saves and reloads login sessions between runs
- **Multi-job × multi-location** — iterates every job title × location combination
- **Resume auto-upload** — attaches your PDF resume wherever supported
- **Cover note auto-fill** — fills text areas with your personalised note
- **Detailed logging** — console + `jobbot.log` file

---

## 📁 Project Structure

```
JobBot/
├── server.py              # FastAPI server (API & Web Dashboard host)
├── run_app.bat            # 1-Click launcher for Web Dashboard
├── config.json            # Dynamic config synced with UI
├── jobbot.py              # Main Selenium bot engine (9 platforms)
├── resume.pdf             # Your resume (gitignored ✅)
├── applied_jobs.csv       # Auto-generated log of all applications
├── jobbot.log             # Auto-generated run log
├── cookies/               # Auto-generated session cookies
├── FEATURES.md            # Detailed feature specs & architecture
└── frontend/              # Modern React + Vite + Tailwind Web App
    ├── src/
    │   ├── pages/         # Page-wise architecture:
    │   │   ├── Dashboard/ # Real-time status & streaming terminal
    │   │   ├── Platforms/ # 9 portal toggles & credentials
    │   │   ├── Targets/   # Job titles & locations chips
    │   │   ├── History/   # Interactive applied_jobs.csv table
    │   │   ├── Profile/   # Candidate info & resume uploader
    │   │   └── Settings/  # Engine delays & anti-ban tuning
```

> 📖 **Looking for full feature specifications, Email Alerts, Google Jobs, and Daily Scheduler details? See [FEATURES.md](FEATURES.md)**

---

## 🚀 Quick Start (React Web Dashboard)

### 1. Launch with Web UI (Recommended)

Simply run:
```bash
python server.py
```
*(Or double-click `run_app.bat`)*

Then open **`http://localhost:8000`** in your browser!

---

## 🛠️ CLI Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/jobbot.git
cd jobbot
```

### 2. Install dependencies

```bash
pip install selenium webdriver-manager
```

### 3. Set up your config

```bash
cp config.example.py config.py
```

Now open `config.py` and fill in your details:

```python
CONFIG = {
    "name":           "Your Name",
    "email":          "your@email.com",
    "phone":          "9999999999",
    "experience":     "0",
    "expected_ctc":   "600000",
    
    "job_titles": ["Software Engineer", "Full Stack Developer"],
    "locations":  ["Bangalore", "Hyderabad", "Remote"],
    
    "naukri_email":    "your@email.com",
    "naukri_password": "yourpassword",
    # ... fill whichever platforms you need
}
```

### 4. Place your resume

Drop your `resume.pdf` in the same folder as `jobbot_v2.py`.

### 5. Run!

```bash
python jobbot_v2.py
```

---

## ⚙️ Configuration Reference

| Key | Description | Default |
|-----|-------------|---------|
| `job_titles` | List of job titles to search | — |
| `locations` | List of cities / Remote | — |
| `experience` | Years of experience | `"0"` |
| `expected_ctc` | Expected salary (annual) | — |
| `max_per_platform` | Max applications per platform per combo | `50` |
| `delay_min` / `delay_max` | Human-like delay range (seconds) | `12–25` |
| `platform_rest_min/max` | Wait between platforms (seconds) | `600–900` |
| `browser` | `"edge"` / `"chrome"` / `"brave"` / `"auto"` | `"auto"` |
| `headless` | Run browser in background | `False` |
| `use_linkedin` | Enable/disable each platform | `True` |

---

## 🔐 Security — Keeping Your Credentials Safe

> ⚠️ **Never push `config.py` to GitHub.**

This repo is set up correctly:

- `config.py` → listed in `.gitignore` → **never committed**
- `config.example.py` → placeholder file → safe to commit
- `resume.pdf` → listed in `.gitignore` → **never committed**
- `cookies/` → listed in `.gitignore` → **never committed**

Always verify before pushing:

```bash
git status   # config.py should NOT appear here
```

---

## 🌐 Supported Platforms

| Platform | Login Method | Easy Apply | Resume Upload |
|----------|-------------|------------|---------------|
| LinkedIn | Browser profile / Manual | ✅ Easy Apply only | ✅ |
| Naukri | Credentials / Profile | ✅ | ✅ |
| Indeed | Credentials / Profile | ✅ Indeed Apply | ✅ |
| Glassdoor | Credentials + Cookie | ✅ | ➖ |
| Internshala | Credentials + Cookie | ✅ | ➖ |
| Shine | Credentials + Cookie | ✅ | ➖ |
| Foundit | Credentials + Cookie | ✅ | ➖ |
| TimesJobs | Credentials + Cookie | ✅ | ➖ |
| Wellfound | Credentials + Cookie | ✅ | ➖ |

---

## 💡 Tips

- **LinkedIn**: The bot uses your existing browser profile. Log into LinkedIn in Edge/Chrome once — it stays logged in.
- **Captcha / 2FA**: The bot pauses for `manual_login_wait` seconds (default 45s) so you can solve it manually.
- **Rate limits**: The bot waits 10–15 minutes between platforms to avoid account flags.
- **Re-runs**: Already-applied jobs are tracked in `applied_jobs.csv` and skipped automatically.
- **Headless mode**: Set `"headless": True` to run in the background (not recommended for first run).

---

## 📊 Output

After each run, you get:

- **`applied_jobs.csv`** — full log with date, platform, job title, company, job ID, URL
- **`jobbot.log`** — detailed run log with timestamps
- **Console summary** with per-platform counts

```
═══════════════════════════════════════════════════════
  📊 FINAL RESULTS
═══════════════════════════════════════════════════════
  LinkedIn        →  42 apps  ██████████████████████████████████████████
  Naukri          →  38 apps  ██████████████████████████████████████
  Indeed          →  29 apps  █████████████████████████████
  ...
───────────────────────────────────────────────────────
  TOTAL           → 250 applications
═══════════════════════════════════════════════════════
```

---

## ⚠️ Disclaimer

This tool is for **personal use only**. Automated job applications may violate the Terms of Service of some platforms. Use responsibly:

- Don't set `max_per_platform` excessively high
- Review jobs before mass-applying when possible
- The author is not responsible for account bans or other consequences

---

## 🛠️ Requirements

- Python 3.8+
- Microsoft Edge, Chrome, or Brave browser installed
- Internet connection

```
selenium
webdriver-manager
```

---

## 📄 License

MIT License — free to use, modify, and share.

---

## 🙌 Contributing

PRs welcome! If a platform's selectors break (websites update their HTML), feel free to open an issue or submit a fix.

---

*Built with ❤️ for the Indian job market — happy job hunting! 🚀*
#   8 O a p p l y 
 
 