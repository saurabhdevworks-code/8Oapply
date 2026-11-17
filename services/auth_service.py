import os
import sqlite3
import hashlib
import secrets
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
DB_FILE = BASE_DIR / "users.db"
USERS_DATA_DIR = BASE_DIR / "data" / "users"
TEMPLATE_CONFIG_FILE = BASE_DIR / "config.json"


def get_db():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    USERS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        conn.commit()


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return hashed, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    hashed, _ = hash_password(password, salt)
    return secrets.compare_digest(hashed, password_hash)


def get_user_paths(user_id: int) -> Dict[str, Path]:
    user_dir = USERS_DATA_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    cookies_dir = user_dir / "cookies"
    cookies_dir.mkdir(parents=True, exist_ok=True)
    return {
        "dir": user_dir,
        "config_file": user_dir / "config.json",
        "csv_file": user_dir / "applied_jobs.csv",
        "resume_file": user_dir / "resume.pdf",
        "collected_file": user_dir / "collected_jobs.json",
        "custom_answers_file": user_dir / "custom_answers.json",
        "responses_file": user_dir / "responses.json",
        "cookies_dir": cookies_dir,
    }


def init_user_workspace(user_id: int, name: str, email: str):
    paths = get_user_paths(user_id)

    # 1. Config file
    if not paths["config_file"].exists():
        base_cfg = {}
        if TEMPLATE_CONFIG_FILE.exists():
            try:
                with open(TEMPLATE_CONFIG_FILE, "r", encoding="utf-8") as f:
                    base_cfg = json.load(f)
            except Exception:
                base_cfg = {}

        # Reset profile fields cleanly with user's name & email
        base_cfg["name"] = name
        base_cfg["email"] = email
        base_cfg["phone"] = ""
        base_cfg["current_city"] = ""
        base_cfg["experience"] = ""
        base_cfg["current_company"] = ""
        base_cfg["current_role"] = ""
        base_cfg["master_college"] = ""
        base_cfg["master_degree"] = ""
        base_cfg["master_grad_year"] = ""
        base_cfg["bachelor_college"] = ""
        base_cfg["bachelor_degree"] = ""
        base_cfg["bachelor_grad_year"] = ""
        base_cfg["college"] = ""
        base_cfg["degree"] = ""
        base_cfg["grad_year"] = ""
        base_cfg["skills"] = ""
        base_cfg["cover_note"] = ""
        base_cfg["job_titles"] = []
        base_cfg["locations"] = []

        # Reset all platform connections and toggles to completely clean state
        platforms_list = ["linkedin", "naukri", "indeed", "glassdoor", "internshala", "shine", "foundit", "timesjobs", "wellfound", "others"]
        for p in platforms_list:
            base_cfg[f"connected_{p}"] = False
            base_cfg[f"use_{p}"] = False
            base_cfg[f"{p}_email"] = ""
            base_cfg[f"{p}_password"] = ""
            base_cfg[f"auth_google_{p}"] = False
        base_cfg["gmail_connected"] = False

        with open(paths["config_file"], "w", encoding="utf-8") as f:
            json.dump(base_cfg, f, indent=2)

    # 2. Applied jobs CSV
    if not paths["csv_file"].exists():
        with open(paths["csv_file"], "w", encoding="utf-8", newline="") as f:
            f.write("date,platform,job_title,company,job_id,url\n")

    # 3. Collected jobs JSON
    if not paths["collected_file"].exists():
        with open(paths["collected_file"], "w", encoding="utf-8") as f:
            f.write("[]")

    # 4. Custom answers JSON
    if not paths["custom_answers_file"].exists():
        with open(paths["custom_answers_file"], "w", encoding="utf-8") as f:
            f.write("{}")

    # 5. Responses JSON
    if not paths["responses_file"].exists():
        with open(paths["responses_file"], "w", encoding="utf-8") as f:
            f.write("[]")


def register_user(email: str, password: str, name: str) -> Dict[str, Any]:
    email = email.strip().lower()
    name = name.strip()

    if not email or "@" not in email:
        raise ValueError("Please provide a valid email address.")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters long.")
    if not name:
        name = email.split("@")[0].title()

    pwd_hash, salt = hash_password(password)
    now_str = datetime.utcnow().isoformat()

    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO users (email, password_hash, salt, name, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (email, pwd_hash, salt, name, now_str))
            user_id = cur.lastrowid

            token = secrets.token_urlsafe(32)
            cur.execute("""
                INSERT INTO tokens (token, user_id, created_at)
                VALUES (?, ?, ?)
            """, (token, user_id, now_str))
            conn.commit()
    except sqlite3.IntegrityError:
        raise ValueError("An account with this email address already exists. Please log in.")

    # Initialize isolated workspace for this user
    init_user_workspace(user_id, name, email)

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "name": name,
        }
    }


def login_user(email: str, password: str) -> Dict[str, Any]:
    email = email.strip().lower()
    if not email or not password:
        raise ValueError("Please enter both email and password.")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cur.fetchone()

        if not row:
            raise ValueError("No account found with this email address.")

        if not verify_password(password, row["password_hash"], row["salt"]):
            raise ValueError("Incorrect password. Please try again.")

        token = secrets.token_urlsafe(32)
        now_str = datetime.utcnow().isoformat()
        cur.execute("""
            INSERT INTO tokens (token, user_id, created_at)
            VALUES (?, ?, ?)
        """, (token, row["id"], now_str))
        conn.commit()

        # Ensure user workspace exists
        init_user_workspace(row["id"], row["name"], row["email"])

        return {
            "token": token,
            "user": {
                "id": row["id"],
                "email": row["email"],
                "name": row["name"],
            }
        }


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.email, u.name, u.created_at
            FROM tokens t
            JOIN users u ON t.user_id = u.id
            WHERE t.token = ?
        """, (token,))
        row = cur.fetchone()
        if row:
            return {
                "id": row["id"],
                "email": row["email"],
                "name": row["name"],
                "created_at": row["created_at"],
            }
    return None


def logout_user(token: str):
    if not token:
        return
    with get_db() as conn:
        conn.execute("DELETE FROM tokens WHERE token = ?", (token,))
        conn.commit()


# Initialize database on module load
init_db()
