import React, { useState } from 'react';
import { X, Sparkles, Play, BookOpen } from 'lucide-react';
import { ExecutionMode } from '../types';

interface NewResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { question: string; domain: string; constraints: string; execution_mode: ExecutionMode }) => void;
  isLoading: boolean;
}

const TEMPLATES = [
  {
    title: 'Hybrid BM25 vs Dense Embeddings',
    question: 'How does hybrid BM25 and dense retrieval compare against dense-only embeddings in scientific domain QA?',
    domain: 'Artificial Intelligence & RAG',
    constraints: 'Evaluate recall and latency on technical terminology'
  },
  {
    title: 'Claim Verification & Hallucination Mitigation',
    question: 'How does claim-level evidence verification reduce hallucinations in AI research assistance?',
    domain: 'Agentic Fact Verification',
    constraints: 'Include NLI support scoring and reference matching'
  },
  {
    title: 'ML Experiment Reproducibility Manifests',
    question: 'What minimum execution parameters must be recorded in an execution manifest to guarantee ML reproducibility?',
    domain: 'Machine Learning Reproducibility',
    constraints: 'Record seeds, hardware specs, and metric hashes'
  },
  {
    title: 'State-Machine Orchestration vs Recursive Loops',
    question: 'Why is state-machine orchestration preferred over unconstrained recursive loops in research agents?',
    domain: 'Agent Architecture & Control',
    constraints: 'Bound agent behavior and step policies'
  }
];

export const NewResearchModal: React.FC<NewResearchModalProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [question, setQuestion] = useState('');
  const [domain, setDomain] = useState('Artificial Intelligence & RAG');
  const [constraints, setConstraints] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('autonomous');
  const [touched, setTouched] = useState(false);

  if (!isOpen) return null;

  const questionInvalid = touched && !question.trim();

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setQuestion(tpl.question);
    setDomain(tpl.domain);
    setConstraints(tpl.constraints);
    setTouched(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!question.trim()) return;
    onSubmit({
      question: question.trim(),
      domain,
      constraints,
      execution_mode: executionMode,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onClose(); }}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="New research investigation">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="card-icon-tile" style={{ width: 38, height: 38 }}>
              <Sparkles size={19} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>New Research Investigation</h2>
              <p style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                Launch the evidence-verified agent pipeline on your question
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog" disabled={isLoading}>
            <X size={19} />
          </button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Starter templates</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TEMPLATES.map((t, idx) => (
              <button
                key={idx}
                type="button"
                className="link-row"
                onClick={() => handleApplyTemplate(t)}
                disabled={isLoading}
                style={{ fontSize: '0.82rem' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <BookOpen size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                </span>
                <span style={{ color: 'var(--text-light)', fontSize: '0.72rem', flexShrink: 0 }}>Apply →</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="nr-question">Research question *</label>
            <textarea
              id="nr-question"
              className={`form-textarea ${questionInvalid ? 'auth-input-error' : ''}`}
              rows={3}
              placeholder="e.g. How does hybrid BM25 and dense retrieval compare against dense-only embeddings in scientific domain QA?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={questionInvalid}
              aria-describedby={questionInvalid ? 'nr-question-error' : undefined}
              disabled={isLoading}
            />
            {questionInvalid && (
              <span id="nr-question-error" className="form-error-text">
                A research question is required before the agent can start.
              </span>
            )}
          </div>

          <div className="auth-row">
            <div className="form-group">
              <label className="form-label" htmlFor="nr-domain">Scientific domain</label>
              <select id="nr-domain" className="form-select" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={isLoading}>
                <option value="Artificial Intelligence & RAG">AI & RAG Systems</option>
                <option value="Machine Learning Reproducibility">ML Reproducibility</option>
                <option value="Agentic Fact Verification">Fact Verification</option>
                <option value="Biomedical Informatics">Biomedical Informatics</option>
                <option value="Agent Architecture & Control">Agent Architecture</option>
                <option value="Open Scientific Research">Open Research</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="nr-mode">Execution mode</label>
              <select id="nr-mode" className="form-select" value={executionMode} onChange={(e) => setExecutionMode(e.target.value as ExecutionMode)} disabled={isLoading}>
                <option value="autonomous">Autonomous — end-to-end</option>
                <option value="gated">Gated — approve code before execution</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="nr-constraints">Constraints / directives (optional)</label>
            <input
              id="nr-constraints"
              type="text"
              className="form-input"
              placeholder="e.g. Compare against standard LLM baseline with seed=42"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 11, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !question.trim()}>
              {isLoading ? (
                <><span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#131007' }} /> Initializing run…</>
              ) : (
                <><Play size={15} /> Launch Research Agent</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
