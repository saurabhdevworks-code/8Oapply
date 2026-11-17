import imaplib
import email
from email.header import decode_header
import re
import os
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Tuple, Set
from services.response_tracker import record_inbox_match, sync_applied_jobs_with_inbox_and_lifecycle
from services.email_service import send_positive_response_alert

BASE_DIR = Path(__file__).resolve().parent.parent
SEEN_IDS_FILE = BASE_DIR / "inbox_seen_ids.json"

def load_seen_message_ids() -> Set[str]:
    if SEEN_IDS_FILE.exists():
        try:
            with open(SEEN_IDS_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_seen_message_ids(seen_ids: Set[str]):
    try:
        # Keep last 1000 IDs to avoid unbounded growth
        truncated = list(seen_ids)[-1000:]
        with open(SEEN_IDS_FILE, "w", encoding="utf-8") as f:
            json.dump(truncated, f)
    except Exception:
        pass

OFFER_PATTERNS = [
    r"\boffer letter\b",
    r"\bjob offer\b",
    r"\bformal offer\b",
    r"\bpleased to offer\b",
    r"\boffer of employment\b",
    r"\bcompensation structure\b",
    r"\bwelcome to the team\b",
    r"\bemployment contract\b",
]

EXAM_PATTERNS = [
    r"\bonline assessment\b",
    r"\bassessment link\b",
    r"\bhackerrank\b",
    r"\bcodility\b",
    r"\bcoderbyte\b",
    r"\btestgorilla\b",
    r"\bmettl\b",
    r"\bglider\.ai\b",
    r"\bglider\b",
    r"\bcoding challenge\b",
    r"\bonline test\b",
    r"\btechnical assessment\b",
    r"\btake-home\b",
    r"\btest invitation\b",
    r"\bcomplete the assessment\b",
    r"\btime-limited test\b",
    r"\bproctored exam\b",
    r"\bexam link\b",
]

INTERVIEW_PATTERNS = [
    r"\binterview\b",
    r"\binterview invitation\b",
    r"\bschedule a call\b",
    r"\bshortlisted\b",
    r"\bcalendly\.com\b",
    r"\bzoom meeting\b",
    r"\bgoogle meet\b",
    r"\bvideo call\b",
    r"\bphone screen\b",
    r"\btechnical discussion\b",
    r"\bhiring manager\b",
    r"\bnext round\b",
    r"\bdiscussion round\b",
    r"\bconversation with our team\b",
    r"\bround 1\b",
    r"\bround 2\b",
]

NEGATIVE_PATTERNS = [
    r"\bunfortunately\b",
    r"\bnot moving forward\b",
    r"\bother candidates\b",
    r"\bhigh volume of applicants\b",
    r"\bdecided to pursue\b",
    r"\bregret to inform\b",
    r"\bnot selected\b",
    r"\bposition has been filled\b",
    r"\bwe will not be moving forward\b",
]

def decode_mime_words(s: str) -> str:
    if not s:
        return ""
    decoded_fragments = decode_header(s)
    result = []
    for fragment, encoding in decoded_fragments:
        if isinstance(fragment, bytes):
            try:
                result.append(fragment.decode(encoding or "utf-8", errors="ignore"))
            except Exception:
                result.append(fragment.decode("latin1", errors="ignore"))
        else:
            result.append(str(fragment))
    return "".join(result)

def extract_email_body(msg) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdisp = str(part.get("Content-Disposition"))
            if ctype == "text/plain" and "attachment" not in cdisp:
                payload = part.get_payload(decode=True)
                if payload:
                    body += payload.decode("utf-8", errors="ignore")
                    break
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode("utf-8", errors="ignore")
    return body[:2500]

def analyze_email_sentiment(subject: str, body: str) -> Tuple[str, str, List[str], str]:
    combined = f"{subject}\n{body}".lower()

    offer_matches = [p.replace(r"\b", "").replace("\\", "") for p in OFFER_PATTERNS if re.search(p, combined)]
    exam_matches = [p.replace(r"\b", "").replace("\\", "") for p in EXAM_PATTERNS if re.search(p, combined)]
    interview_matches = [p.replace(r"\b", "").replace("\\", "") for p in INTERVIEW_PATTERNS if re.search(p, combined)]
    neg_matches = [p.replace(r"\b", "").replace("\\", "") for p in NEGATIVE_PATTERNS if re.search(p, combined)]

    if len(offer_matches) > 0 and len(offer_matches) >= len(neg_matches):
        return "Offer", "Positive", offer_matches, "Offer Letter"

    if len(exam_matches) > 0 and len(exam_matches) >= len(neg_matches):
        return "Assessment (OA)", "Positive", exam_matches, "Exam / Assessment"

    if len(interview_matches) > 0 and len(interview_matches) >= len(neg_matches):
        return "Interview Scheduled", "Positive", interview_matches, "Interview Scheduled"

    if len(neg_matches) > 0:
        return "Rejected", "Negative", neg_matches, "Rejection"

    return "Under Review", "Neutral", [], "Under Review"

def extract_company_name(sender: str, subject: str) -> str:
    # Try finding company from subject: "Interview with Company" or "Company: Next Steps"
    m = re.search(r"(?:interview with|from|at|role at)\s+([A-Za-z0-9\s]+?)(?:[-–—|:]|$)", subject, re.IGNORECASE)
    if m:
        comp = m.group(1).strip()
        if len(comp) > 2 and len(comp) < 30:
            return comp

    # Try extracting domain name from sender: recruiter@google.com -> Google
    domain_match = re.search(r"@([a-zA-Z0-9.-]+)", sender)
    if domain_match:
        domain = domain_match.group(1).lower()
        parts = domain.split(".")
        if len(parts) >= 2:
            name = parts[-2]
            if name not in ["gmail", "yahoo", "outlook", "hotmail", "icloud"]:
                return name.capitalize()

    return "Unknown Company"

def check_inbox_for_responses(config: Dict[str, Any]) -> Dict[str, Any]:
    imap_host = config.get("imap_host", "imap.gmail.com")
    imap_port = int(config.get("imap_port", 993))
    imap_user = config.get("imap_user") or config.get("smtp_user", "")
    imap_password = config.get("imap_password") or config.get("smtp_password", "")
    recipient_email = config.get("recipient_email", imap_user)
    alert_on_positive = config.get("alert_on_positive", True)

    if not imap_user or not imap_password:
        return {
            "status": "skipped",
            "message": "IMAP credentials not configured in Notification settings."
        }

    mail = None
    new_positive_alerts = []
    scanned_count = 0
    seen_ids = load_seen_message_ids()
    newly_seen_ids = set(seen_ids)

    try:
        import socket
        socket.setdefaulttimeout(15)
        mail = imaplib.IMAP4_SSL(imap_host, imap_port)
        mail.login(imap_user, imap_password)
        mail.select("INBOX")

        # Search for recent emails
        status, data = mail.search(None, "ALL")
        if status != "OK" or not data[0]:
            return {"status": "ok", "scanned": 0, "positive_detected": 0}

        email_ids = data[0].split()
        # Scan last 25 emails
        recent_ids = email_ids[-25:]

        for eid in reversed(recent_ids):
            status, msg_data = mail.fetch(eid, "(RFC822)")
            if status != "OK":
                continue

            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = decode_mime_words(msg.get("Subject", ""))
            sender = decode_mime_words(msg.get("From", ""))
            date_hdr = msg.get("Date", "")
            msg_id = (msg.get("Message-ID") or "").strip()
            if not msg_id:
                msg_id = hashlib.md5(f"{sender}_{subject}_{date_hdr}".encode("utf-8", errors="ignore")).hexdigest()

            # Skip already analyzed emails to eliminate duplicate alerts
            if msg_id in seen_ids:
                continue

            newly_seen_ids.add(msg_id)
            body = extract_email_body(msg)
            scanned_count += 1
            rec_status, sentiment, keywords, category = analyze_email_sentiment(subject, body)

            # If meaningful response detected
            if sentiment in ["Positive", "Negative"]:
                company = extract_company_name(sender, subject)
                snippet = body[:400].strip() or subject

                # Generate AI draft reply if Positive and AI credentials configured
                ai_draft = ""
                if sentiment == "Positive":
                    try:
                        from services.ai_service import generate_job_communication
                        prov = config.get("ai_provider", "grok").lower().strip()
                        key = config.get(f"{prov}_api_key") or config.get("ai_api_key", "")
                        model = config.get("ai_model", "")
                        if key:
                            ai_draft = generate_job_communication(
                                provider=prov,
                                api_key=key,
                                model=model,
                                job_title="Applicant",
                                company=company,
                                job_description="",
                                candidate_profile=config,
                                message_type="interview_reply",
                                recruiter_snippet=snippet
                            )
                    except Exception:
                        ai_draft = ""

                # Record in response tracker
                record = record_inbox_match(
                    company=company,
                    status=rec_status,
                    sentiment=sentiment,
                    snippet=snippet,
                    keywords=keywords,
                    sender_email=sender,
                    ai_draft=ai_draft
                )

                # Check alert filters: specific per-category or general alert_on_positive
                should_alert = False
                if sentiment == "Positive":
                    general_alert = config.get("alert_on_positive", True)
                    if category == "Offer Letter":
                        should_alert = config.get("alert_on_offer", general_alert)
                    elif category == "Exam / Assessment":
                        should_alert = config.get("alert_on_exam", general_alert)
                    elif category == "Interview Scheduled":
                        should_alert = config.get("alert_on_interview", general_alert)
                    else:
                        should_alert = general_alert

                if should_alert:
                    sent = send_positive_response_alert(
                        company=company,
                        job_title=record.get("job_title", "Software Engineer"),
                        email_snippet=snippet,
                        matched_keywords=keywords,
                        sender_email=sender,
                        to_email=recipient_email,
                        config=config,
                        response_type=category
                    )
                    new_positive_alerts.append({
                        "company": company,
                        "category": category,
                        "keywords": keywords,
                        "email_sent": sent
                    })

        save_seen_message_ids(newly_seen_ids)
        sync_res = sync_applied_jobs_with_inbox_and_lifecycle()
        return {
            "status": "success",
            "scanned": scanned_count,
            "positive_detected": len(new_positive_alerts),
            "alerts": new_positive_alerts,
            "auto_updated_statuses": sync_res.get("updated_count", 0),
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass
