import {
  AcademicPaper,
  AuthUser,
  BenchmarkCase,
  BenchmarkHistoryEntry,
  BenchmarkResult,
  Claim,
  DashboardStats,
  Experiment,
  FinalReport,
  HistoryEntry,
  LiteratureSearchResult,
  LiteratureSourceInfo,
  LoginPayload,
  MonthlyInvestigation,
  RegisterPayload,
  ResearchTask,
  Run,
  SavedPaper,
  TaskRunSummary,
} from '../types';

const DEFAULT_API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || '/api';
let currentApiBase = DEFAULT_API_BASE;
const TOKEN_KEY = 'rp_auth_token';

/** Attach the JWT to every request when a session token exists. Requests
 * without a token behave exactly as before (shared local user). */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** Robust API requester with error extraction and auto-fallback to direct backend */
async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${currentApiBase}${cleanEndpoint}`;

  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || err.message || `Request failed with status ${res.status} (${res.statusText})`);
    }
    return await res.json();
  } catch (err: any) {
    // If failed to fetch and currentApiBase is relative /api, attempt fallback directly to http://127.0.0.1:8000/api
    const isNetworkError =
      err instanceof TypeError ||
      String(err).includes('Failed to fetch') ||
      String(err).includes('NetworkError') ||
      String(err).includes('network error');

    if (currentApiBase === '/api' && isNetworkError) {
      try {
        const fallbackUrl = `http://127.0.0.1:8000/api${cleanEndpoint}`;
        const fallbackRes = await fetch(fallbackUrl, options);
        if (fallbackRes.ok) {
          currentApiBase = 'http://127.0.0.1:8000/api';
          return await fallbackRes.json();
        }
      } catch {
        // Fallback also failed, throw user-friendly error below
      }
    }

    if (isNetworkError) {
      throw new Error(
        'Unable to connect to ResearchPilot backend. Please ensure the backend server is running on http://127.0.0.1:8000 (uvicorn app.main:app --reload --reload-dir app).'
      );
    }
    throw err;
  }
}

export const api = {
  // Tasks
  async createTask(payload: {
    question: string;
    domain?: string;
    constraints?: string;
    execution_mode?: string;
  }): Promise<ResearchTask> {
    return apiRequest<ResearchTask>('/tasks', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
  },

  async listTasks(): Promise<ResearchTask[]> {
    return apiRequest<ResearchTask[]>('/tasks');
  },

  async getTask(id: string): Promise<ResearchTask> {
    return apiRequest<ResearchTask>(`/tasks/${id}`);
  },

  async listTaskRuns(taskId: string): Promise<TaskRunSummary[]> {
    return apiRequest<TaskRunSummary[]>(`/tasks/${taskId}/runs`, { headers: authHeaders() });
  },

  async getDashboardStats(): Promise<DashboardStats> {
    return apiRequest<DashboardStats>('/stats/dashboard', { headers: authHeaders() });
  },

  async getMonthlyInvestigations(year?: number): Promise<{ year: number; total: number; data: MonthlyInvestigation[] }> {
    const url = year ? `/stats/monthly-investigations?year=${year}` : '/stats/monthly-investigations';
    return apiRequest<{ year: number; total: number; data: MonthlyInvestigation[] }>(url, { headers: authHeaders() });
  },

  async getHistory(): Promise<HistoryEntry[]> {
    return apiRequest<HistoryEntry[]>('/history', { headers: authHeaders() });
  },

  // ── Saved papers (user library) ──

  async savePaper(paper: Partial<AcademicPaper>): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>('/papers/save', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(paper),
    });
  },

  async listSavedPapers(): Promise<{ papers: SavedPaper[]; total: number }> {
    return apiRequest<{ papers: SavedPaper[]; total: number }>('/papers/saved', { headers: authHeaders() });
  },

  async removeSavedPaper(paperId: string): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>(`/papers/saved/${paperId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  // Runs
  async startRun(taskId: string, execution_mode: string = 'autonomous'): Promise<Run> {
    return apiRequest<Run>(`/tasks/${taskId}/runs`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ execution_mode }),
    });
  },

  async getRun(runId: string): Promise<Run> {
    return apiRequest<Run>(`/runs/${runId}`);
  },

  async getRunEvidence(runId: string): Promise<Claim[]> {
    return apiRequest<Claim[]>(`/runs/${runId}/evidence`);
  },

  async getRunExperiment(runId: string): Promise<Experiment | null> {
    return apiRequest<Experiment | null>(`/runs/${runId}/experiments`);
  },

  async approveGatedRun(runId: string): Promise<{ status: string; message: string }> {
    return apiRequest<{ status: string; message: string }>(`/runs/${runId}/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
  },

  async reexecuteExperiment(expId: string): Promise<any> {
    return apiRequest<any>(`/experiments/${expId}/execute`, {
      method: 'POST',
      headers: authHeaders(),
    });
  },

  async getFinalReport(runId: string): Promise<FinalReport> {
    return apiRequest<FinalReport>(`/runs/${runId}/report`);
  },

  // Benchmarks
  async runBenchmark(casesLimit: number = 5, models?: string[]): Promise<BenchmarkResult> {
    return apiRequest<BenchmarkResult>('/benchmarks/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cases_limit: casesLimit,
        models_to_compare: models,
      }),
    });
  },

  async getBenchmarkCases(): Promise<BenchmarkCase[]> {
    return apiRequest<BenchmarkCase[]>('/benchmarks/cases');
  },

  async getBenchmarkHistory(limit: number = 10): Promise<{ runs: BenchmarkHistoryEntry[] }> {
    return apiRequest<{ runs: BenchmarkHistoryEntry[] }>(`/benchmarks/history?limit=${limit}`, { headers: authHeaders() });
  },

  async searchCorpus(query: string, useExternal: boolean = false): Promise<any> {
    return apiRequest<any>(`/search?q=${encodeURIComponent(query)}&use_external=${useExternal}`);
  },

  // Academic Literature APIs (Semantic Scholar, OpenAlex, Crossref)
  async getLiteratureSources(): Promise<{ sources: LiteratureSourceInfo[] }> {
    return apiRequest<{ sources: LiteratureSourceInfo[] }>('/literature/sources');
  },

  async searchLiterature(query: string, sources?: string[], limit: number = 6): Promise<LiteratureSearchResult> {
    let url = `/literature/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    if (sources && sources.length > 0) {
      url += `&sources=${encodeURIComponent(sources.join(','))}`;
    }
    return apiRequest<LiteratureSearchResult>(url);
  },

  async importLiteraturePapers(papers: AcademicPaper[]): Promise<{ status: string; ingested_count: number; total_active_papers: number; message: string }> {
    return apiRequest<{ status: string; ingested_count: number; total_active_papers: number; message: string }>('/literature/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ papers }),
    });
  },

  // Core Prototype
  async getMidSemQuestions(): Promise<{
    milestone: string;
    description: string;
    supported_count: number;
    questions: any[];
  }> {
    return apiRequest<{
      milestone: string;
      description: string;
      supported_count: number;
      questions: any[];
    }>('/midsem/questions');
  },

  async validateMidSemQuery(question: string): Promise<{
    is_supported: boolean;
    matched_question?: any;
    message: string;
  }> {
    return apiRequest<{
      is_supported: boolean;
      matched_question?: any;
      message: string;
    }>('/midsem/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  async register(payload: RegisterPayload): Promise<AuthUser> {
    return apiRequest<AuthUser>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async login(payload: LoginPayload): Promise<AuthUser> {
    return apiRequest<AuthUser>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getMe(token: string): Promise<AuthUser> {
    return apiRequest<AuthUser>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
