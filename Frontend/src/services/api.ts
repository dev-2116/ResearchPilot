import {
  AcademicPaper,
  AuthUser,
  BenchmarkCase,
  BenchmarkResult,
  Claim,
  Experiment,
  FinalReport,
  LiteratureSearchResult,
  LiteratureSourceInfo,
  LoginPayload,
  RegisterPayload,
  ResearchTask,
  Run,
} from '../types';

const API_BASE = '/api';

export const api = {
  // Tasks
  async createTask(payload: {
    question: string;
    domain?: string;
    constraints?: string;
    execution_mode?: string;
  }): Promise<ResearchTask> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`);
    return res.json();
  },

  async listTasks(): Promise<ResearchTask[]> {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error(`Failed to list tasks: ${res.statusText}`);
    return res.json();
  },

  async getTask(id: string): Promise<ResearchTask> {
    const res = await fetch(`${API_BASE}/tasks/${id}`);
    if (!res.ok) throw new Error(`Failed to get task: ${res.statusText}`);
    return res.json();
  },

  // Runs
  async startRun(taskId: string, execution_mode: string = 'autonomous'): Promise<Run> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execution_mode }),
    });
    if (!res.ok) throw new Error(`Failed to start run: ${res.statusText}`);
    return res.json();
  },

  async getRun(runId: string): Promise<Run> {
    const res = await fetch(`${API_BASE}/runs/${runId}`);
    if (!res.ok) throw new Error(`Failed to get run: ${res.statusText}`);
    return res.json();
  },

  async getRunEvidence(runId: string): Promise<Claim[]> {
    const res = await fetch(`${API_BASE}/runs/${runId}/evidence`);
    if (!res.ok) throw new Error(`Failed to get evidence: ${res.statusText}`);
    return res.json();
  },

  async getRunExperiment(runId: string): Promise<Experiment | null> {
    const res = await fetch(`${API_BASE}/runs/${runId}/experiments`);
    if (!res.ok) throw new Error(`Failed to get experiment: ${res.statusText}`);
    return res.json();
  },

  async approveGatedRun(runId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/runs/${runId}/approve`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to approve run: ${res.statusText}`);
    return res.json();
  },

  async reexecuteExperiment(expId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/experiments/${expId}/execute`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to execute experiment: ${res.statusText}`);
    return res.json();
  },

  async getFinalReport(runId: string): Promise<FinalReport> {
    const res = await fetch(`${API_BASE}/runs/${runId}/report`);
    if (!res.ok) throw new Error(`Failed to get report: ${res.statusText}`);
    return res.json();
  },

  // Benchmarks
  async runBenchmark(casesLimit: number = 5, models?: string[]): Promise<BenchmarkResult> {
    const res = await fetch(`${API_BASE}/benchmarks/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cases_limit: casesLimit,
        models_to_compare: models,
      }),
    });
    if (!res.ok) throw new Error(`Failed to run benchmark: ${res.statusText}`);
    return res.json();
  },

  async getBenchmarkCases(): Promise<BenchmarkCase[]> {
    const res = await fetch(`${API_BASE}/benchmarks/cases`);
    if (!res.ok) throw new Error(`Failed to get benchmark cases: ${res.statusText}`);
    return res.json();
  },

  async searchCorpus(query: string, useExternal: boolean = false): Promise<any> {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&use_external=${useExternal}`);
    if (!res.ok) throw new Error(`Failed to search corpus: ${res.statusText}`);
    return res.json();
  },

  // Academic Literature APIs (Semantic Scholar, OpenAlex, Crossref)
  async getLiteratureSources(): Promise<{ sources: LiteratureSourceInfo[] }> {
    const res = await fetch(`${API_BASE}/literature/sources`);
    if (!res.ok) throw new Error(`Failed to fetch literature sources: ${res.statusText}`);
    return res.json();
  },

  async searchLiterature(query: string, sources?: string[], limit: number = 6): Promise<LiteratureSearchResult> {
    let url = `${API_BASE}/literature/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    if (sources && sources.length > 0) {
      url += `&sources=${encodeURIComponent(sources.join(','))}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to search academic literature: ${res.statusText}`);
    return res.json();
  },

  async importLiteraturePapers(papers: AcademicPaper[]): Promise<{ status: string; ingested_count: number; total_active_papers: number; message: string }> {
    const res = await fetch(`${API_BASE}/literature/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ papers }),
    });
    if (!res.ok) throw new Error(`Failed to import papers into corpus: ${res.statusText}`);
    return res.json();
  },


  // Core Prototype
  async getMidSemQuestions(): Promise<{
    milestone: string;
    description: string;
    supported_count: number;
    questions: any[];
  }> {
    const res = await fetch(`${API_BASE}/midsem/questions`);
    if (!res.ok) throw new Error(`Failed to fetch midsem questions: ${res.statusText}`);
    return res.json();
  },

  async validateMidSemQuery(question: string): Promise<{
    is_supported: boolean;
    matched_question?: any;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/midsem/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error(`Failed to validate query: ${res.statusText}`);
    return res.json();
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  async register(payload: RegisterPayload): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  async login(payload: LoginPayload): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  async getMe(token: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },
};
