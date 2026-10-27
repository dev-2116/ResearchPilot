from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.endpoints import router as api_router
from app.api.auth import router as auth_router
from app.core.config import ARTIFACTS_DIR, describe_reranker_threshold, settings
from app.db.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    _report_configuration()
    yield


def _describe_database_url(url: str) -> str:
    """Reduce a database URL to its scheme. URLs may embed credentials, so
    the full value (and any userinfo or path) is never printed."""
    if "://" in url:
        scheme = url.split("://", 1)[0]
    elif ":" in url:
        scheme = url.split(":", 1)[0]
    else:
        scheme = "unknown"
    return f"{scheme}://***"


def _report_configuration():
    """Startup configuration report. Reports which variables are set or
    missing, but never prints secret values (keys, passwords, tokens)."""
    llm_status = "set (value hidden)" if settings.LLM_API_KEY else \
        "not set - using built-in heuristic verifier (no external LLM calls)"
    jwt_status = "set (value hidden)" if settings.JWT_SECRET_KEY else \
        "not set - ephemeral random key per process (sessions reset on restart)"
    print(f"[config] {settings.PROJECT_NAME} v{settings.VERSION} starting")
    print(f"[config] DATABASE_URL: {_describe_database_url(settings.DATABASE_URL)}")
    print(f"[config] DEBUG: {settings.DEBUG}")
    print(f"[config] LLM_API_KEY: {llm_status}")
    print(f"[config] LLM_MODEL: {settings.LLM_MODEL}")
    print(f"[config] JWT_SECRET_KEY: {jwt_status}")
    print(f"[config] RERANKER_MODEL: {settings.RERANKER_MODEL} (lazy-loaded on first search)")
    print(f"[config] EMBEDDING_MODEL: {settings.EMBEDDING_MODEL} (lazy-loaded; lexical fallback if unavailable)")
    print(f"[config] MIN_RERANKER_SCORE: {describe_reranker_threshold()}")
    print("[config] See Backend/.env.example for all supported variables.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ResearchPilot: Evidence-Verified Autonomous AI Research Agent API backend.",
    lifespan=lifespan
)

# Enable CORS for Frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(api_router, prefix=settings.API_PREFIX)
app.include_router(auth_router, prefix=settings.API_PREFIX)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ResearchPilot Backend",
        "version": settings.VERSION,
        "database": "sqlite_ready"
    }


# Serve the built frontend (Frontend/dist) when present, so the whole app runs
# from a single origin/port. Mounted AFTER all API routes so /api and /health
# always take priority over static files.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "Frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
