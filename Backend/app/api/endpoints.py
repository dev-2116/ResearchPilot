import asyncio
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import ARTIFACTS_DIR
from app.db.database import DB
from app.models.schemas import (
    AgentStepResponse,
    ArtifactResponse,
    BenchmarkResultResponse,
    BenchmarkRunRequest,
    ClaimResponse,
    ExperimentResponse,
    FinalReportResponse,
    RunCreateRequest,
    RunResponse,
    TaskCreateRequest,
    TaskResponse,
)
from app.services.benchmark import benchmark_service, BENCHMARK_SUITE_V1
from app.services.corpus import PRELOADED_PAPERS
from app.services.orchestrator import orchestrator
from app.services.retrieval import hybrid_retriever
from app.services.sandbox import experiment_sandbox

router = APIRouter()

# --- Tasks ---
@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(req: TaskCreateRequest):
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    created_task = DB.create_task(
        task_id=task_id,
        question=req.question,
        domain=req.domain or "AI/ML",
        constraints=req.constraints,
        execution_mode=req.execution_mode or "autonomous"
    )
    return TaskResponse(**created_task)

@router.get("/tasks", response_model=List[TaskResponse])
def list_tasks():
    tasks = DB.list_tasks()
    return [TaskResponse(**t) for t in tasks]

@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: str):
    t = DB.get_task(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(**t)

# --- Runs ---
@router.post("/tasks/{task_id}/runs", response_model=RunResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_run(task_id: str, req: RunCreateRequest, background_tasks: BackgroundTasks):
    task = DB.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    mode = req.execution_mode or task.get("execution_mode", "autonomous")
    created_run = DB.create_run(run_id=run_id, task_id=task_id, execution_mode=mode)
    
    # Launch async orchestration task
    background_tasks.add_task(orchestrator.execute_run_async, run_id, task_id, mode)
    
    return RunResponse(**created_run)

@router.get("/runs/{run_id}", response_model=RunResponse)
def get_run_status(run_id: str):
    r = DB.get_run(run_id)
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunResponse(**r)

@router.get("/runs/{run_id}/trace", response_model=List[AgentStepResponse])
def get_run_trace(run_id: str):
    r = DB.get_run(run_id)
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")
    return [AgentStepResponse(**s) for s in r.get("steps", [])]

@router.get("/runs/{run_id}/evidence", response_model=List[ClaimResponse])
def get_run_evidence(run_id: str):
    claims = DB.get_run_claims(run_id)
    return [ClaimResponse(**c) for c in claims]

@router.post("/runs/{run_id}/approve")
def approve_gated_run(run_id: str):
    success = orchestrator.approve_gated_run(run_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot approve run. Ensure it exists and is in WAITING_APPROVAL state.")
    return {"status": "APPROVED", "message": f"Run {run_id} approved for experiment execution."}

# --- Experiments ---
@router.get("/runs/{run_id}/experiments", response_model=Optional[ExperimentResponse])
def get_run_experiment(run_id: str):
    exp = DB.get_run_experiment(run_id)
    if not exp:
        return None
    return ExperimentResponse(**exp)

@router.post("/experiments/{experiment_id}/execute")
def reexecute_experiment(experiment_id: str):
    # Search for experiment
    conn = DB.get_connection()
    row = conn.execute("SELECT * FROM experiments WHERE id = ?", (experiment_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    exp_data = dict(row)
    run_id = exp_data["run_id"]
    code = exp_data["code"]
    import json
    variables = json.loads(exp_data["variables_json"]) if exp_data["variables_json"] else {}
    
    res = experiment_sandbox.execute_in_sandbox(code, run_id, experiment_id, variables)
    return res

# --- Reports & Artifacts ---
@router.get("/runs/{run_id}/report", response_model=FinalReportResponse)
def get_final_report(run_id: str):
    rep = DB.get_report(run_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not generated yet for this run")
    return FinalReportResponse(**rep)

@router.get("/runs/{run_id}/artifacts", response_model=List[ArtifactResponse])
def list_run_artifacts(run_id: str):
    artifacts = DB.get_run_artifacts(run_id)
    return [ArtifactResponse(**a) for a in artifacts]

@router.get("/artifacts/{run_id}/{filename}")
def get_artifact_file(run_id: str, filename: str):
    file_path = ARTIFACTS_DIR / run_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Artifact file not found")
    return FileResponse(path=str(file_path))

# --- Benchmarks & Corpus ---
@router.post("/benchmarks/run", response_model=BenchmarkResultResponse)
def run_benchmark(req: BenchmarkRunRequest):
    results = benchmark_service.run_benchmark(
        cases_limit=req.cases_limit or 5,
        models=req.models_to_compare
    )
    return BenchmarkResultResponse(**results)

@router.get("/benchmarks/cases")
def list_benchmark_cases():
    return BENCHMARK_SUITE_V1

@router.get("/corpus")
def list_corpus_documents():
    return hybrid_retriever.get_all_papers()

@router.get("/search")
async def search_literature(
    q: str = Query(..., min_length=2),
    top_k: int = 5,
    use_external: bool = False
):
    if use_external:
        results = await hybrid_retriever.search_with_live_fallback(query=q, top_k=top_k, fetch_external=True)
    else:
        results = hybrid_retriever.search(query=q, top_k=top_k)
    return {"query": q, "count": len(results), "results": results}

# --- Multi-Source External Academic Literature (Semantic Scholar, OpenAlex, Crossref) ---
from app.services.paper_fetcher import paper_aggregator

@router.get("/literature/sources")
def get_literature_sources():
    """Return status and info about the connected academic data sources."""
    from app.core.config import settings
    return {
        "sources": [
            {
                "id": "openalex",
                "name": "OpenAlex API",
                "description": "Comprehensive, fully open scholarly index of 250M+ research works with citation graphs and inverted abstracts.",
                "status": "connected",
                "requires_api_key": False,
                "has_api_key": True,
                "badge": "Open Index"
            },
            {
                "id": "crossref",
                "name": "Crossref API",
                "description": "Official global DOI registry with 150M+ peer-reviewed journal articles, books, and proceedings.",
                "status": "connected",
                "requires_api_key": False,
                "has_api_key": True,
                "badge": "Official DOIs"
            },
            {
                "id": "semanticscholar",
                "name": "Semantic Scholar API",
                "description": "AI-powered scientific research graph by Allen Institute for AI (S2AG) covering 200M+ publications.",
                "status": "connected",
                "requires_api_key": False,
                "has_api_key": bool(getattr(settings, "SEMANTIC_SCHOLAR_API_KEY", "")),
                "badge": "AI Research Graph"
            }
        ]
    }

@router.get("/literature/search")
async def search_external_literature(
    q: str = Query(..., min_length=2, description="Search query e.g. RAG, neural embeddings"),
    sources: Optional[str] = Query(None, description="Comma-separated: semanticscholar,openalex,crossref"),
    limit: int = Query(5, ge=1, le=25)
):
    """
    Simultaneously search across Semantic Scholar, OpenAlex, and Crossref APIs.
    Deduplicates results and generates RAG-ready text passages.
    """
    src_list = [s.strip().lower() for s in sources.split(",")] if sources else None
    res = await paper_aggregator.search(query=q, sources=src_list, limit_per_source=limit)
    return res

@router.post("/literature/import")
def import_literature_papers(payload: Dict[str, Any]):
    """
    Imports selected papers fetched from external APIs into the in-memory
    retrieval corpus so they are used for evidence extraction and claim verification.
    """
    papers = payload.get("papers", [])
    if not papers:
        raise HTTPException(status_code=400, detail="No papers provided in payload")

    ingested = hybrid_retriever.ingest_papers(papers)
    return {
        "status": "success",
        "ingested_count": ingested,
        "total_active_papers": len(hybrid_retriever.papers),
        "message": f"Successfully ingested {ingested} papers into active research corpus."
    }

# --- Core Prototype Benchmark Endpoints ---
from app.services.midsem_qa import APPROVED_MIDSEM_QUESTIONS, validate_and_match_question

@router.get("/midsem/questions")
def get_midsem_questions():
    """
    Returns the 4 verified benchmark research questions for the core prototype.
    """
    return {
        "milestone": "Core Evidence Prototype",
        "description": "ResearchPilot is currently configured with 4 verified foundational research questions.",
        "supported_count": len(APPROVED_MIDSEM_QUESTIONS),
        "questions": APPROVED_MIDSEM_QUESTIONS
    }

@router.post("/midsem/validate")
def validate_midsem_query(payload: Dict[str, str]):
    """
    Validates if an arbitrary query is supported under the current prototype scope.
    """
    q = payload.get("question", "")
    is_supported, matched, msg = validate_and_match_question(q)
    return {
        "is_supported": is_supported,
        "matched_question": matched,
        "message": msg
    }

