export type ExecutionMode = 'autonomous' | 'gated';
export type RunStatus = 'PENDING' | 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED';
export type VerificationStatus = 'SUPPORTED' | 'REFUTED' | 'INSUFFICIENT_EVIDENCE' | 'UNVERIFIED';

export interface ResearchTask {
  id: string;
  question: string;
  domain: string;
  constraints?: string;
  execution_mode: ExecutionMode;
  status: string;
  created_at: string;
}

export interface AgentStep {
  id: string;
  run_id: string;
  step_index: number;
  step_type: string;
  input: Record<string, any>;
  output: Record<string, any>;
  status: string;
  latency_ms: number;
  token_usage: number;
  error_message?: string;
  created_at: string;
}

export interface ClaimEvidence {
  id: string;
  claim_id: string;
  chunk_id: string;
  document_title: string;
  document_authors: string;
  document_identifier: string;
  passage_text: string;
  support_score: number;
  entailment_type: 'ENTAILED' | 'CONTRADICTION' | 'NEUTRAL';
  retrieval_score: number;
}

export interface Claim {
  id: string;
  run_id: string;
  text: string;
  confidence: number;
  verification_status: VerificationStatus;
  explanation: string;
  evidence: ClaimEvidence[];
}

export interface Metric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  baseline_value?: number;
  delta_percentage?: number;
}

export interface Experiment {
  id: string;
  run_id: string;
  hypothesis: string;
  variables: Record<string, any>;
  baseline_method: string;
  proposed_method: string;
  code: string;
  status: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  duration_ms?: number;
  metrics: Metric[];
  manifest?: Record<string, any>;
  chart_url?: string;
}

export interface Run {
  run_id: string;
  task_id: string;
  status: RunStatus;
  current_step: string;
  progress: number;
  execution_mode: ExecutionMode;
  started_at: string;
  ended_at?: string;
  cost: {
    tokens: number;
    usd: number;
  };
  evidence_count: number;
  claims_count: number;
  steps: AgentStep[];
  latest_error?: string;
}

export interface FinalReport {
  run_id: string;
  task_question: string;
  title: string;
  executive_summary: string;
  methodology: string;
  evidence_synthesis: Array<{
    claim_id: string;
    claim_text: string;
    confidence: number;
    status: VerificationStatus;
    explanation: string;
    supporting_passages: Array<{
      document_title: string;
      identifier: string;
      passage: string;
      support_score: number;
      entailment: string;
    }>;
  }>;
  experiment_results?: {
    hypothesis: string;
    baseline_method: string;
    proposed_method: string;
    metrics: Metric[];
    manifest?: Record<string, any>;
    chart_url?: string;
    status: string;
  };
  limitations: string[];
  citations: Array<{
    id: string;
    title: string;
    authors: string;
    venue: string;
    support_score: number;
  }>;
  provenance_hash: string;
  generated_at: string;
}

export interface BenchmarkCase {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  ground_truth_claims: string[];
  expected_metrics: Record<string, number>;
}

export interface BenchmarkResult {
  benchmark_id: string;
  name: string;
  timestamp: string;
  models: string[];
  metrics: Record<string, Record<string, number>>;
  case_results: Array<{
    case_id: string;
    category: string;
    difficulty: string;
    question: string;
    standard_llm_score: number;
    basic_rag_score: number;
    agentic_rag_score: number;
    researchpilot_score: number;
    evidence_grounded: boolean;
  }>;
  summary: string;
}

export interface BenchmarkHistoryEntry {
  id: string;
  benchmark_id: string;
  timestamp: string;
  results: BenchmarkResult;
}

export interface MidSemQuestion {
  id: string;
  short_title: string;
  category: string;
  question: string;
  keywords: string[];
  direct_answer: string;
  key_claims: string[];
  cited_documents: Array<{
    doc_id: string;
    title: string;
    authors: string;
    identifier: string;
    venue: string;
    passage: string;
  }>;
}

export interface MidSemQuestionsResponse {
  milestone: string;
  description: string;
  supported_count: number;
  questions: MidSemQuestion[];
}

export interface MidSemValidationResult {
  is_supported: boolean;
  matched_question?: MidSemQuestion;
  message: string;
}

// ── Auth Types ────────────────────────────────────────────────────────────────

export interface AuthUser {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  access_token: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ── Academic Literature & Multi-Source API Types ──────────────────────────────

export interface ExternalPaperChunk {
  chunk_id: string;
  text: string;
  chunk_index: number;
}

export interface AcademicPaper {
  id: string;
  title: string;
  authors: string;
  publication_year: number;
  venue: string;
  abstract: string;
  identifier: string;
  url: string;
  citation_count: number;
  source: 'Semantic Scholar' | 'OpenAlex' | 'Crossref' | string;
  source_id?: string;
  chunks?: ExternalPaperChunk[];
}

export interface LiteratureSourceInfo {
  id: string;
  name: string;
  description: string;
  status: string;
  requires_api_key: boolean;
  has_api_key: boolean;
  badge: string;
}

export interface LiteratureSearchResult {
  query: string;
  total_found: number;
  sources_queried: string[];
  source_counts: Record<string, number>;
  papers: AcademicPaper[];
}

// ── Dashboard statistics (real aggregates from the backend) ──────────────────

export interface DashboardStats {
  tasks_total: number;
  runs_total: number;
  runs_completed: number;
  runs_failed: number;
  runs_active: number;
  claims_total: number;
  claims_supported: number;
  claims_refuted: number;
  claims_insufficient: number;
  experiments_total: number;
  experiments_completed: number;
  reports_total: number;
  documents_total: number;
  chunks_total: number;
  corpus_active: number;
  benchmark_runs_total: number;
  saved_papers_total: number;
  task_status_distribution: Array<{ status: string; count: number }>;
  task_domain_distribution: Array<{ domain: string; count: number }>;
  activity_daily: Array<{ date: string; tasks: number }>;
  recent_tasks: ResearchTask[];
}

export interface HistoryEntry extends ResearchTask {
  run_count: number;
  latest_run_status: string | null;
  latest_run_id: string | null;
  latest_claims_count: number | null;
  latest_evidence_count: number | null;
  report_count: number;
}

export interface TaskRunSummary {
  run_id: string;
  task_id: string;
  status: string;
  current_step: string;
  progress: number;
  execution_mode: string;
  started_at: string;
  ended_at?: string | null;
  cost: { tokens: number; usd: number };
  evidence_count: number;
  claims_count: number;
  latest_error?: string | null;
}

export interface SavedPaper {
  id: string;
  user_id: string;
  title: string;
  authors?: string | null;
  publication_year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  identifier?: string | null;
  url?: string | null;
  source?: string | null;
  citation_count: number;
  saved_at: string;
}

