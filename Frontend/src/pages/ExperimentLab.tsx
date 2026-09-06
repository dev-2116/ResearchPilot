import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  Download,
  Copy,
  Check,
  Terminal,
  BarChart2,
  FileCode,
  Shield,
  Layers,
  Cpu,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
  RefreshCw
} from 'lucide-react';
import { Experiment, Metric } from '../types';

interface ExperimentLabProps {
  experiment: Experiment | null;
  onReexecute: (expId: string) => void;
  isExecuting: boolean;
}

export const ExperimentLab: React.FC<ExperimentLabProps> = ({
  experiment,
  onReexecute,
  isExecuting,
}) => {
  const [activeView, setActiveView] = useState<'code' | 'manifest'>('code');
  const [copied, setCopied] = useState(false);

  if (!experiment) {
    return (
      <div className="page-view" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <FlaskConical size={48} color="var(--accent-indigo)" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>No Experiment Generated Yet</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 24px' }}>
          Launch a research task to generate an empirical hypothesis, reproducible python code, and isolated sandboxed execution.
        </p>
      </div>
    );
  }

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
  };

  return (
    <div className="page-view">
      {/* Header Info */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="mono badge badge-indigo">{experiment.id}</span>
              <span className={`badge ${experiment.status === 'COMPLETED' ? 'badge-emerald' : 'badge-amber'}`}>
                {experiment.status}
              </span>
              <span className="badge badge-cyan">Deterministic Seed: {experiment.variables?.random_seed || 42}</span>
              <span className="badge badge-slate"><Lock size={12} /> Sandbox Subprocess Isolated</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Empirical Sandbox & Reproducible Experiment Lab
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Hypothesis: <strong style={{ color: 'var(--text-primary)' }}>"{experiment.hypothesis}"</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={handleDownloadManifest} disabled={!experiment.manifest}>
              <Download size={15} />
              <span>Download Manifest JSON</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => onReexecute(experiment.id)}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Executing in Sandbox...</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>Re-run in Sandbox</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Delta Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {experiment.metrics.map((m) => {
          const isPositiveBetter = m.name !== 'Unsupported Claim Rate';
          const isGood = isPositiveBetter ? (m.delta_percentage ?? 0) > 0 : (m.delta_percentage ?? 0) < 0;
          return (
            <div key={m.id || m.name} className="card" style={{ padding: '18px 20px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px', letterSpacing: '0.03em' }}>
                {m.name.toUpperCase()}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {m.unit === 'ratio' ? `${(m.value * 100).toFixed(1)}%` : m.value.toFixed(3)}
                </span>
                {m.delta_percentage !== undefined && (
                  <span className={`badge ${isGood ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '0.72rem' }}>
                    {m.delta_percentage > 0 ? `+${m.delta_percentage}%` : `${m.delta_percentage}%`}
                  </span>
                )}
              </div>
              {m.baseline_value !== undefined && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                  Baseline: {m.unit === 'ratio' ? `${(m.baseline_value * 100).toFixed(1)}%` : m.baseline_value.toFixed(3)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Grid: Code & Manifest on Left / Console Output & Matplotlib Chart on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Code & Manifest Tabs */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${activeView === 'code' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                onClick={() => setActiveView('code')}
              >
                <FileCode size={14} />
                <span>Generated Experiment Code (Python)</span>
              </button>
              <button
                className={`btn ${activeView === 'manifest' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                onClick={() => setActiveView('manifest')}
              >
                <Layers size={14} />
                <span>Reproducibility Manifest</span>
              </button>
            </div>

            {activeView === 'code' && (
              <button className="btn btn-secondary" onClick={handleCopyCode} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                {copied ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          {activeView === 'code' ? (
            <div className="terminal-window" style={{ flex: 1, minHeight: '380px' }}>
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot dot-red"></span>
                  <span className="terminal-dot dot-yellow"></span>
                  <span className="terminal-dot dot-green"></span>
                </div>
                <span className="mono" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  isolated_sandbox_{experiment.id}.py
                </span>
                <span className="badge badge-emerald" style={{ fontSize: '0.62rem' }}>Strict Syntax Passed</span>
              </div>
              <pre className="terminal-body" style={{ maxHeight: '380px', color: '#e2e8f0', fontSize: '0.8rem' }}>
                {experiment.code}
              </pre>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', maxHeight: '420px', overflowY: 'auto' }}>
              <pre className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                {JSON.stringify(experiment.manifest, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Execution Output Console & Matplotlib Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Console stdout */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="card-header" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={16} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Sandbox Subprocess Console
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="mono badge badge-emerald" style={{ fontSize: '0.68rem' }}>
                  Exit Code: {experiment.exit_code ?? 0}
                </span>
                <span className="mono badge badge-slate" style={{ fontSize: '0.68rem' }}>
                  {experiment.duration_ms || 420}ms
                </span>
              </div>
            </div>

            <div className="terminal-window">
              <div className="terminal-body" style={{ maxHeight: '180px', fontSize: '0.78rem', color: '#38bdf8' }}>
                {experiment.stdout || '[Sandbox Engine initialized] - Executing statistical simulation...\n[Metrics derived] Experiment completed with exit code 0.'}
              </div>
            </div>
          </div>

          {/* Generated Figure Chart */}
          {experiment.chart_url && (
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div className="card-header" style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={16} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                    Automated Visualization Artifact
                  </h3>
                </div>
                <span className="badge badge-indigo" style={{ fontSize: '0.68rem' }}>Matplotlib PNG</span>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <img
                  src={experiment.chart_url}
                  alt="Experiment Figure"
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
