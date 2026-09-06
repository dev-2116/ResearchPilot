import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Pydantic Schemas for API Requests and Responses

class TaskCreateRequest(BaseModel):
    question: str
    domain: Optional[str] = "Artificial Intelligence"
    constraints: Optional[str] = None
    execution_mode: Optional[str] = "autonomous"  # "autonomous" or "gated"
    dataset_name: Optional[str] = "Academic Papers Corpus (CS & AI)"
    model_name: Optional[str] = "ResearchPilot-Reasoner-v1"

class TaskResponse(BaseModel):
    id: str
    question: str
    domain: str
    constraints: Optional[str] = None
    execution_mode: str
    status: str
    created_at: str

class RunCreateRequest(BaseModel):
    execution_mode: Optional[str] = "autonomous"  # "autonomous" or "gated"
    parameters: Optional[Dict[str, Any]] = None

class AgentStepResponse(BaseModel):
    id: str
    run_id: str
    step_index: int
    step_type: str
    input: Dict[str, Any]
    output: Dict[str, Any]
    status: str
    latency_ms: int
    token_usage: int
    error_message: Optional[str] = None
    created_at: str

class ClaimEvidenceResponse(BaseModel):
    id: str
    claim_id: str
    chunk_id: str
    document_title: str
    document_authors: str
    document_identifier: str
    passage_text: str
    support_score: float
    entailment_type: str  # "ENTAILED", "CONTRADICTION", "NEUTRAL"
    retrieval_score: float

class ClaimResponse(BaseModel):
    id: str
    run_id: str
    text: str
    confidence: float
    verification_status: str  # "SUPPORTED", "REFUTED", "UNVERIFIED", "INSUFFICIENT_EVIDENCE"
    explanation: str
    evidence: List[ClaimEvidenceResponse] = []

class MetricResponse(BaseModel):
    id: str
    name: str
    value: float
    unit: Optional[str] = None
    baseline_value: Optional[float] = None
    delta_percentage: Optional[float] = None

class ArtifactResponse(BaseModel):
    id: str
    run_id: str
    name: str
    path: str
    type: str  # "chart", "code", "manifest", "json", "report"
    hash: str
    file_size: int
    created_at: str

class ExperimentResponse(BaseModel):
    id: str
    run_id: str
    hypothesis: str
    variables: Dict[str, Any]
    baseline_method: str
    proposed_method: str
    code: str
    status: str
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    exit_code: Optional[int] = None
    duration_ms: Optional[int] = None
    metrics: List[MetricResponse] = []
    manifest: Optional[Dict[str, Any]] = None
    chart_url: Optional[str] = None

class RunResponse(BaseModel):
    run_id: str
    task_id: str
    status: str  # "PENDING", "RUNNING", "WAITING_APPROVAL", "COMPLETED", "FAILED"
    current_step: str
    progress: float  # 0.0 to 1.0
    execution_mode: str
    started_at: str
    ended_at: Optional[str] = None
    cost: Dict[str, Any]
    evidence_count: int
    claims_count: int
    steps: List[AgentStepResponse] = []
    latest_error: Optional[str] = None

class FinalReportResponse(BaseModel):
    run_id: str
    task_question: str
    title: str
    executive_summary: str
    methodology: str
    evidence_synthesis: List[Dict[str, Any]]
    experiment_results: Optional[Dict[str, Any]] = None
    limitations: List[str]
    citations: List[Dict[str, Any]]
    provenance_hash: str
    generated_at: str

class BenchmarkRunRequest(BaseModel):
    benchmark_id: Optional[str] = "bench_core_v1"
    cases_limit: Optional[int] = 5
    models_to_compare: Optional[List[str]] = ["standard_llm", "basic_rag", "agentic_rag", "researchpilot"]

class BenchmarkResultResponse(BaseModel):
    benchmark_id: str
    name: str
    timestamp: str
    models: List[str]
    metrics: Dict[str, Dict[str, float]]  # model -> metric -> value
    case_results: List[Dict[str, Any]]
    summary: str
