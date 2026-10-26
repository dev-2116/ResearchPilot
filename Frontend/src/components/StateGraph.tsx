import React from 'react';
import { Check, Clock, AlertCircle, PlayCircle, GitCommit } from 'lucide-react';
import { AgentStep } from '../types';

interface StateGraphProps {
  currentStep: string;
  runStatus: string;
  steps: AgentStep[];
  selectedStepIndex: number | null;
  onSelectStep: (stepIndex: number) => void;
}

const ORDERED_STATES = [
  { id: 'PLAN', label: '1. Plan', description: 'Decompose Task' },
  { id: 'RETRIEVE', label: '2. Retrieve', description: 'Hybrid Search' },
  { id: 'EXTRACT_EVIDENCE', label: '3. Evidence', description: 'Extract Passages' },
  { id: 'VERIFY', label: '4. Verify', description: 'Claim NLI Scoring' },
  { id: 'DESIGN_EXPERIMENT', label: '5. Design', description: 'Hypothesis Setup' },
  { id: 'GENERATE_CODE', label: '6. Codegen', description: 'Sandbox Python' },
  { id: 'EXECUTE', label: '7. Execute', description: 'Subprocess Run' },
  { id: 'EVALUATE', label: '8. Evaluate', description: 'Metric Derivation' },
  { id: 'REVIEW', label: '9. Review', description: 'Feedback Loop' },
  { id: 'REPORT', label: '10. Report', description: 'Synthesis Paper' },
];

export const StateGraph: React.FC<StateGraphProps> = ({
  currentStep,
  runStatus,
  steps,
  selectedStepIndex,
  onSelectStep,
}) => {
  const currentIdx = ORDERED_STATES.findIndex((s) => s.id === currentStep);
  const isCompleted = runStatus === 'COMPLETED';
  const isGatedWaiting = runStatus === 'WAITING_APPROVAL';

  return (
    <div className="state-graph-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="card-icon-tile">
            <GitCommit size={17} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700 }}>
              Agent State-Machine Pipeline
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ten recorded stages with a verification feedback loop — click a node to inspect its payloads.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <span className="badge badge-slate">Deterministic FSM</span>
          <span className="badge badge-emerald">Evidence-gated</span>
        </div>
      </div>

      <div className="state-graph-flow">
        {ORDERED_STATES.map((state, idx) => {
          let nodeStatus = 'pending';
          if (isCompleted || (currentIdx !== -1 && idx < currentIdx)) {
            nodeStatus = 'completed';
          } else if (state.id === currentStep) {
            nodeStatus = isGatedWaiting ? 'waiting' : 'active';
          }

          const matchedStep = steps.find((s) => s.step_type === state.id);
          const isSelected = selectedStepIndex === (idx + 1);

          return (
            <React.Fragment key={state.id}>
              <div
                className={`state-node ${nodeStatus} ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectStep(idx + 1)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectStep(idx + 1); } }}
                role="button"
                tabIndex={0}
                aria-label={`${state.label}: ${state.description}${matchedStep ? `, ${matchedStep.latency_ms}ms` : ''}`}
              >
                <div className="state-node-circle">
                  {nodeStatus === 'completed' ? (
                    <Check size={17} strokeWidth={2.5} />
                  ) : nodeStatus === 'waiting' ? (
                    <Clock size={17} strokeWidth={2.5} />
                  ) : nodeStatus === 'active' ? (
                    <PlayCircle size={17} strokeWidth={2.5} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span className="state-node-label">{state.label}</span>
                <span style={{ fontSize: '0.64rem', color: 'var(--text-light)', textAlign: 'center' }}>
                  {state.description}
                </span>

                {matchedStep && (
                  <span className="mono badge badge-slate" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
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
                      ? 'active'
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
