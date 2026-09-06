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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe' }}>
            <GitCommit size={18} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Agent State-Machine Pipeline Execution
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Deterministic 11-State Finite State Machine with verification feedback loop and provenance hashes.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-indigo">
            Deterministic FSM
          </span>
          <span className="badge badge-emerald">
            Evidence-Gated
          </span>
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
                style={{
                  background: isSelected ? '#f1f5f9' : 'transparent',
                  outline: isSelected ? '2px solid var(--accent-primary)' : 'none',
                  outlineOffset: '4px',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 4px'
                }}
              >
                <div className="state-node-circle">
                  {nodeStatus === 'completed' ? (
                    <Check size={18} strokeWidth={2.5} />
                  ) : nodeStatus === 'waiting' ? (
                    <Clock size={18} strokeWidth={2.5} />
                  ) : nodeStatus === 'active' ? (
                    <PlayCircle size={18} strokeWidth={2.5} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span className="state-node-label">{state.label}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {state.description}
                </span>

                {matchedStep && (
                  <span className="mono badge badge-slate" style={{ fontSize: '0.62rem', padding: '1px 5px', marginTop: '2px' }}>
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
