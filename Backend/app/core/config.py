import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel


def _getenv_optional_float(name: str) -> Optional[float]:
    """Read an optional float env var.

    Unset or empty -> None (feature disabled). A set but unparseable value is a
    configuration error and fails fast with a clear message instead of being
    silently ignored.
    """
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(
            f"Environment variable {name}={raw!r} is not a valid float. "
            "Leave it unset to disable the feature, or set a numeric value."
        ) from exc

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

    # ── Retrieval: dense embeddings ─────────────────────────────────────
    # Semantic embedding model for the dense retrieval stage. If the model
    # cannot be loaded (e.g. offline environment) the retriever falls back to
    # the built-in lexical-overlap scorer and records this in results via the
    # `embedding_backend` field.
    EMBEDDING_MODEL: str = os.getenv(
        "RESEARCHPILOT_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )

    # ── Retrieval: cross-encoder reranking ──────────────────────────────
    # The reranker refines ONLY the candidate set produced by BM25 + dense
    # retrieval + RRF fusion; the full corpus is never reranked. The model is
    # loaded lazily on first use, never at import time.
    RERANKER_MODEL: str = os.getenv(
        "RESEARCHPILOT_RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
    )
    RERANKER_ENABLED: bool = _getenv_bool("RESEARCHPILOT_RERANKER_ENABLED", "True")
    # Number of fused candidates (post per-paper cap) forwarded to the reranker.
    RERANKER_CANDIDATES: int = int(os.getenv("RESEARCHPILOT_RERANKER_CANDIDATES", "25"))
    # Maximum chunks allowed per paper in the candidate set and final results
    # (prevents any single paper from dominating the ranking).
    RERANKER_MAX_PER_PAPER: int = int(os.getenv("RESEARCHPILOT_RERANKER_MAX_PER_PAPER", "2"))
    # Batch size for cross-encoder inference.
    RERANKER_BATCH_SIZE: int = int(os.getenv("RESEARCHPILOT_RERANKER_BATCH_SIZE", "16"))
    # Minimum reranker score (raw logit) for a result to be returned.
    # NO default: unset means no threshold filtering. Set it only to a value
    # produced by the calibration workflow (see Backend/eval/labels/README.md
    # and docs/retrieval_reranking.md) for the SAME reranker model.
    MIN_RERANKER_SCORE: Optional[float] = _getenv_optional_float(
        "RESEARCHPILOT_MIN_RERANKER_SCORE"
    )

settings = Settings()


def describe_reranker_threshold() -> str:
    """Human-readable, secret-free description of the configured threshold."""
    if settings.MIN_RERANKER_SCORE is None:
        return "not set - no threshold filtering (results ranked by reranker score)"
    return (
        f"{settings.MIN_RERANKER_SCORE} (raw cross-encoder logit; "
        "must match the reranker model used at calibration time)"
    )
