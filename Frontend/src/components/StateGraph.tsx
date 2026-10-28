import React from 'react';
import { Check, Clock, AlertCircle, PlayCircle, GitCommit, ShieldCheck } from 'lucide-react';
import { AgentStep } from '../types';

interface StateGraphProps {
  currentStep: string;
  runStatus: string;
  steps: AgentStep[];
  selectedStepIndex: number | null;
  onSelectStep: (stepIndex: number) => void;
}

export const ORDERED_STATES = [
  { id: 'PLAN', label: '1. Plan', description: 'Decompose Goals' },
  { id: 'RETRIEVE', label: '2. Retrieve', description: 'Hybrid Search' },
  { id: 'EXTRACT_EVIDENCE', label: '3. Evidence', description: 'Extract Passages' },
  { id: 'VERIFY', label: '4. Verify', description: 'Claim NLI Scoring' },
  { id: 'DESIGN_EXPERIMENT', label: '5. Design', description: 'Hypothesis Setup' },
  { id: 'GENERATE_CODE', label: '6. Codegen', description: 'Sandbox Python' },
  { id: 'EXECUTE', label: '7. Execute', description: 'Subprocess Run' },
  { id: 'EVALUATE', label: '8. Evaluate', description: 'Metric Derivation' },
  { id: 'REVIEW', label: '9. Review', description: 'Feedback Loop' },
  { id: 'REPORT', label: '10. Report', description: 'Synthesis Paper' },
  { id: 'COMPLETE', label: '11. Complete', description: 'Verified & Sealed' },
];

export const StateGraph: React.FC<StateGraphProps> = ({
  currentStep,
  runStatus,
  steps,
  selectedStepIndex,
  onSelectStep,
}) => {
  const effectiveStep = currentStep === 'EXECUTE_GATED_PAUSE' ? 'EXECUTE' : currentStep;
  const currentIdx = ORDERED_STATES.findIndex((s) => s.id === effectiveStep);
  const isCompleted = runStatus === 'COMPLETED' || currentStep === 'COMPLETE';
  const isFailed = runStatus === 'FAILED';
  const isGatedWaiting = runStatus === 'WAITING_APPROVAL';

  return (
    <div className="state-graph-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="card-icon-tile">
            <GitCommit size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              11-Stage Agent State-Machine Pipeline
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Deterministic execution graph with human-in-the-loop gating and claim-verification feedback loops. Click any stage to inspect live payloads.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <span className="badge badge-cyan">Deterministic FSM</span>
          <span className="badge badge-emerald"><ShieldCheck size={12} /> Evidence-Gated</span>
        </div>
      </div>

      <div className="state-graph-flow">
        {ORDERED_STATES.map((state, idx) => {
          let nodeStatus = 'pending';
          if (isCompleted || (currentIdx !== -1 && idx < currentIdx)) {
            nodeStatus = 'completed';
          } else if (state.id === effectiveStep) {
            if (isFailed) {
              nodeStatus = 'failed';
            } else if (isGatedWaiting) {
              nodeStatus = 'waiting';
            } else {
              nodeStatus = 'active';
            }
          }

          const matchedStep = steps.find((s) => s.step_type === state.id || (state.id === 'COMPLETE' && s.step_index === 10));
          const stepNumber = idx + 1;
          const isSelected = selectedStepIndex === (idx >= 10 ? 10 : stepNumber);

          return (
            <React.Fragment key={state.id}>
              <div
                className={`state-node ${nodeStatus} ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectStep(idx >= 10 ? 10 : stepNumber)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectStep(idx >= 10 ? 10 : stepNumber); } }}
                role="button"
                tabIndex={0}
                aria-label={`${state.label}: ${state.description}${matchedStep ? `, ${matchedStep.latency_ms}ms` : ''}`}
              >
                <div className="state-node-circle">
                  {nodeStatus === 'completed' ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : nodeStatus === 'failed' ? (
                    <AlertCircle size={16} strokeWidth={2.5} />
                  ) : nodeStatus === 'waiting' ? (
                    <Clock size={16} strokeWidth={2.5} />
                  ) : nodeStatus === 'active' ? (
                    <PlayCircle size={16} strokeWidth={2.5} />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>
                <span className="state-node-label">{state.label}</span>
                <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.25 }}>
                  {state.description}
                </span>

                {matchedStep && (
                  <span className="mono badge badge-slate" style={{ fontSize: '0.62rem', padding: '1px 6px', marginTop: 2 }}>
                    {matchedStep.latency_ms}ms
                  </span>
                )}
              </div>

              {idx < ORDERED_STATES.length - 1 && (
                <div
                  className={`state-connector ${
                    isCompleted || (currentIdx !== -1 && idx < currentIdx)
                      ? 'completed'
                      : idx === currentIdx
                      ? (isFailed ? 'failed' : 'active')
                      : ''
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
