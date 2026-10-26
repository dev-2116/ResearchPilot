import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  History,
  Info,
  Play,
  RefreshCw,
} from 'lucide-react';
import { BenchmarkCase, BenchmarkHistoryEntry, BenchmarkResult } from '../types';
import { CompareBars } from '../components/charts';
import { EmptyState, SectionHeader, fmtInt } from '../components/ui';
import { api } from '../services/api';

interface EvaluationHubProps {
  benchmarkResult: BenchmarkResult | null;
  benchmarkCases: BenchmarkCase[];
  onRunBenchmark: (limit: number) => void;
  isRunningBenchmark: boolean;
}

type Tab = 'results' | 'cases';

const MODEL_LABELS: Record<string, string> = {
  standard_llm: 'Standard LLM (zero-shot)',
  basic_rag: 'Basic RAG (dense only)',
  agentic_rag: 'Agentic RAG (ReAct loop)',
  researchpilot: 'ResearchPilot (evidence-verified)',
};

const MODEL_COLORS: Record<string, string> = {
  standard_llm: '#4A5058',
  basic_rag: '#60A5FA',
  agentic_rag: '#A78BFA',
  researchpilot: '#34D399',
};

const PCT_METRICS = [
  { key: 'answer_accuracy', label: 'Answer Accuracy' },
  { key: 'citation_precision', label: 'Citation Precision' },
  { key: 'citation_recall', label: 'Citation Recall' },
  { key: 'unsupported_claim_rate', label: 'Unsupported Claim Rate' },
  { key: 'experiment_success', label: 'Experiment Success' },
  { key: 'result_validity', label: 'Result Validity' },
  { key: 'reproducibility', label: 'Reproducibility' },
];

export const EvaluationHub: React.FC<EvaluationHubProps> = ({
  benchmarkResult,
  benchmarkCases,
  onRunBenchmark,
  isRunningBenchmark,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('results');
  const [limit, setLimit] = useState(5);
  const [historicalCount, setHistoricalCount] = useState<number | null>(null);
  const [history, setHistory] = useState<BenchmarkHistoryEntry[] | null>(null);

  React.useEffect(() => {
    api.getDashboardStats()
      .then((s) => setHistoricalCount(s.benchmark_runs_total))
      .catch(() => setHistoricalCount(null));
    api.getBenchmarkHistory(10)
      .then((h) => setHistory(h.runs))
      .catch(() => setHistory(null));
  }, [benchmarkResult]);

  const hasResult = !!benchmarkResult && !!benchmarkResult.metrics && Object.keys(benchmarkResult.metrics).length > 0;
  const models = hasResult ? Object.keys(benchmarkResult!.metrics) : [];

  return (
    <div className="page-view">
      {/* Header */}
      <div className="card">
        <SectionHeader
          icon={<Award size={17} />}
          title="Evaluation Hub"
          subtitle="Run the built-in benchmark suite and inspect real measured results — nothing here is pre-filled"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <label className="form-label" htmlFor="bench-limit" style={{ marginBottom: 0 }}>Cases</label>
              <select
                id="bench-limit"
                className="form-select"
                style={{ width: 90, paddingTop: 7, paddingBottom: 7 }}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={isRunningBenchmark}
              >
                {[3, 5, 10].map((n) => (
                  <option key={n} value={n} disabled={n > benchmarkCases.length}>
                    {n}{n > benchmarkCases.length ? ' (unavailable)' : ''}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={() => onRunBenchmark(limit)} disabled={isRunningBenchmark || benchmarkCases.length === 0}>
                {isRunningBenchmark ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                <span>{isRunningBenchmark ? 'Running…' : 'Run Benchmark'}</span>
              </button>
            </div>
          }
        />

        <div className="seg-group" style={{ marginTop: 14 }}>
          <button className={`seg-btn ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>
            <BarChart3 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Results
          </button>
          <button className={`seg-btn ${activeTab === 'cases' ? 'active' : ''}`} onClick={() => setActiveTab('cases')}>
            <BookOpen size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Benchmark Cases ({benchmarkCases.length})
          </button>
        </div>
      </div>

      {activeTab === 'results' && (
        <>
          {!hasResult ? (
            /* Honest empty state — no fabricated scores or ablations */
            <div className="card">
              <EmptyState
                icon={<BarChart3 size={20} />}
                title="No benchmark results in this session yet"
                description="Comparative scores appear here after you run the benchmark suite. Historical suites executed in previous sessions are recorded by the backend but are not mixed into a fresh comparison."
                action={
                  <button className="btn btn-primary" onClick={() => onRunBenchmark(limit)} disabled={isRunningBenchmark || benchmarkCases.length === 0}>
                    <Play size={14} /> Run the {Math.min(limit, benchmarkCases.length) || 5}-case suite
                  </button>
                }
              />
              {historicalCount !== null && historicalCount > 0 && (
                <p className="chart-tooltip-note" style={{ textAlign: 'center', marginTop: 4 }}>
                  {fmtInt(historicalCount)} benchmark suite run{historicalCount === 1 ? '' : 's'} recorded historically.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Result meta */}
              <div className="card">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                  <span className="badge badge-emerald">Suite completed</span>
                  <span className="mono badge badge-slate">{benchmarkResult!.benchmark_id}</span>
                  <span className="badge badge-slate">{fmtInt(benchmarkResult!.case_results?.length ?? 0)} cases scored</span>
                  <span className="badge badge-slate">{new Date(benchmarkResult!.timestamp).toLocaleString()}</span>
                </div>
                {benchmarkResult!.summary && (
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.55 }}>
                    {benchmarkResult!.summary}
                  </p>
                )}
              </div>

              {/* Real metric cards */}
              {PCT_METRICS.filter((m) => models.some((mo) => benchmarkResult!.metrics[mo]?.[m.key] !== undefined)).map((m) => (
                <div className="card" key={m.key}>
                  <SectionHeader
                    icon={<BarChart3 size={15} />}
                    title={m.label}
                    subtitle={m.key === 'unsupported_claim_rate' ? 'Lower is better — fraction of claims lacking grounded support' : 'Higher is better'}
                  />
                  <div style={{ marginTop: 10 }}>
                    <CompareBars
                      unit="%"
                      data={models
                        .filter((mo) => typeof benchmarkResult!.metrics[mo]?.[m.key] === 'number')
                        .map((mo) => ({
                          label: MODEL_LABELS[mo] || mo,
                          value: Number((benchmarkResult!.metrics[mo][m.key] * 100).toFixed(1)),
                          color: MODEL_COLORS[mo] || '#FFAA24',
                        }))}
                      maxHint={100}
                    />
                  </div>
                </div>
              ))}

              {/* Real per-case table */}
              {(benchmarkResult!.case_results?.length ?? 0) > 0 && (
                <div className="card">
                  <SectionHeader
                    icon={<BookOpen size={15} />}
                    title="Per-Case Results"
                    subtitle="Exact scores for every benchmark case executed in this run"
                  />
                  <div className="table-container" style={{ marginTop: 10 }}>
                    <table className="formal-table">
                      <thead>
                        <tr>
                          <th>Case</th>
                          <th>Category</th>
                          <th>Difficulty</th>
                          {models.map((mo) => (
                            <th key={mo}>{(MODEL_LABELS[mo] || mo).split(' (')[0]}</th>
                          ))}
                          <th>Evidence-Grounded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarkResult!.case_results.map((c) => (
                          <tr key={c.case_id}>
                            <td className="mono" style={{ fontSize: '0.74rem' }}>{c.case_id}</td>
                            <td><span className="badge badge-slate">{c.category}</span></td>
                            <td><span className="badge badge-slate">{c.difficulty}</span></td>
                            {models.map((mo) => {
                              const v = (c as any)[`${mo}_score`];
                              return (
                                <td key={mo} className="mono">
                                  {typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : 'N/A'}
                                </td>
                              );
                            })}
                            <td>
                              <span className={`badge ${c.evidence_grounded ? 'badge-emerald' : 'badge-amber'}`}>
                                {c.evidence_grounded ? 'Yes' : 'Unverified'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent-blue)' }} />
                <span>
                  Scores are computed by the built-in benchmark service on the built-in case suite at execution time.
                  Only these fresh, real measurements are shown — no archived ablation numbers are mixed in.
                </span>
              </div>
            </>
          )}

          {/* Recorded history — real persisted rows from previous sessions */}
          <div className="card">
            <SectionHeader
              icon={<History size={15} />}
              title="Recorded History"
              subtitle="Benchmark suites executed in earlier sessions, stored by the backend — shown for reference only and never mixed into fresh comparisons"
            />
            {history === null ? (
              <p className="chart-tooltip-note" style={{ marginTop: 8 }}>
                History could not be loaded. Verify the API connection and reload.
              </p>
            ) : history.length === 0 ? (
              <EmptyState
                icon={<History size={18} />}
                title="No previously recorded benchmark runs"
                description="Every suite you execute is stored with its exact measured scores, so it will appear here the next time you visit."
              />
            ) : (
              <div className="table-container" style={{ marginTop: 10 }}>
                <table className="formal-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Suite</th>
                      <th>Cases</th>
                      <th>ResearchPilot accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const acc = h.results?.metrics?.researchpilot?.answer_accuracy;
                      return (
                        <tr key={h.id}>
                          <td>{new Date(h.timestamp).toLocaleString()}</td>
                          <td className="mono" style={{ fontSize: '0.74rem' }}>{h.benchmark_id}</td>
                          <td>{fmtInt(h.results?.case_results?.length ?? 0)}</td>
                          <td className="mono">{typeof acc === 'number' ? `${(acc * 100).toFixed(1)}%` : 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'cases' && (
        <div className="card">
          <SectionHeader
            icon={<BookOpen size={15} />}
            title={`Benchmark Cases (${benchmarkCases.length})`}
            subtitle="The built-in evaluation suite spanning retrieval, fact extraction, and ML reproducibility"
          />
          {benchmarkCases.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={18} />}
              title="Benchmark cases unavailable"
              description="The backend did not return any benchmark cases. Verify the API connection and reload."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 12 }}>
              {benchmarkCases.map((c) => (
                <div key={c.id} className="link-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className="mono badge badge-slate">{c.id}</span>
                      <span className="badge badge-cyan">{c.category}</span>
                      <span className="badge badge-slate">{c.difficulty}</span>
                    </div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 4 }}>{c.question}</h4>
                    {c.ground_truth_claims?.length > 0 && (
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Ground-truth claim: <em>“{c.ground_truth_claims[0]}”</em>
                      </p>
                    )}
                  </div>
                  <span className="badge badge-slate" style={{ flexShrink: 0 }}>
                    {Object.keys(c.expected_metrics || {}).length} expected metrics
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
