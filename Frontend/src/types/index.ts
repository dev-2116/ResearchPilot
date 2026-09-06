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
