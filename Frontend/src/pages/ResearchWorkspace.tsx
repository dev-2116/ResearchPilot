import React, { useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  FileCode,
  FlaskConical,
  GitBranch,
  Play,
  Search,
  FileText,
} from 'lucide-react';
import { StateGraph } from '../components/StateGraph';
import { ExecutionMode, ResearchTask, Run } from '../types';
import { EmptyState, ProgressBar, SectionHeader, StatusBadge, fmtDuration, fmtTime } from '../components/ui';

interface ResearchWorkspaceProps {
  task: ResearchTask | null;
  run: Run | null;
  onApproveGated: () => void;
  onStartRun: (task: ResearchTask, mode?: ExecutionMode) => void;
  onNavigateTab: (tab: string) => void;
  isApproving: boolean;
}

export const ResearchWorkspace: React.FC<ResearchWorkspaceProps> = ({
  task,
  run,
  onApproveGated,
  onStartRun,
  onNavigateTab,
  isApproving,
}) => {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

  if (!task) {
    return (
      <div className="page-view">
        <div className="card">
          <EmptyState
            icon={<GitBranch size={22} />}
            title="No investigation selected"
            description="Select an investigation from the Dashboard or Research History, or launch a new one, to inspect its live agent state machine and execution trace."
            action={
              <button className="btn btn-primary" onClick={() => onNavigateTab('dashboard')}>
                Go to Dashboard
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const selectedStep =
    run?.steps.find((s) => s.step_index === selectedStepIndex) || null;

  return (
    <div className="page-view">
      {/* Task header */}
      <div className="card">
        <SectionHeader
          icon={<GitBranch size={17} />}
          title={task.question}
          subtitle={undefined}
          right={
            run ? (
              <StatusBadge status={run.status} className="" >
                {run.status === 'WAITING_APPROVAL' ? 'AWAITING CODE APPROVAL' : run.status.replace(/_/g, ' ')}
              </StatusBadge>
            ) : (
              <span className="badge badge-slate">No runs yet</span>
            )
          }
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '10px 0 4px' }}>
          <span className="mono badge badge-slate">{task.id}</span>
          {run && <span className="mono badge badge-slate">{run.run_id}</span>}
          <span className="badge badge-cyan">{task.domain}</span>
          <span className="badge badge-slate">{run?.execution_mode || task.execution_mode} mode</span>
          {task.constraints && (
            <span className="badge badge-slate" style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis' }} title={task.constraints}>
              {task.constraints}
            </span>
          )}
        </div>

        {run ? (
          <div style={{ marginTop: 14 }}>
            <ProgressBar
              value={run.progress}
              label={`Pipeline · ${run.current_step.replace(/_/g, ' ')} · ${fmtDuration(run.steps.reduce((acc, s) => acc + s.latency_ms, 0))} cumulative latency`}
              tone={run.status === 'FAILED' ? 'rose' : run.status === 'COMPLETED' ? 'emerald' : 'amber'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: '0.73rem', color: 'var(--text-light)' }}>
              <span>Started {fmtTime(run.started_at)}{run.ended_at ? ` · ended ${fmtTime(run.ended_at)}` : ''}</span>
              <span>{run.cost.tokens > 0 ? `${run.cost.tokens.toLocaleString()} tokens · ` : 'No LLM token usage (deterministic pipeline) · '}{run.evidence_count} passages · {run.claims_count} claims</span>
            </div>
            {run.latest_error && (
              <p className="form-error-text" style={{ marginTop: 8 }}>Last error: {run.latest_error}</p>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--bg-inset)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '13px 15px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              This task has not been executed yet. Starting a run launches the 10-stage agent pipeline.
            </span>
            <button className="btn btn-primary" onClick={() => onStartRun(task)} style={{ flexShrink: 0 }}>
              <Play size={14} /> Start Run
            </button>
          </div>
        )}
      </div>

      {/* Gated approval banner */}
      {run?.status === 'WAITING_APPROVAL' && (
        <div className="card" style={{ borderColor: 'var(--accent-amber-border)', background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(17,20,23,0))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-amber-light)', border: '1px solid var(--accent-amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={19} color="var(--accent-amber)" />
              </div>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: 2 }}>
                  Human-in-the-loop checkpoint
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Hypothesis and experiment code are ready. Review them in the Experiment Lab before authorizing sandbox execution.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9, flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => onNavigateTab('experiment')}>
                <FileCode size={14} /> Inspect Code
              </button>
              <button className="btn btn-success" onClick={onApproveGated} disabled={isApproving}>
                <Play size={14} />
                <span>{isApproving ? 'Authorizing…' : 'Approve & Execute'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FSM graph + outputs */}
      {run ? (
        <>
          <StateGraph
            currentStep={run.current_step}
            runStatus={run.status}
            steps={run.steps}
            selectedStepIndex={selectedStepIndex}
            onSelectStep={(idx) => setSelectedStepIndex(idx)}
          />

          <div className="grid-sidebar" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
            {/* Step inspector */}
            <div className="card">
              <SectionHeader
                icon={<Search size={15} />}
                title={selectedStep ? `Step ${selectedStep.step_index} · ${selectedStep.step_type}` : 'Step Inspector'}
                subtitle={
                  selectedStep
                    ? `Executed ${fmtTime(selectedStep.created_at)} · ${selectedStep.latency_ms}ms · ${selectedStep.token_usage > 0 ? `${selectedStep.token_usage} LLM tokens` : 'no LLM usage'}${selectedStep.error_message ? ' · errored' : ''}`
                    : 'Click any node in the pipeline above to inspect its input/output payloads.'
                }
                right={selectedStep && <StatusBadge status={selectedStep.status} />}
              />
              {selectedStep ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 10 }}>
                  {[
                    { label: 'Step input payload', data: selectedStep.input },
                    { label: 'Step output & generated evidence', data: selectedStep.output },
                  ].map((blk) => (
                    <div key={blk.label}>
                      <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>{blk.label}</label>
                      <div className="terminal-window">
                        <pre className="terminal-body" style={{ maxHeight: 190, fontSize: '0.74rem' }}>
                          {JSON.stringify(blk.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                  {selectedStep.error_message && (
                    <p className="form-error-text">Step error: {selectedStep.error_message}</p>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No step selected"
                  description="Pipeline nodes highlight as the run progresses. Select one to view its exact payloads."
                />
              )}
            </div>

            {/* Outputs deep links */}
            <div className="card">
              <SectionHeader
                icon={<ArrowRight size={15} />}
                title="Investigation Outputs"
                subtitle="Jump to artifacts generated by this run"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <button className="link-row" onClick={() => onNavigateTab('evidence')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Search size={17} color="var(--accent-blue)" />
                    <span>
                      <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Evidence Explorer</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {run.evidence_count} verified passages & claims
                      </span>
                    </span>
                  </span>
                  <ArrowRight size={14} color="var(--text-light)" />
                </button>

                <button className="link-row" onClick={() => onNavigateTab('experiment')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <FlaskConical size={17} color="var(--accent-purple)" />
                    <span>
                      <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Experiment Lab</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Sandbox code, console & metrics
                      </span>
                    </span>
                  </span>
                  <ArrowRight size={14} color="var(--text-light)" />
                </button>

                <button className="link-row" onClick={() => onNavigateTab('report')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <FileText size={17} color={run.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--text-light)'} />
                    <span>
                      <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Final Report</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {run.status === 'COMPLETED' ? 'Generated & provenance-sealed' : 'Generated when the run completes'}
                      </span>
                    </span>
                  </span>
                  <ArrowRight size={14} color="var(--text-light)" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Play size={18} />}
            title="Pipeline idle"
            description="Start a run above to watch the agent plan, retrieve, verify, experiment and report — every stage recorded with real latency and full provenance."
          />
        </div>
      )}
    </div>
  );
};
