import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
DOCS_DIR = DATA_DIR / "documents"

DATA_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# Load Backend/.env when present (git-ignored; see Backend/.env.example).
# Values are only defaults: real environment variables take precedence.
load_dotenv(BASE_DIR / ".env")


def _getenv_bool(name: str, default: str) -> bool:
    return os.getenv(name, default).lower() == "true"


class Settings(BaseModel):
    PROJECT_NAME: str = "ResearchPilot API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    # May embed credentials in real deployments — never log the full value.
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/researchpilot.db")
    DEBUG: bool = _getenv_bool("DEBUG", "True")
    DEFAULT_TIMEOUT_SECONDS: int = 20
    DEFAULT_MAX_STEPS: int = 15
    # Reserved for wiring an external LLM provider (e.g. Gemini) into the
    # verification step. The built-in heuristic verifier makes no external
    # calls. This value must never be printed or logged.
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "researchpilot-verifier-v1")
    # JWT signing. If JWT_SECRET_KEY is not configured the API generates an
    # ephemeral random key per process (sessions reset on restart) and says so.
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")

settings = Settings()
