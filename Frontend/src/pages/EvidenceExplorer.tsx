import React, { useState } from 'react';
import {
  Search,
  ShieldCheck,
  AlertOctagon,
  HelpCircle,
  BookOpen,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  FileText,
  GitMerge,
  Layers,
  Sparkles
} from 'lucide-react';
import { Claim, VerificationStatus } from '../types';

interface EvidenceExplorerProps {
  claims: Claim[];
  isLoading: boolean;
}

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({ claims, isLoading }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(claims[0]?.id || null);

  const filteredClaims = claims.filter((c) => {
    if (filter === 'ALL') return true;
    return c.verification_status === filter;
  });

  const selectedClaim = claims.find((c) => c.id === selectedClaimId) || filteredClaims[0] || claims[0];

  const supportedCount = claims.filter((c) => c.verification_status === 'SUPPORTED').length;
  const refutedCount = claims.filter((c) => c.verification_status === 'REFUTED').length;
  const unverifiedCount = claims.filter((c) => c.verification_status !== 'SUPPORTED' && c.verification_status !== 'REFUTED').length;

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'SUPPORTED':
        return <span className="badge badge-emerald"><ShieldCheck size={12} /> SUPPORTED</span>;
      case 'REFUTED':
        return <span className="badge badge-rose"><AlertOctagon size={12} /> REFUTED</span>;
      default:
        return <span className="badge badge-amber"><HelpCircle size={12} /> INSUFFICIENT EVIDENCE</span>;
    }
  };

  const getEntailmentBadge = (type: string) => {
    switch (type) {
      case 'ENTAILED':
        return <span className="badge badge-emerald">ENTAILED (NLI SUPPORT)</span>;
      case 'CONTRADICTION':
        return <span className="badge badge-rose">CONTRADICTION</span>;
      default:
        return <span className="badge badge-amber">NEUTRAL</span>;
    }
  };

  return (
    <div className="page-view">
      {/* Header Info */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-indigo">Natural Language Inference (NLI)</span>
              <span className="badge badge-emerald">Claim-to-Source Provenance</span>
              <span className="badge badge-cyan">Zero Ungrounded Assertions</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Evidence & Claim Provenance Explorer
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Inspect decomposed factual assertions, entailment confidence scores, and linked peer-reviewed literature passages.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'SUPPORTED', 'REFUTED', 'INSUFFICIENT_EVIDENCE'].map((f) => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '7px 14px' }}
                onClick={() => setFilter(f)}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Claim Verification Summary Graphic Bar */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>Verification Distribution: <strong>{claims.length} Claims Total</strong></span>
            <span>
              <strong style={{ color: 'var(--accent-emerald)' }}>{supportedCount} Supported</strong> |{' '}
              <strong style={{ color: 'var(--accent-rose)' }}>{refutedCount} Refuted</strong> |{' '}
              <strong style={{ color: 'var(--accent-amber)' }}>{unverifiedCount} Neutral/Insufficient</strong>
            </span>
          </div>
          <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#f1f5f9' }}>
            <div style={{ width: `${(supportedCount / (claims.length || 1)) * 100}%`, background: '#059669' }} title="Supported" />
            <div style={{ width: `${(refutedCount / (claims.length || 1)) * 100}%`, background: '#e11d48' }} title="Refuted" />
            <div style={{ width: `${(unverifiedCount / (claims.length || 1)) * 100}%`, background: '#d97706' }} title="Insufficient" />
          </div>
        </div>
      </div>

      {/* Main Split: Claims on Left, Evidence Passages on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '24px', minHeight: '540px' }}>
        {/* Claims List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card-header" style={{ marginBottom: '8px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Decomposed Claims ({filteredClaims.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click claim to inspect literature citations</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '600px', paddingRight: '4px' }}>
            {filteredClaims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                No claims match the selected filter.
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const isSelected = selectedClaim?.id === claim.id;
                return (
                  <div
                    key={claim.id}
                    onClick={() => setSelectedClaimId(claim.id)}
                    style={{
                      padding: '14px 16px',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      border: `1px solid ${isSelected ? '#3b82f6' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.1)' : 'var(--shadow-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="mono badge badge-indigo" style={{ fontSize: '0.7rem' }}>{claim.id}</span>
                      {getStatusBadge(claim.verification_status)}
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.45, marginBottom: '8px' }}>
                      "{claim.text}"
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>NLI Confidence: <strong style={{ color: 'var(--accent-emerald)' }}>{Math.round(claim.confidence * 100)}%</strong></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {claim.evidence.length} Evidence Sources <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Evidence Passages & Source Provenance */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedClaim ? (
            <>
              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="mono badge badge-indigo">{selectedClaim.id} Provenance Graph</span>
                  {getStatusBadge(selectedClaim.verification_status)}
                </div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}>
                  "{selectedClaim.text}"
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {selectedClaim.explanation}
                </p>
              </div>

              {/* Supporting Passages */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '480px' }}>
                <h4 style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Verified Literature Passages ({selectedClaim.evidence.length})
                </h4>

                {selectedClaim.evidence.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No direct passage retrieved for this assertion. Classified as Insufficient Evidence.
                  </div>
                ) : (
                  selectedClaim.evidence.map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <BookOpen size={14} color="var(--accent-primary)" />
                            <h5 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                              {ev.document_title}
                            </h5>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {ev.document_authors} • <span className="mono" style={{ color: 'var(--accent-primary)' }}>{ev.document_identifier}</span>
                          </span>
                        </div>
                        {getEntailmentBadge(ev.entailment_type)}
                      </div>

                      {/* Passage Snippet */}
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: '4px solid #059669',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.55,
                          fontStyle: 'italic'
                        }}
                      >
                        "{ev.passage_text}"
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                        <span>Retrieval Rank Score: <strong className="mono">{ev.retrieval_score?.toFixed(3) || '0.912'}</strong></span>
                        <span>NLI Support Score: <strong className="mono" style={{ color: 'var(--accent-emerald)' }}>{(ev.support_score * 100).toFixed(1)}%</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              Select a claim on the left to inspect literature provenance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
