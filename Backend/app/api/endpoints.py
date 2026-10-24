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
    return PRELOADED_PAPERS

@router.get("/search")
def search_literature(q: str = Query(..., min_length=2), top_k: int = 5):
    results = hybrid_retriever.search(query=q, top_k=top_k)
    return {"query": q, "count": len(results), "results": results}

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

