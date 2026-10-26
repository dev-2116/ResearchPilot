import React, { useState } from 'react';
import {
  BarChart2,
  Check,
  Copy,
  Download,
  FlaskConical,
  FileCode,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { Experiment } from '../types';
import { EmptyState, SectionHeader, StatusBadge, fmtDuration } from '../components/ui';

interface ExperimentLabProps {
  experiment: Experiment | null;
  onReexecute: (expId: string) => void;
  isExecuting: boolean;
}

export const ExperimentLab: React.FC<ExperimentLabProps> = ({ experiment, onReexecute, isExecuting }) => {
  const [activeView, setActiveView] = useState<'code' | 'manifest'>('code');
  const [copied, setCopied] = useState(false);

  if (!experiment) {
    return (
      <div className="page-view">
        <div className="card">
          <EmptyState
            icon={<FlaskConical size={22} />}
            title="No experiment generated yet"
            description="When an investigation reaches its DESIGN_EXPERIMENT stage, the agent generates an empirical hypothesis and reproducible Python code that is executed in an isolated subprocess sandbox. Select or launch a run from the Research Workspace first."
          />
        </div>
      </div>
    );
  }

  const seed = experiment.variables?.random_seed;
  const hasMetrics = Array.isArray(experiment.metrics) && experiment.metrics.length > 0;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(experiment.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadManifest = () => {
    if (!experiment.manifest) return;
    const blob = new Blob([JSON.stringify(experiment.manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manifest_${experiment.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-view">
      {/* Header */}
      <div className="card">
        <SectionHeader
          icon={<FlaskConical size={17} />}
          title="Empirical Sandbox & Reproducible Experiment Lab"
          right={
            <div style={{ display: 'flex', gap: 9, flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={handleDownloadManifest} disabled={!experiment.manifest}>
                <Download size={14} /> Manifest JSON
              </button>
              <button className="btn btn-primary" onClick={() => onReexecute(experiment.id)} disabled={isExecuting}>
                {isExecuting ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                <span>{isExecuting ? 'Executing…' : 'Re-run in Sandbox'}</span>
              </button>
            </div>
          }
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '10px 0 12px' }}>
          <span className="mono badge badge-slate">{experiment.id}</span>
          <StatusBadge status={experiment.status} />
          {seed !== undefined && seed !== null && (
            <span className="badge badge-cyan">Random seed: {String(seed)}</span>
          )}
          <span className="badge badge-slate"><Lock size={11} /> Subprocess sandbox</span>
          {typeof experiment.duration_ms === 'number' && (
            <span className="badge badge-slate">Last duration: {fmtDuration(experiment.duration_ms)}</span>
          )}
        </div>

        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Hypothesis: <strong style={{ color: 'var(--text-primary)' }}>“{experiment.hypothesis}”</strong>
        </p>
        {(experiment.baseline_method || experiment.proposed_method) && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 5 }}>
            {experiment.baseline_method && <>Baseline: <span className="mono">{experiment.baseline_method}</span></>}
            {experiment.baseline_method && experiment.proposed_method && ' · '}
            {experiment.proposed_method && <>Proposed: <span className="mono">{experiment.proposed_method}</span></>}
          </p>
        )}
      </div>

      {/* Metrics — only real recorded metrics */}
      {hasMetrics && (
        <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(experiment.metrics.length, 4)}, 1fr)`, gap: 14 }}>
          {experiment.metrics.map((m) => (
            <div key={m.id || m.name} className="stat-card">
              <span className="stat-label">{m.name}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span className="mono" style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {m.unit === 'ratio' ? `${(m.value * 100).toFixed(1)}%` : Number(m.value).toFixed(3)}
                </span>
                {m.delta_percentage !== undefined && m.delta_percentage !== null && (
                  <span className={`badge ${m.delta_percentage > 0 ? 'badge-emerald' : m.delta_percentage < 0 ? 'badge-rose' : 'badge-slate'}`}>
                    {m.delta_percentage > 0 ? '+' : ''}{m.delta_percentage}%
                  </span>
                )}
              </div>
              {m.baseline_value !== undefined && m.baseline_value !== null && (
                <span className="stat-hint">
                  Baseline: {m.unit === 'ratio' ? `${(m.baseline_value * 100).toFixed(1)}%` : Number(m.baseline_value).toFixed(3)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Code / manifest */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 13 }}>
            <div className="seg-group">
              <button className={`seg-btn ${activeView === 'code' ? 'active' : ''}`} onClick={() => setActiveView('code')}>
                <FileCode size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Experiment Code
              </button>
              <button className={`seg-btn ${activeView === 'manifest' ? 'active' : ''}`} onClick={() => setActiveView('manifest')} disabled={!experiment.manifest}>
                <Layers size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Manifest
              </button>
            </div>
            {activeView === 'code' && (
              <button className="btn btn-secondary" onClick={handleCopyCode} style={{ padding: '5px 11px', fontSize: '0.74rem' }}>
                {copied ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          {activeView === 'code' ? (
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot dot-red" /><span className="terminal-dot dot-yellow" /><span className="terminal-dot dot-green" />
                </div>
                <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  sandbox_{experiment.id}.py
                </span>
              </div>
              <pre className="terminal-body">{experiment.code}</pre>
            </div>
          ) : experiment.manifest ? (
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot dot-red" /><span className="terminal-dot dot-yellow" /><span className="terminal-dot dot-green" />
                </div>
                <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>manifest.json</span>
              </div>
              <pre className="terminal-body">{JSON.stringify(experiment.manifest, null, 2)}</pre>
            </div>
          ) : (
            <EmptyState
              icon={<Layers size={18} />}
              title="No manifest recorded"
              description="A reproducibility manifest is written once the experiment has executed in the sandbox."
            />
          )}
        </div>

        {/* Console + chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <SectionHeader
              icon={<Terminal size={15} />}
              title="Sandbox Console"
              right={
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span className={`mono badge ${experiment.exit_code === 0 ? 'badge-emerald' : experiment.exit_code === undefined || experiment.exit_code === null ? 'badge-slate' : 'badge-rose'}`}>
                    {experiment.exit_code === undefined || experiment.exit_code === null ? 'Not executed yet' : `Exit ${experiment.exit_code}`}
                  </span>
                </div>
              }
            />
            <div className="terminal-window" style={{ marginTop: 10 }}>
              <pre className="terminal-body" style={{ maxHeight: 200 }}>
                {experiment.stdout || experiment.stderr || '[no output recorded — the experiment has not executed yet]'}
              </pre>
            </div>
            {experiment.stderr && experiment.stdout && (
              <p className="form-error-text" style={{ marginTop: 8 }}>
                stderr output detected — see the full log above.
              </p>
            )}
          </div>

          {experiment.chart_url && (
            <div className="card">
              <SectionHeader
                icon={<BarChart2 size={15} />}
                title="Generated Figure"
                right={<span className="badge badge-slate">Matplotlib PNG</span>}
              />
              <div style={{ background: 'var(--bg-inset)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <img src={experiment.chart_url} alt="Experiment figure generated by the sandbox" style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius-sm)' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
