import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCode,
  Shield,
  Search,
  FlaskConical,
  FileText,
  RefreshCw,
  Terminal,
  ArrowRight,
  ExternalLink,
  Cpu,
  Layers
} from 'lucide-react';
import { StateGraph } from '../components/StateGraph';
import { AgentStep, ResearchTask, Run } from '../types';

interface ResearchWorkspaceProps {
  task: ResearchTask | null;
  run: Run | null;
  onApproveGated: () => void;
  onNavigateTab: (tab: string) => void;
  isApproving: boolean;
}

export const ResearchWorkspace: React.FC<ResearchWorkspaceProps> = ({
  task,
  run,
  onApproveGated,
  onNavigateTab,
  isApproving,
}) => {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(1);

  if (!task || !run) {
    return (
      <div className="page-view" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <Terminal size={48} color="var(--accent-primary)" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>No Active Investigation Selected</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 24px' }}>
          Select an existing research task from the dashboard or launch a new investigation to view the live agent execution graph.
        </p>
        <button className="btn btn-primary" onClick={() => onNavigateTab('dashboard')}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const selectedStep = run.steps.find((s) => s.step_index === selectedStepIndex) || run.steps[run.steps.length - 1];

  return (
    <div className="page-view">
      {/* Header Info Card */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="mono badge badge-indigo">{task.id}</span>
              <span className="mono badge badge-cyan">{run.run_id}</span>
              <span className="badge badge-emerald">{task.domain}</span>
              <span className={`badge ${run.execution_mode === 'gated' ? 'badge-amber' : 'badge-indigo'}`}>
                {run.execution_mode.toUpperCase()} MODE
              </span>
            </div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: 700 }}>{task.question}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge ${run.status === 'COMPLETED' ? 'badge-emerald' : run.status === 'WAITING_APPROVAL' ? 'badge-amber' : 'badge-cyan'}`} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              {run.status === 'WAITING_APPROVAL' ? '⏸ PAUSED: AWAITING CODE APPROVAL' : run.status}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
            <span>Pipeline Progress: {Math.round(run.progress * 100)}% ({run.current_step})</span>
            <span>Tokens: {run.cost.tokens.toLocaleString()} | Cumulative Latency: ~{run.steps.reduce((acc, s) => acc + s.latency_ms, 0)}ms</span>
          </div>
          <div style={{ width: '100%', height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ width: `${Math.max(6, run.progress * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-emerald))', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      {/* Gated Mode Approval Action Banner */}
      {run.status === 'WAITING_APPROVAL' && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          borderColor: '#f59e0b',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} color="#b45309" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: '#92400e', fontWeight: 700, marginBottom: '2px' }}>
                  Human-in-the-Loop Checkpoint: Code Review Required
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#78350f' }}>
                  Hypothesis and empirical experiment code have been generated. Review sandbox specifications before authorizing execution.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => onNavigateTab('experiment')}>
                <FileCode size={16} />
                <span>Inspect Code in Lab</span>
              </button>
              <button className="btn btn-success" onClick={onApproveGated} disabled={isApproving} style={{ padding: '10px 20px' }}>
                <Play size={16} />
                <span>{isApproving ? 'Authorizing...' : 'Approve & Run Experiment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive 11-State Graph */}
      <StateGraph
        currentStep={run.current_step}
        runStatus={run.status}
        steps={run.steps}
        selectedStepIndex={selectedStepIndex}
        onSelectStep={(idx) => setSelectedStepIndex(idx)}
      />

      {/* Step Inspector & Quick Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Step Inspector Detail */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Step Inspector: {selectedStep ? `Step ${selectedStep.step_index} (${selectedStep.step_type})` : 'Select Step'}
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {selectedStep ? `Executed at ${new Date(selectedStep.created_at).toLocaleTimeString()}` : 'Click any node in the graph above to inspect step details.'}
              </p>
            </div>
            {selectedStep && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="badge badge-indigo">
                  {selectedStep.token_usage} Tokens
                </span>
                <span className="badge badge-slate">
                  {selectedStep.latency_ms}ms Latency
                </span>
              </div>
            )}
          </div>

          {selectedStep ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px', display: 'block' }}>
                  STEP INPUT PAYLOAD:
                </label>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', maxHeight: '160px', overflowY: 'auto' }}>
                  <pre className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {JSON.stringify(selectedStep.input, null, 2)}
                  </pre>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px', display: 'block' }}>
                  STEP OUTPUT & GENERATED EVIDENCE:
                </label>
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', maxHeight: '200px', overflowY: 'auto' }}>
                  <pre className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    {JSON.stringify(selectedStep.output, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Select a step above to inspect execution payload.
            </div>
          )}
        </div>

        {/* Quick Stage Deep Links */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '4px' }}>Investigation Outputs</h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Direct view of generated artifacts</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => onNavigateTab('evidence')}
              style={{
                padding: '14px',
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#bfdbfe';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Search size={18} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Evidence Explorer</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{run.evidence_count} passages & NLI claims</div>
                </div>
              </div>
              <ArrowRight size={14} color="var(--text-muted)" />
            </div>

            <div
              onClick={() => onNavigateTab('experiment')}
              style={{
                padding: '14px',
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#bfdbfe';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FlaskConical size={18} color="var(--accent-indigo)" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Experiment Lab</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Code sandbox & metrics</div>
                </div>
              </div>
              <ArrowRight size={14} color="var(--text-muted)" />
            </div>

            <div
              onClick={() => onNavigateTab('report')}
              style={{
                padding: '14px',
                background: run.status === 'COMPLETED' ? '#ecfdf5' : '#ffffff',
                border: `1px solid ${run.status === 'COMPLETED' ? '#a7f3d0' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#a7f3d0';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} color="var(--accent-emerald)" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Final Synthesis Report</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {run.status === 'COMPLETED' ? 'Paper Generated & Provenance Verified' : 'Generating on completion...'}
                  </div>
                </div>
              </div>
              <ArrowRight size={14} color="var(--text-muted)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
