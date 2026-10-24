from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.endpoints import router as api_router
from app.api.auth import router as auth_router
from app.core.config import ARTIFACTS_DIR, settings
from app.db.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    yield

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
