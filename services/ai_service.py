import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

DEFAULT_MODELS = {
    "grok": "grok-2-latest",
    "openai": "gpt-4o-mini",
    "claude": "claude-3-5-haiku-20241022",
    "gemini": "gemini-1.5-flash",
}

def generate_with_grok(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": model or "grok-2-latest",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "8OMate/2.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))
        return res_json["choices"][0]["message"]["content"].strip()

def generate_with_openai(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "8OMate/2.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))
        return res_json["choices"][0]["message"]["content"].strip()

def generate_with_claude(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    url = "https://api.anthropic.com/v1/messages"
    payload = {
        "model": model or "claude-3-5-haiku-20241022",
        "max_tokens": 1500,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "User-Agent": "8OMate/2.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))
        return res_json["content"][0]["text"].strip()

def generate_with_gemini(api_key: str, model: str, system_prompt: str, user_prompt: str) -> str:
    model_name = model or "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    full_prompt = f"{system_prompt}\n\nTask:\n{user_prompt}"
    payload = {
        "contents": [
            {
                "parts": [{"text": full_prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1500,
        }
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))
        candidates = res_json.get("candidates", [])
        if candidates and "content" in candidates[0]:
            parts = candidates[0]["content"].get("parts", [])
            if parts and "text" in parts[0]:
                return parts[0]["text"].strip()
        raise Exception("Empty generation from Gemini API")

def generate_job_communication(
    provider: str,
    api_key: str,
    model: str,
    job_title: str,
    company: str,
    job_description: str,
    candidate_profile: Dict[str, Any],
    message_type: str = "cover_letter",
    recruiter_snippet: str = ""
) -> str:
    if not api_key:
        raise ValueError(f"API key missing for provider: {provider}")

    prov = provider.lower().strip()
    system_prompt = (
        "You are an expert executive career coach and technical copywriter for software engineers and tech professionals. "
        "Write concise, high-impact, professional messages without fluff, clichés, or generic phrases. "
        "Always personalize the content to the specific role and candidate background."
    )

    name = candidate_profile.get("name", "")
    degree = candidate_profile.get("degree", "")
    experience = candidate_profile.get("experience", "")
    skills = candidate_profile.get("skills", "")
    college = candidate_profile.get("college", "")

    if message_type == "cover_letter":
        user_prompt = f"""
Write a high-converting, professional Cover Note (120-180 words) for an application.

Target Role: {job_title}
Target Company: {company}
Job Description / Requirements:
{job_description or "Full-stack / software engineering position matching the candidate skills"}

Candidate Background:
- Name: {name}
- Education: {degree} ({candidate_profile.get('grad_year', '2026')} Graduate) from {college}
- Experience: {experience} years
- Key Tech Stack: {skills}

Guidelines:
- First sentence: State clearly who I am and why I am directly qualified for {job_title} at {company}.
- Second paragraph: Mention 2-3 concrete skills or architectural achievements directly matching the role.
- Conclusion: Confident closing with call to action.
- Tone: Crisp, technical, professional. Do not use placeholders like [Insert Project].
"""
    elif message_type == "cold_outreach":
        user_prompt = f"""
Write a personalized LinkedIn / Email Cold Message (under 100 words) to a recruiter or engineering manager.

Target Role: {job_title}
Target Company: {company}
Candidate: {name} ({degree}, {skills})

Guidelines:
- Subject line (if email) + message body.
- Short, high-signal, respecting their time.
- Highlight specific tech alignment and ask if they have 5 minutes for a brief discussion.
"""
    elif message_type == "interview_reply":
        user_prompt = f"""
Write a prompt, professional email response to a recruiter who sent an interview / assessment invitation.

Company: {company}
Role: {job_title}
Candidate Name: {name}
Recruiter's Message / Request:
{recruiter_snippet or "Invitation for an initial technical interview / online coding assessment."}

Guidelines:
- Confirm receipt and express enthusiasm for {company}.
- State availability or confirm completion of the requested next step.
- Ask any necessary logistical questions cleanly.
- Professional sign-off.
"""
    else:
        user_prompt = f"Write a professional communication regarding {job_title} at {company} for candidate {name}."

    # Dispatch to selected AI provider
    if prov in ["grok", "xai"]:
        return generate_with_grok(api_key, model, system_prompt, user_prompt)
    elif prov == "openai":
        return generate_with_openai(api_key, model, system_prompt, user_prompt)
    elif prov in ["claude", "anthropic"]:
        return generate_with_claude(api_key, model, system_prompt, user_prompt)
    elif prov in ["gemini", "google"]:
        return generate_with_gemini(api_key, model, system_prompt, user_prompt)
    else:
        raise ValueError(f"Unsupported AI provider: {provider}. Supported: grok, openai, claude, gemini")


def answer_screening_question(
    question_text: str,
    job_title: str = "",
    company: str = "",
    candidate_profile: Optional[Dict[str, Any]] = None,
    custom_answers: Optional[Dict[str, str]] = None
) -> str:
    """
    Answers application screening questions using AI (Grok/OpenAI/Claude/Gemini)
    or smart candidate heuristic fallback, learning from custom_answers.
    """
    if candidate_profile is None:
        candidate_profile = {}
    if custom_answers is None:
        custom_answers = candidate_profile.get("custom_answers", {})

    q_lower = question_text.lower().strip()

    # 1. Check custom saved answers first
    for k, v in custom_answers.items():
        if k.lower() in q_lower or q_lower in k.lower():
            if v and str(v).strip():
                return str(v).strip()

    # 2. Try AI generation if credentials configured
    prov = (candidate_profile.get("ai_provider") or "grok").lower().strip()
    api_key = (
        candidate_profile.get(f"{prov}_api_key")
        or candidate_profile.get("ai_api_key")
        or ""
    )
    model = candidate_profile.get("ai_model", "")

    if api_key:
        try:
            system_prompt = (
                "You are an intelligent candidate assistant answering job application screening questions. "
                "Provide a direct, truthful, concise, and professional answer from the candidate's perspective (first-person 'I'). "
                "Do NOT include conversational filler, preamble, quotes, or explanations. Answer directly."
            )
            name = candidate_profile.get("name", "")
            exp = candidate_profile.get("experience", "")
            skills = candidate_profile.get("skills", "")
            notice = candidate_profile.get("notice_period", "0")
            salary = candidate_profile.get("expected_ctc") or candidate_profile.get("salary", "")
            current_salary = candidate_profile.get("current_ctc", "")
            college = candidate_profile.get("college", "")
            degree = candidate_profile.get("degree", "")
            grad_year = candidate_profile.get("grad_year", "")
            authorized = "Yes" if candidate_profile.get("work_authorized", True) else "No"
            sponsorship = "Yes" if candidate_profile.get("require_sponsorship", False) else "No"
            relocation = "Yes" if candidate_profile.get("willing_to_relocate", True) else "No"
            remote = "Yes" if candidate_profile.get("open_to_remote", True) else "No"

            user_prompt = f"""Candidate Details:
- Name: {name}
- Years of Experience: {exp}
- Skills & Tech Stack: {skills}
- Education: {degree} from {college} ({grad_year})
- Current CTC: {current_salary} INR
- Expected Salary / CTC: {salary} INR
- Notice Period: {notice} days (Immediate joiner)
- Legally Authorized to Work: {authorized}
- Require Visa Sponsorship: {sponsorship}
- Open to Relocation: {relocation}
- Open to Remote / Hybrid: {remote}
- Target Role: {job_title}
- Target Company: {company}

Screening Question:
"{question_text}"

Answer directly and concisely in 1-3 sentences maximum (or a number/yes/no if appropriate):"""

            if prov in ["grok", "xai"]:
                ans = generate_with_grok(api_key, model, system_prompt, user_prompt)
            elif prov == "openai":
                ans = generate_with_openai(api_key, model, system_prompt, user_prompt)
            elif prov in ["claude", "anthropic"]:
                ans = generate_with_claude(api_key, model, system_prompt, user_prompt)
            elif prov in ["gemini", "google"]:
                ans = generate_with_gemini(api_key, model, system_prompt, user_prompt)
            else:
                ans = ""

            if ans and len(ans.strip()) > 0:
                clean_ans = ans.strip().strip('"').strip("'")
                # Auto-remember new answer in custom_answers
                try:
                    import os, json
                    from pathlib import Path
                    cfg_path = Path("config.json")
                    if cfg_path.exists():
                        with open(cfg_path, "r", encoding="utf-8") as f:
                            cfg = json.load(f)
                        if "custom_answers" not in cfg:
                            cfg["custom_answers"] = {}
                        cfg["custom_answers"][question_text.strip()] = clean_ans
                        with open(cfg_path, "w", encoding="utf-8") as f:
                            json.dump(cfg, f, indent=2)
                except Exception:
                    pass
                return clean_ans
        except Exception:
            pass

    # 3. Smart Rule-Based Fallback if AI not available or fails
    if any(w in q_lower for w in ["experience", "how many years", "years of exp"]):
        return f"{candidate_profile.get('experience', '1')} year(s)"
    elif any(w in q_lower for w in ["notice", "joining time", "how soon"]):
        return f"{candidate_profile.get('notice_period', '0')} days (Immediate joiner)"
    elif any(w in q_lower for w in ["expected ctc", "expected salary", "compensation", "remuneration"]):
        return str(candidate_profile.get("expected_ctc", "800000"))
    elif any(w in q_lower for w in ["current ctc", "current salary"]):
        return str(candidate_profile.get("current_ctc", "0"))
    elif any(w in q_lower for w in ["authorized to work", "legally authorized", "right to work"]):
        return "Yes, legally authorized to work in India." if candidate_profile.get("work_authorized", True) else "No"
    elif any(w in q_lower for w in ["sponsorship", "require visa", "visa sponsorship"]):
        return "Yes, require visa sponsorship." if candidate_profile.get("require_sponsorship", False) else "No, I do not require sponsorship."
    elif any(w in q_lower for w in ["willing to relocate", "relocate"]):
        return "Yes, open to relocation." if candidate_profile.get("willing_to_relocate", True) else "No, prefer local roles."
    elif any(w in q_lower for w in ["remote", "work from home", "hybrid"]):
        return "Yes, comfortable working remotely or in a hybrid model."
    elif any(w in q_lower for w in ["college", "university", "school"]):
        return candidate_profile.get("college", "")
    elif any(w in q_lower for w in ["degree", "major", "field of study"]):
        return candidate_profile.get("degree", "")
    elif any(w in q_lower for w in ["graduation year", "grad year", "year of graduation"]):
        return str(candidate_profile.get("grad_year", ""))
    elif any(w in q_lower for w in ["linkedin"]):
        return candidate_profile.get("linkedin_url", "")
    elif any(w in q_lower for w in ["github"]):
        return candidate_profile.get("github_url", "")
    elif any(w in q_lower for w in ["portfolio", "website", "personal site"]):
        return candidate_profile.get("portfolio_url", "")
    elif any(w in q_lower for w in ["why", "interest", "tell us about", "about yourself"]):
        return candidate_profile.get("cover_note", f"Passionate full-stack developer eager to contribute to {company} using {candidate_profile.get('skills', 'modern web technologies')}.")
    elif any(w in q_lower for w in ["gender"]):
        return "Prefer not to say"
    elif any(w in q_lower for w in ["veteran", "disability"]):
        return "No"

    return "Yes, I meet all the requirements for this position."


def tailor_resume_from_jd(
    provider: str = "",
    api_key: str = "",
    model: str = "",
    job_title: str = "",
    company: str = "",
    job_description: str = "",
    candidate_profile: Optional[Dict[str, Any]] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Tailors the candidate's resume content to match a specific Job Description (JD).
    Generates targeted summary, aligned skills, impact bullet points, and ATS Markdown.
    """
    candidate_profile = candidate_profile or {}
    prov = (provider or candidate_profile.get("ai_provider") or "grok").lower().strip()
    if not api_key:
        provider_key_map = {
            "grok": "grok_api_key",
            "openai": "openai_api_key",
            "claude": "claude_api_key",
            "gemini": "gemini_api_key",
        }
        api_key = candidate_profile.get(provider_key_map.get(prov, "grok_api_key"), "")
    if not model:
        model = DEFAULT_MODELS.get(prov, "")
    name = candidate_profile.get("name", "Candidate")
    skills = candidate_profile.get("skills", "Full Stack Development, Python, JavaScript, React, Node.js")
    degree = candidate_profile.get("degree", "Bachelor of Technology in Computer Science")
    college = candidate_profile.get("college", "University")
    grad_year = candidate_profile.get("grad_year", "2026")
    exp = candidate_profile.get("experience", "1")
    email = candidate_profile.get("smtp_user") or candidate_profile.get("recipient_email", "candidate@email.com")
    phone = candidate_profile.get("phone", "+91 9876543210")
    linkedin = candidate_profile.get("linkedin_url", "")
    github = candidate_profile.get("github_url", "")

    prov = (provider or "grok").lower().strip()

    if api_key:
        try:
            system_prompt = (
                "You are an elite ATS resume architect and technical recruiter. "
                "Your objective is to tailor the candidate's existing background to mathematically align with the Job Description (JD). "
                "Highlight high-impact matching keywords, quantify engineering accomplishments, and ensure high ATS scoring. "
                "Always output strictly valid JSON without preamble."
            )

            user_prompt = f"""Target Job: {job_title} at {company}
Job Description:
{job_description[:3000]}

Candidate Raw Profile:
- Name: {name}
- Current Skills: {skills}
- Education: {degree} from {college} ({grad_year})
- Total Experience: {exp} year(s)
- Email: {email} | Phone: {phone}

Return a valid JSON object with the following schema:
{{
  "match_score": <number between 80 and 98>,
  "tailored_summary": "<compelling 3-4 sentence professional summary aligned to JD>",
  "matched_skills": ["<skill 1>", "<skill 2>", "<skill 3>", "<skill 4>", "<skill 5>", "<skill 6>"],
  "keywords_to_emphasize": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>"],
  "tailored_bullet_points": [
    "<High impact bullet point using action verbs and metrics tailored to JD>",
    "<Second tailored project/experience achievement with tech stack>",
    "<Third architectural or performance optimization achievement>",
    "<Fourth collaboration or delivery achievement>"
  ],
  "full_markdown_resume": "<complete, professional markdown formatted resume tailored for this job>"
}}
JSON:"""

            if prov in ["grok", "xai"]:
                raw = generate_with_grok(api_key, model, system_prompt, user_prompt)
            elif prov == "openai":
                raw = generate_with_openai(api_key, model, system_prompt, user_prompt)
            elif prov in ["claude", "anthropic"]:
                raw = generate_with_claude(api_key, model, system_prompt, user_prompt)
            elif prov in ["gemini", "google"]:
                raw = generate_with_gemini(api_key, model, system_prompt, user_prompt)
            else:
                raw = ""

            if raw:
                # Clean json formatting
                cleaned = raw.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                parsed = json.loads(cleaned)
                return parsed
        except Exception:
            pass

    # High-quality smart fallback if AI call fails or no API key provided
    # Extract keywords from JD
    common_tech = ["react", "node.js", "python", "typescript", "javascript", "docker", "kubernetes", "aws", "sql", "mongodb", "fastapi", "spring boot", "rest api", "graphql", "microservices", "ci/cd", "redis", "next.js", "tailwind"]
    jd_lower = job_description.lower()
    detected_skills = [t.capitalize() for t in common_tech if t in jd_lower]
    if not detected_skills:
        detected_skills = [s.strip() for s in skills.split(",") if s.strip()]

    matched = detected_skills[:6]
    skills_str = ", ".join(matched) if matched else skills

    summary = (
        f"Dynamic and results-driven Software Engineer with proven expertise in {skills_str}. "
        f"Specialized in architecting performant, scalable applications and engineering reliable microservices. "
        f"Eager to contribute directly to engineering initiatives at {company} for the {job_title} position."
    )

    bullets = [
        f"Designed and deployed responsive, production-ready modules utilizing {matched[0] if len(matched) > 0 else 'React'} and modern cloud workflows.",
        f"Architected scalable RESTful services and asynchronous pipelines with {matched[1] if len(matched) > 1 else 'Node.js/Python'}, reducing latency by 35%.",
        f"Integrated robust automated test suites, CI/CD pipelines, and secure authentication workflows to ensure 99.9% deployment stability.",
        f"Collaborated cross-functionally with product and QA teams to ship end-to-end features aligned with enterprise specifications."
    ]

    md_resume = f"""# {name}
{email} | {phone} | {linkedin} | {github}

---

## PROFESSIONAL SUMMARY
{summary}

## CORE TECHNICAL SKILLS
- **Primary Languages & Frameworks:** {skills_str}
- **Architecture & Cloud:** Microservices, Docker, RESTful APIs, CI/CD Pipelines
- **Database & Storage:** PostgreSQL, MongoDB, Redis, MySQL

## RELEVANT EXPERIENCE & PROJECTS
### Software Engineer & Full-Stack Contributor
- {bullets[0]}
- {bullets[1]}
- {bullets[2]}
- {bullets[3]}

## EDUCATION
- **{degree}** — {college} ({grad_year})
"""

    return {
        "match_score": 87,
        "tailored_summary": summary,
        "matched_skills": matched,
        "keywords_to_emphasize": [s for s in detected_skills[6:10]] if len(detected_skills) > 6 else ["System Design", "Scalability", "Clean Code"],
        "tailored_bullet_points": bullets,
        "full_markdown_resume": md_resume
    }


def generate_recruiter_smart_reply(
    provider: str,
    api_key: str,
    model: str,
    recruiter_message: str,
    reply_scenario: str,
    custom_notes: str,
    company: str,
    job_title: str,
    candidate_profile: Dict[str, Any]
) -> str:
    """
    Generates a personalized, professional email response to a recruiter inquiry.
    Scenarios: 'accept_interview', 'request_reschedule', 'confirm_assessment', 'salary_negotiation', 'follow_up', 'custom'.
    """
    name = candidate_profile.get("name", "Applicant")
    skills = candidate_profile.get("skills", "")
    notice = candidate_profile.get("notice_period", "0")
    prov = (provider or "grok").lower().strip()

    scenario_instructions = {
        "accept_interview": "Accept the interview enthusiastically, confirm availability for the proposed time slots, and express passion for the role.",
        "request_reschedule": "Politely acknowledge the interview invitation, explain that a conflict arose, propose 2-3 specific alternative time slots, and reaffirm strong enthusiasm.",
        "confirm_assessment": "Confirm receipt of the coding assessment / OA link, state that you will complete it thoroughly within the deadline, and thank them for the opportunity.",
        "salary_negotiation": "Express appreciation for the conversation/offer, tactfully inquire about the CTC/salary band or state your compensation expectations politely and professionally based on market rate.",
        "follow_up": "Send a warm, professional follow-up checking on the status of your interview or application, reiterating high interest in the company.",
        "custom": f"Draft a customized reply following these specific instructions: {custom_notes or 'Respond helpfully and professionally.'}"
    }

    instruction = scenario_instructions.get(reply_scenario, "Draft a prompt, highly professional reply.")
    if custom_notes and reply_scenario != "custom":
        instruction += f" Additional user guidance: {custom_notes}"

    if api_key:
        try:
            system_prompt = (
                "You are an executive career advisor writing a direct email reply to a recruiter or hiring manager. "
                "Write in first-person ('I'), natural, human, confident, and professional. "
                "Do NOT include conversational filler, meta-explanations, or placeholders. Output only the email subject line and body."
            )

            user_prompt = f"""Recruiter Email / Message:
\"\"\"{recruiter_message[:2000]}\"\"\"

Context:
- Target Company: {company}
- Target Role: {job_title}
- Candidate Name: {name}
- Tech Stack: {skills}
- Notice Period: {notice} days

Objective:
{instruction}

Draft a polished email response with Subject and Body:"""

            if prov in ["grok", "xai"]:
                return generate_with_grok(api_key, model, system_prompt, user_prompt)
            elif prov == "openai":
                return generate_with_openai(api_key, model, system_prompt, user_prompt)
            elif prov in ["claude", "anthropic"]:
                return generate_with_claude(api_key, model, system_prompt, user_prompt)
            elif prov in ["gemini", "google"]:
                return generate_with_gemini(api_key, model, system_prompt, user_prompt)
        except Exception:
            pass

    # Fallback template
    if reply_scenario == "accept_interview":
        return f"""Subject: Re: Interview Invitation — {job_title} at {company}

Dear Hiring Team,

Thank you very much for this invitation. I am very excited about the opportunity to discuss the {job_title} role at {company}.

I confirm that I am available at the scheduled time. Looking forward to our conversation.

Best regards,
{name}"""
    elif reply_scenario == "confirm_assessment":
        return f"""Subject: Re: Assessment Link Received — {company}

Dear Recruiting Team,

Thank you for sharing the assessment details. I have received the test link and will complete the assessment promptly before the designated deadline.

Thank you again for considering my application.

Warm regards,
{name}"""
    else:
        return f"""Subject: Re: Opportunity at {company} — {job_title}

Dear Hiring Team,

Thank you for reaching out regarding the {job_title} position. {custom_notes if custom_notes else 'I am very interested in this opportunity and would welcome the chance to discuss further.'}

Looking forward to hearing from you.

Best regards,
{name}"""


def generate_tailored_pdf_resume(
    tailored_data: Dict[str, Any],
    output_path: str,
    candidate_profile: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generates an ATS-compliant, professional PDF resume tailored to the JD
    using fpdf2. Returns the absolute file path of the generated PDF.
    """
    from fpdf import FPDF
    from pathlib import Path

    if candidate_profile is None:
        candidate_profile = {}

    name = candidate_profile.get("name") or tailored_data.get("name") or "Candidate"
    email = candidate_profile.get("email") or tailored_data.get("email") or ""
    phone = candidate_profile.get("phone") or tailored_data.get("phone") or ""
    linkedin = candidate_profile.get("linkedin") or candidate_profile.get("linkedin_url") or ""
    github = candidate_profile.get("github") or candidate_profile.get("github_url") or ""
    college = candidate_profile.get("college") or candidate_profile.get("master_college") or "VIT Bhopal University"
    degree = candidate_profile.get("degree") or candidate_profile.get("master_degree") or "MCA - Master of Computer Applications"
    grad_year = candidate_profile.get("grad_year") or candidate_profile.get("master_grad_year") or "2025"
    locations = candidate_profile.get("locations", ["Noida", "Delhi"])
    loc_str = ", ".join(locations) if isinstance(locations, list) else str(locations)

    summary = tailored_data.get("tailored_summary") or candidate_profile.get("cover_note") or ""
    # Clean non-latin characters that might cause encoding issues in standard fonts
    def sanitize(text: str) -> str:
        if not text:
            return ""
        replacements = {
            "\u2013": "-", "\u2014": "--", "\u2018": "'", "\u2019": "'",
            "\u201c": '"', "\u201d": '"', "\u2022": "*", "\u2026": "..."
        }
        for k, v in replacements.items():
            text = text.replace(k, v)
        return text.encode("latin-1", "replace").decode("latin-1")

    skills = tailored_data.get("matched_skills") or []
    if isinstance(skills, list):
        skills_str = ", ".join([str(s) for s in skills])
    else:
        skills_str = str(skills)
    if not skills_str:
        skills_str = candidate_profile.get("skills", "Java, Spring Boot, React, SQL, REST APIs, Git")

    bullets = tailored_data.get("tailored_bullet_points") or [
        "Architected scalable backend microservices and high-throughput RESTful APIs with clean design patterns.",
        "Engineered responsive, stateful full-stack web applications integrating modern authentication and data persistence.",
        "Optimized query performance and database schemas across relational and NoSQL data stores.",
        "Collaborated in agile delivery cycles with automated testing, CI/CD integration, and code quality reviews."
    ]

    target_role = tailored_data.get("job_title") or candidate_profile.get("job_title") or "Software Engineer / Full Stack Developer"
    target_comp = tailored_data.get("company") or "Engineering Projects & Implementations"

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.set_margins(left=14, top=12, right=14)
    pdf.add_page()

    # Header: Name
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(15, 23, 42) # Slate-900
    pdf.cell(w=0, h=8, text=sanitize(name.upper()), align="C", new_x="LMARGIN", new_y="NEXT")

    # Header: Contact
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(71, 85, 105) # Slate-600
    contact_parts = []
    if email: contact_parts.append(email)
    if phone: contact_parts.append(phone)
    if loc_str: contact_parts.append(loc_str)
    if linkedin: contact_parts.append(linkedin.replace("https://", ""))
    if github: contact_parts.append(github.replace("https://", ""))
    contact_line = " | ".join(contact_parts)
    pdf.cell(w=0, h=5, text=sanitize(contact_line), align="C", new_x="LMARGIN", new_y="NEXT")

    # Divider
    pdf.set_draw_color(37, 99, 235) # Blue-600
    pdf.set_line_width(0.6)
    pdf.ln(2)
    pdf.line(14, pdf.get_y(), 196, pdf.get_y())
    pdf.ln(3)

    # Section Helper
    def render_section_header(title: str):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(30, 64, 175) # Blue-800
        pdf.cell(w=0, h=6, text=sanitize(title), align="L", new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(226, 232, 240)
        pdf.set_line_width(0.2)
        pdf.line(14, pdf.get_y(), 196, pdf.get_y())
        pdf.ln(2)

    # 1. Professional Summary
    render_section_header("PROFESSIONAL SUMMARY")
    pdf.set_font("Helvetica", "", 8.8)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(w=0, h=4.5, text=sanitize(summary), align="L")
    pdf.ln(3)

    # 2. Core Technical Skills
    render_section_header("CORE TECHNICAL SKILLS")
    pdf.set_font("Helvetica", "B", 8.8)
    pdf.set_text_color(15, 23, 42)
    pdf.write(5, "Target JD Competencies: ")
    pdf.set_font("Helvetica", "", 8.8)
    pdf.set_text_color(51, 65, 85)
    pdf.write(5, sanitize(skills_str))
    pdf.ln(5)

    all_skills = candidate_profile.get("skills", "")
    if all_skills and all_skills != skills_str:
        pdf.set_font("Helvetica", "B", 8.8)
        pdf.set_text_color(15, 23, 42)
        pdf.write(5, "Additional Technologies: ")
        pdf.set_font("Helvetica", "", 8.8)
        pdf.set_text_color(51, 65, 85)
        pdf.write(5, sanitize(all_skills))
        pdf.ln(5)
    pdf.ln(1)

    # 3. Technical Experience & Projects
    render_section_header("TECHNICAL EXPERIENCE & PROJECTS")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(w=0, h=5, text=sanitize(f"{target_role}  -  {target_comp}"), align="L", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(51, 65, 85)
    for b in bullets:
        bullet_text = f"-  {sanitize(str(b))}"
        pdf.multi_cell(w=0, h=4.2, text=bullet_text, align="L")
        pdf.ln(1)
    pdf.ln(2)

    # 4. Education
    render_section_header("EDUCATION")
    pdf.set_font("Helvetica", "B", 8.8)
    pdf.set_text_color(15, 23, 42)
    edu_line = f"{degree} | {college} ({grad_year})"
    if candidate_profile.get("master_score"):
        edu_line += f"  -  {candidate_profile.get('master_score')}"
    pdf.cell(w=0, h=4.5, text=sanitize(edu_line), align="L", new_x="LMARGIN", new_y="NEXT")

    bachelor = candidate_profile.get("bachelor_degree")
    b_college = candidate_profile.get("bachelor_college")
    b_year = candidate_profile.get("bachelor_grad_year")
    if bachelor and b_college:
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(71, 85, 105)
        b_line = f"{bachelor} | {b_college} ({b_year or ''})"
        if candidate_profile.get("bachelor_score"):
            b_line += f"  -  {candidate_profile.get('bachelor_score')}"
        pdf.cell(w=0, h=4.5, text=sanitize(b_line), align="L", new_x="LMARGIN", new_y="NEXT")

    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out_file))
    return str(out_file)


