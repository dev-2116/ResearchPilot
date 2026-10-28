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
    title: 'Quantum Surface Codes & Fault Tolerance',
    question: 'How do 2D surface codes and topological syndrome extraction scale against physical qubit decoherence rates in superconducting processors?',
    domain: 'Quantum Information & Fault-Tolerant Computing',
    constraints: 'Evaluate fault-tolerance threshold (1%) and logical error suppression with distance d'
  },
  {
    title: 'CRISPR Epigenetic Silencing in CAR-T',
    question: 'How does multiplex CRISPR-Cas9 targeted epigenetic silencing enhance CAR-T cell functional persistence in solid tumor microenvironments?',
    domain: 'Biomedical Oncology & Gene Therapy',
    constraints: 'Analyze T-cell exhaustion markers (PDCD1, CTLA4, TGFBR2) and chromatin remodeling'
  },
  {
    title: 'Perovskite-Silicon Tandem Solar Stability',
    question: 'What molecular degradation pathways govern operational stability in perovskite-silicon tandem solar cells under accelerated thermal cycling?',
    domain: 'Renewable Energy & Photovoltaics',
    constraints: 'Focus on halide phase segregation, volatile cation egress, and self-assembled monolayers'
  },
  {
    title: 'Closed-Loop Intracortical BCI Drift Mitigation',
    question: 'How do closed-loop intracortical brain-computer interfaces mitigate chronic electrode impedance increases and decoder drift over long-term implantation?',
    domain: 'Neuroscience & Neural Engineering',
    constraints: 'Evaluate latent neural manifold alignment (GPFA) and foreign body response mitigation'
  },
  {
    title: '2D MXene & Graphene Supercapacitors',
    question: 'How do 2D MXene and graphene heterostructure architectures prevent restacking and improve volumetric capacitance in electrochemical energy storage?',
    domain: 'Materials Science & Nanotechnology',
    constraints: 'Quantify sub-nanometer ion channels, redox pseudocapacitance, and rate capability (>10 V/s)'
  },
  {
    title: 'Ultra-Diffuse Galaxies & Dark Matter vs MOND',
    question: 'How do ultra-diffuse galaxies deficient in dark matter constrain cold dark matter halo dynamics versus modified gravity theories?',
    domain: 'Astrophysics & Observational Cosmology',
    constraints: 'Examine NGC 1052-DF2/DF4 kinematic velocity dispersions vs MOND universal acceleration'
  },
  {
    title: 'AMM Bonding Curves & Market Microstructure',
    question: 'How do automated market maker constant-product bonding curves impact liquidity fragmentation and adverse selection in decentralized financial exchanges?',
    domain: 'Computational Economics & Market Microstructure',
    constraints: 'Evaluate loss-versus-rebalancing (LVR) and arbitrage extraction latency'
  },
  {
    title: 'C4 Cereal Crop Drought Resilience QTLs',
    question: 'What transcription factor networks and root architecture QTLs govern drought resilience and osmotic adjustment in C4 cereal crops?',
    domain: 'Agricultural Biotechnology & Plant Genomics',
    constraints: 'Analyze ABA signaling pathways, stomatal conductance regulation, and yield stability'
  },
  {
    title: 'Ocean Acidification & Coral Calcification Kinetics',
    question: 'How do synergistic ocean acidification and marine heatwaves affect aragonite saturation states and coral calcification kinetics?',
    domain: 'Marine Biogeochemistry & Climate Ecology',
    constraints: 'Assess carbonate ion saturation omega_arag and symbiont expulsion under acute thermal stress'
  },
  {
    title: 'MPPI Adaptive Control in Soft Actuators',
    question: 'How do model predictive path integral algorithms achieve adaptive trajectory tracking under uncertain soft-actuator dynamics and contact compliance?',
    domain: 'Robotics & Autonomous Soft Manipulation',
    constraints: 'Examine stochastic sampling horizon, non-linear continuum mechanics, and real-time GPU control'
  },
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
  }
];

const DOMAIN_OPTIONS = [
  'Quantum Information & Fault-Tolerant Computing',
  'Biomedical Oncology & Gene Therapy',
  'Renewable Energy & Photovoltaics',
  'Neuroscience & Neural Engineering',
  'Materials Science & Nanotechnology',
  'Astrophysics & Observational Cosmology',
  'Computational Economics & Market Microstructure',
  'Agricultural Biotechnology & Plant Genomics',
  'Marine Biogeochemistry & Climate Ecology',
  'Robotics & Autonomous Soft Manipulation',
  'Artificial Intelligence & RAG',
  'Machine Learning Reproducibility',
  'Agentic Fact Verification',
  'Biomedical Informatics',
  'Agent Architecture & Control',
  'Open Scientific Research'
];

export const NewResearchModal: React.FC<NewResearchModalProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [question, setQuestion] = useState('');
  const [domain, setDomain] = useState('Quantum Information & Fault-Tolerant Computing');
  const [customDomain, setCustomDomain] = useState('');
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [constraints, setConstraints] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('autonomous');
  const [touched, setTouched] = useState(false);

  if (!isOpen) return null;

  const questionInvalid = touched && !question.trim();

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setQuestion(tpl.question);
    setDomain(tpl.domain);
    setIsCustomDomain(!DOMAIN_OPTIONS.includes(tpl.domain));
    setConstraints(tpl.constraints);
    setTouched(false);
  };

  const activeDomain = isCustomDomain ? (customDomain.trim() || 'Open Scientific Research') : domain;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!question.trim()) return;
    onSubmit({
      question: question.trim(),
      domain: activeDomain,
      constraints,
      execution_mode: executionMode,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onClose(); }}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="New research investigation" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="form-label" style={{ margin: 0 }}>Curated Benchmark & Domain Templates</label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{TEMPLATES.length} topics</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '160px', overflowY: 'auto', paddingRight: 4 }}>
            {TEMPLATES.map((t, idx) => (
              <button
                key={idx}
                type="button"
                className="link-row"
                onClick={() => handleApplyTemplate(t)}
                disabled={isLoading}
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <BookOpen size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-card-subtle)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{t.domain}</span>
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
              placeholder="e.g. How do 2D surface codes and topological syndrome extraction scale against physical qubit decoherence rates in superconducting processors?"
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="form-label" htmlFor="nr-domain" style={{ margin: 0 }}>Scientific domain</label>
                <button
                  type="button"
                  onClick={() => setIsCustomDomain(!isCustomDomain)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                >
                  {isCustomDomain ? 'Pick from list' : 'Custom domain'}
                </button>
              </div>

              {isCustomDomain ? (
                <input
                  id="nr-domain-custom"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Quantum Information & Fault-Tolerant Computing"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <select
                  id="nr-domain"
                  className="form-select"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isLoading}
                >
                  {DOMAIN_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
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
              placeholder="e.g. Evaluate fault-tolerance threshold (1%) and logical error suppression with distance d"
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
                <><span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF' }} /> Initializing run…</>
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
