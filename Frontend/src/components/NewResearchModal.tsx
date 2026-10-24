import React, { useState } from 'react';
import { X, Sparkles, Shield, Cpu, Play, BookOpen, Layers } from 'lucide-react';
import { ExecutionMode } from '../types';

interface NewResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { question: string; domain: string; constraints: string; execution_mode: ExecutionMode }) => void;
  isLoading: boolean;
}

const TEMPLATES = [
  {
    title: 'Q1: Hybrid BM25 vs Dense Embeddings',
    question: 'How does hybrid BM25 and dense retrieval compare against dense-only embeddings in scientific domain QA?',
    domain: 'Artificial Intelligence & RAG',
    constraints: 'Evaluate recall and latency on technical terminology'
  },
  {
    title: 'Q2: Claim Verification & Hallucination Mitigation',
    question: 'How does claim-level evidence verification reduce hallucinations in AI research assistance?',
    domain: 'Agentic Fact Verification',
    constraints: 'Include NLI support scoring and reference matching'
  },
  {
    title: 'Q3: ML Experiment Reproducibility Manifests',
    question: 'What minimum execution parameters must be recorded in an execution manifest to guarantee ML reproducibility?',
    domain: 'Machine Learning Reproducibility',
    constraints: 'Record seeds, hardware specs, and metric hashes'
  },
  {
    title: 'Q4: State-Machine Orchestration vs Recursive Loops',
    question: 'Why is state-machine orchestration preferred over unconstrained recursive loops in research agents?',
    domain: 'Agent Architecture & Control',
    constraints: 'Bound agent behavior and step policies'
  }
];

export const NewResearchModal: React.FC<NewResearchModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [question, setQuestion] = useState('');
  const [domain, setDomain] = useState('Artificial Intelligence & RAG');
  const [constraints, setConstraints] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('autonomous');

  if (!isOpen) return null;

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setQuestion(tpl.question);
    setDomain(tpl.domain);
    setConstraints(tpl.constraints);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    onSubmit({
      question: question.trim(),
      domain,
      constraints,
      execution_mode: executionMode,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe' }}>
              <Sparkles size={20} color="var(--accent-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>New Research Investigation</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Initiate evidence-verified autonomous research workflow</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Templates */}
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Quick Starter Templates:</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {TEMPLATES.map((t, idx) => (
              <div
                key={idx}
                onClick={() => handleApplyTemplate(t)}
                style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eff6ff';
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={14} color="var(--accent-primary)" />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.title}</span>
                </div>
                <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600 }}>Apply Template →</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Research Question *</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="e.g. How does hybrid BM25 and dense retrieval compare against dense-only embeddings in scientific domain QA?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Scientific Domain</label>
              <select className="form-select" value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="Artificial Intelligence & RAG">AI & RAG Systems</option>
                <option value="Machine Learning Reproducibility">ML Reproducibility</option>
                <option value="Agentic Fact Verification">Fact Verification</option>
                <option value="Biomedical Informatics">Biomedical Informatics</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Execution Mode</label>
              <select className="form-select" value={executionMode} onChange={(e) => setExecutionMode(e.target.value as ExecutionMode)}>
                <option value="autonomous">Autonomous (End-to-End)</option>
                <option value="gated">Human-in-the-Loop (Gated Code Approval)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Constraints / Directives (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Compare against standard LLM baseline with seed=42"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !question.trim()}>
              {isLoading ? (
                <span>Initializing Run...</span>
              ) : (
                <>
                  <Play size={16} />
                  <span>Launch Research Agent</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
