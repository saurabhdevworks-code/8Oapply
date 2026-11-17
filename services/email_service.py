import smtplib
import os
import csv
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent

def get_smtp_connection(config: Dict[str, Any]):
    host = config.get("smtp_host", "smtp.gmail.com")
    port = int(config.get("smtp_port", 587))
    user = config.get("smtp_user", "")
    password = config.get("smtp_password", "")
    use_tls = config.get("smtp_use_tls", True)

    server = smtplib.SMTP(host, port, timeout=15)
    if use_tls:
        server.starttls()
    if user and password:
        server.login(user, password)
    return server

def send_email(subject: str, html_body: str, to_email: str, config: Dict[str, Any]) -> bool:
    user = config.get("smtp_user", "")
    if not user or not to_email:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"8OMate Automation <{user}>"
    msg["To"] = to_email
    msg["Date"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0530")

    part = MIMEText(html_body, "html")
    msg.attach(part)

    server = None
    try:
        server = get_smtp_connection(config)
        server.sendmail(user, [to_email], msg.as_string())
        return True
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass

def send_positive_response_alert(
    company: str,
    job_title: str,
    email_snippet: str,
    matched_keywords: List[str],
    sender_email: str,
    to_email: str,
    config: Dict[str, Any],
    response_type: str = "Positive Response"
) -> bool:
    # Customize subject & badge based on response type
    type_lower = response_type.lower()
    if "offer" in type_lower:
        badge_text = "🎉 Job Offer Detected"
        badge_style = "background-color: #701a75; color: #f472b6; border: 1px solid #d946ef;"
        subject = f"🎉 [OFFER LETTER DETECTED] Job Offer from {company} ({job_title})"
    elif "assessment" in type_lower or "exam" in type_lower or "oa" in type_lower:
        badge_text = "📝 Exam / Online Assessment Link Detected"
        badge_style = "background-color: #1e3a8a; color: #60a5fa; border: 1px solid #3b82f6;"
        subject = f"📝 [EXAM / OA ALERT] Online Assessment: {company} ({job_title})"
    elif "interview" in type_lower:
        badge_text = "📅 Interview Invitation Detected"
        badge_style = "background-color: #065f46; color: #34d399; border: 1px solid #10b981;"
        subject = f"📅 [INTERVIEW ALERT] Interview Scheduled: {company} ({job_title})"
    else:
        badge_text = "✨ Positive Recruiter Response"
        badge_style = "background-color: #065f46; color: #34d399; border: 1px solid #10b981;"
        subject = f"✨ [POSITIVE RESPONSE] {company} ({job_title})"

    keywords_str = ", ".join(matched_keywords) if matched_keywords else response_type

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }}
        .card {{ background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 24px; max-width: 600px; margin: 0 auto; }}
        .badge {{ {badge_style} padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; display: inline-block; }}
        .header {{ margin-bottom: 20px; }}
        .title {{ font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 10px; }}
        .meta {{ font-size: 13px; color: #94a3b8; margin-top: 6px; }}
        .content-box {{ background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 16px; margin: 16px 0; font-family: monospace; font-size: 13px; color: #e2e8f0; white-space: pre-wrap; line-height: 1.5; }}
        .footer {{ font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 12px; }}
        .action-hint {{ background-color: #172554; border-left: 3px solid #3b82f6; padding: 10px 14px; font-size: 13px; color: #bfdbfe; margin-top: 12px; border-radius: 0 4px 4px 0; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">{badge_text}</span>
          <div class="title">{company} — {job_title}</div>
          <div class="meta">Sender: <strong>{sender_email}</strong> &bull; Intent Category: <strong>{response_type}</strong> &bull; Key Signals: {keywords_str}</div>
        </div>
        <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 8px 0;">8Oapply detected high-priority recruiter correspondence in your connected inbox:</p>
        <div class="content-box">{email_snippet}</div>
        <div class="action-hint">
          <strong>Recommended Next Action:</strong> Open the 8Oapply Recruiter Inbox Hub to use the <em>Smart Recruiter Reply Drafter</em> or click directly in your mail app to schedule / take the assessment.
        </div>
        <div class="footer">
          Dispatched automatically by 8Oapply Autonomous Response Watcher at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}.
        </div>
      </div>
    </body>
    </html>
    """
    return send_email(subject, html, to_email, config)

def send_direct_email_application(
    recruiter_email: str,
    subject: str,
    body_text_or_html: str,
    resume_path: Optional[str],
    config: Dict[str, Any],
    company: str = "",
    job_title: str = "",
    job_description: str = "",
    tailor_resume: bool = False
) -> Dict[str, Any]:
    """
    Sends a direct cold application / outreach email to a recruiter with resume attached via SMTP.
    If tailor_resume is True or job_description is provided, dynamically generates
    a tailored ATS resume PDF matched to the JD.
    Also logs the sent application into applied_jobs.csv and job_responses.json.
    """
    user = config.get("smtp_user", "")
    if not user:
        raise ValueError("SMTP / Gmail account is not connected. Please connect your Gmail first.")
    if not recruiter_email or "@" not in recruiter_email:
        raise ValueError("Invalid recipient recruiter email address.")

    candidate_name = config.get("name", "Applicant")

    # If tailoring requested with JD, dynamically generate tailored PDF resume
    if (tailor_resume or (job_description and len(job_description.strip()) > 30)):
        try:
            from services.ai_service import tailor_resume_from_jd, generate_tailored_pdf_resume
            tailored = tailor_resume_from_jd(
                job_description=job_description,
                job_title=job_title,
                company=company,
                candidate_profile=config
            )
            safe_comp = "".join([c for c in company if c.isalnum() or c in (' ', '_')]).rstrip().replace(" ", "_") or "Job"
            tailored_pdf = str(BASE_DIR / f"tailored_resume_{safe_comp}.pdf")
            generate_tailored_pdf_resume(tailored, tailored_pdf, config)
            resume_path = tailored_pdf
        except Exception as e:
            print(f"Tailored resume generation notice: {e}")

    # Fallback to default resume if no resume_path provided
    if not resume_path or not os.path.exists(resume_path):
        def_res = config.get("resume_path", "resume.pdf")
        if os.path.exists(def_res):
            resume_path = def_res
        elif (BASE_DIR / "resume.pdf").exists():
            resume_path = str(BASE_DIR / "resume.pdf")

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject or f"Application for {job_title or 'Software Engineer'} — {candidate_name}"
    msg["From"] = f"{candidate_name} <{user}>"
    msg["To"] = recruiter_email
    msg["Reply-To"] = user
    msg["Date"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0530")

    # Format body as HTML or fallback
    html_content = body_text_or_html.replace("\n", "<br>")
    body_part = MIMEText(
        f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
          {html_content}
        </body>
        </html>
        """,
        "html"
    )
    msg.attach(body_part)

    # Attach resume if exists
    attached_file = None
    if resume_path and os.path.exists(resume_path):
        try:
            with open(resume_path, "rb") as f:
                attachment = MIMEBase("application", "pdf")
                attachment.set_payload(f.read())
                encoders.encode_base64(attachment)
                fname = os.path.basename(resume_path)
                attachment.add_header("Content-Disposition", f'attachment; filename="{fname}"')
                msg.attach(attachment)
                attached_file = fname
        except Exception as e:
            pass

    server = None
    try:
        server = get_smtp_connection(config)
        server.sendmail(user, [recruiter_email], msg.as_string())
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass

    # Log application in applied_jobs.csv
    app_date = datetime.now().strftime("%Y-%m-%d %H:%M")
    job_id = f"email_app_{int(datetime.now().timestamp())}"
    target_comp = company or recruiter_email.split("@")[-1].split(".")[0].capitalize()
    target_role = job_title or "Software Engineer (Direct Outreach)"

    applied_file = BASE_DIR / "applied_jobs.csv"
    try:
        file_exists = applied_file.exists()
        with open(applied_file, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["date", "platform", "job_title", "company", "job_id", "url", "status"])
            writer.writerow([app_date, "Direct Email", target_role, target_comp, job_id, f"mailto:{recruiter_email}", "Applied"])
    except Exception:
        pass

    # Log in job_responses.json
    try:
        resp_file = BASE_DIR / "job_responses.json"
        responses = []
        if resp_file.exists():
            with open(resp_file, "r", encoding="utf-8") as f:
                responses = json.load(f)
        responses.insert(0, {
            "id": f"resp_{len(responses) + 1}_{int(datetime.now().timestamp())}",
            "job_id": job_id,
            "company": target_comp,
            "job_title": target_role,
            "platform": "Direct Email",
            "url": f"mailto:{recruiter_email}",
            "applied_date": app_date,
            "status": "Applied",
            "sentiment": "Neutral",
            "last_response_date": None,
            "email_snippet": f"Sent cold application email to {recruiter_email} with resume attached ({attached_file or 'None'}).",
            "notes": "Direct Email Outreach via 8Oapply Hub",
            "sender_email": recruiter_email,
            "matched_keywords": ["Direct Email", "Resume Attached"] if attached_file else ["Direct Email"],
        })
        with open(resp_file, "w", encoding="utf-8") as f:
            json.dump(responses, f, indent=2)
    except Exception:
        pass

    return {
        "status": "success",
        "recruiter_email": recruiter_email,
        "company": target_comp,
        "job_title": target_role,
        "attached_resume": attached_file,
        "timestamp": app_date
    }

def send_daily_digest(
    applied_count: int,
    positive_count: int,
    applications: List[Dict[str, Any]],
    to_email: str,
    config: Dict[str, Any]
) -> bool:
    date_str = datetime.now().strftime("%Y-%m-%d")
    subject = f"8OMate Daily Digest — {applied_count} Applied | {positive_count} Responses ({date_str})"

    rows_html = ""
    for app in applications[:15]:
        rows_html += f"""
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #94a3b8; font-family: monospace;">{app.get('date', '')}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #cbd5e1;">{app.get('platform', '')}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #ffffff; font-weight: 500;">{app.get('job_title', '')}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #334155; color: #cbd5e1;">{app.get('company', '')}</td>
        </tr>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }}
        .card {{ background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 24px; max-width: 680px; margin: 0 auto; }}
        .title {{ font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 16px; }}
        .stats {{ display: flex; gap: 16px; margin-bottom: 20px; }}
        .stat-box {{ background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px 16px; flex: 1; }}
        .stat-val {{ font-size: 22px; font-weight: 700; color: #ffffff; font-family: monospace; }}
        .stat-lbl {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 2px; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
        th {{ text-align: left; padding: 8px 12px; background-color: #0f172a; color: #94a3b8; border-bottom: 1px solid #334155; }}
        .footer {{ font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 12px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="title">8OMate Daily Automation Summary — {date_str}</div>
        <div class="stats">
          <div class="stat-box">
            <div class="stat-val">{applied_count}</div>
            <div class="stat-lbl">Jobs Applied Today</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color: #34d399;">{positive_count}</div>
            <div class="stat-lbl">Positive Responses / Invites</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Platform</th>
              <th>Role</th>
              <th>Company</th>
            </tr>
          </thead>
          <tbody>
            {rows_html if rows_html else '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #64748b;">No new applications recorded today.</td></tr>'}
          </tbody>
        </table>
        <div class="footer">
          Generated automatically by 8OMate Autonomous Scheduler.
        </div>
      </div>
    </body>
    </html>
    """
    return send_email(subject, html, to_email, config)
