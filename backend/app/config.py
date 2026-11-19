import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'roster.db'}")
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"
DEFAULT_MONTH = os.getenv("DEFAULT_MONTH", "2026-12")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
