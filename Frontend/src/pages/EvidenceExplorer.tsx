import React, { useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  HelpCircle,
  Info,
  Search,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react';
import { Claim, VerificationStatus } from '../types';
import { EmptyState, SectionHeader } from '../components/ui';

interface EvidenceExplorerProps {
  claims: Claim[];
  isLoading: boolean;
}

const STATUS_META: Record<string, { badge: string; icon: React.ReactNode; label: string }> = {
  SUPPORTED: { badge: 'badge-emerald', icon: <ShieldCheck size={12} />, label: 'SUPPORTED' },
  REFUTED: { badge: 'badge-rose', icon: <AlertOctagon size={12} />, label: 'REFUTED' },
  INSUFFICIENT_EVIDENCE: { badge: 'badge-amber', icon: <HelpCircle size={12} />, label: 'INSUFFICIENT EVIDENCE' },
  UNVERIFIED: { badge: 'badge-slate', icon: <HelpCircle size={12} />, label: 'UNVERIFIED' },
};

const ENTAILMENT_META: Record<string, { badge: string; label: string }> = {
  ENTAILED: { badge: 'badge-emerald', label: 'ENTAILED (NLI)' },
  CONTRADICTION: { badge: 'badge-rose', label: 'CONTRADICTION' },
  NEUTRAL: { badge: 'badge-amber', label: 'NEUTRAL' },
};

export const EvidenceExplorer: React.FC<EvidenceExplorerProps> = ({ claims, isLoading }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const counts = {
    supported: claims.filter((c) => c.verification_status === 'SUPPORTED').length,
    refuted: claims.filter((c) => c.verification_status === 'REFUTED').length,
    insufficient: claims.filter((c) => !['SUPPORTED', 'REFUTED'].includes(c.verification_status)).length,
  };
  const total = claims.length;

  const filteredClaims = claims.filter((c) => {
    if (filter === 'ALL') return true;
    if (filter === 'INSUFFICIENT_EVIDENCE') return !['SUPPORTED', 'REFUTED'].includes(c.verification_status);
    return c.verification_status === filter;
  });

  const selectedClaim =
    claims.find((c) => c.id === selectedClaimId) || filteredClaims[0] || claims[0] || null;

  const getStatusBadge = (status: VerificationStatus) => {
    const meta = STATUS_META[status] || STATUS_META.UNVERIFIED;
    return <span className={`badge ${meta.badge}`}>{meta.icon} {meta.label}</span>;
  };

  const getEntailmentBadge = (type: string) => {
    const meta = ENTAILMENT_META[type] || ENTAILMENT_META.NEUTRAL;
    return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
  };

  const FILTERS = [
    { id: 'ALL', label: 'All' },
    { id: 'SUPPORTED', label: `Supported (${counts.supported})` },
    { id: 'REFUTED', label: `Refuted (${counts.refuted})` },
    { id: 'INSUFFICIENT_EVIDENCE', label: `Insufficient (${counts.insufficient})` },
  ];

  return (
    <div className="page-view">
      <div className="card">
        <SectionHeader
          icon={<Search size={17} />}
          title="Evidence & Claim Provenance Explorer"
          subtitle="Decomposed factual assertions mapped to retrieved literature passages"
        />

        {claims.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 7 }}>
              <span>Verification distribution · <strong style={{ color: 'var(--text-secondary)' }}>{total} claims</strong></span>
              <span style={{ display: 'inline-flex', gap: 12 }}>
                <span style={{ color: 'var(--accent-emerald)' }}>{counts.supported} supported</span>
                <span style={{ color: 'var(--accent-rose)' }}>{counts.refuted} refuted</span>
                <span style={{ color: 'var(--accent-amber)' }}>{counts.insufficient} insufficient</span>
              </span>
            </div>
            <div className="progress-track" style={{ display: 'flex', height: 8 }}>
              {total > 0 && (
                <>
                  <div style={{ width: `${(counts.supported / total) * 100}%`, background: 'var(--accent-emerald)' }} title={`Supported: ${counts.supported}`} />
                  <div style={{ width: `${(counts.refuted / total) * 100}%`, background: 'var(--accent-rose)' }} title={`Refuted: ${counts.refuted}`} />
                  <div style={{ width: `${(counts.insufficient / total) * 100}%`, background: 'var(--accent-amber)' }} title={`Insufficient: ${counts.insufficient}`} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Honest methodology note (HCI Rule 5/8) */}
        <div style={{
          marginTop: 14, display: 'flex', gap: 9, alignItems: 'flex-start',
          background: 'var(--accent-blue-light)', border: '1px solid var(--accent-blue-border)',
          borderRadius: 'var(--radius-md)', padding: '10px 13px', fontSize: '0.76rem',
          color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          <Info size={14} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Confidence and support scores come from the built-in lexical/NLI <strong>heuristic verifier</strong>.
            They indicate how strongly retrieved passages align with each claim — they are not calibrated
            scientific probabilities. Inspect the quoted passages and judge for yourself.
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="card"><div className="loading-spinner" style={{ margin: '40px auto', display: 'block' }} /></div>
      ) : claims.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search size={20} />}
            title="No claims to explore yet"
            description="Claims appear here once an investigation run has completed its VERIFY stage. Select or launch a run from the Research Workspace, then return to this page."
          />
        </div>
      ) : (
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
          {/* Claims list */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h3 className="section-heading">Decomposed Claims ({filteredClaims.length})</h3>
            </div>

            <div className="seg-group" style={{ marginBottom: 14 }}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`seg-btn ${filter === f.id ? 'active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto', paddingRight: 2 }}>
              {filteredClaims.length === 0 ? (
                <EmptyState title="No claims match this filter" description="Try a different verification status filter." />
              ) : (
                filteredClaims.map((claim) => {
                  const isSelected = selectedClaim?.id === claim.id;
                  return (
                    <div
                      key={claim.id}
                      onClick={() => setSelectedClaimId(claim.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedClaimId(claim.id); } }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      style={{
                        padding: '13px 15px',
                        background: isSelected ? 'var(--accent-primary-light)' : 'var(--bg-card-subtle)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary-border)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>{claim.id}</span>
                        {getStatusBadge(claim.verification_status)}
                      </div>
                      <p style={{ fontSize: '0.86rem', fontWeight: 600, lineHeight: 1.5, marginBottom: 8 }}>
                        “{claim.text}”
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <span>Heuristic confidence: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{Math.round(claim.confidence * 100)}%</strong></span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {claim.evidence.length} source{claim.evidence.length === 1 ? '' : 's'} <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Evidence passages */}
          <div className="card">
            {selectedClaim ? (
              <>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 13, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{selectedClaim.id} · provenance</span>
                    {getStatusBadge(selectedClaim.verification_status)}
                  </div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: 6 }}>“{selectedClaim.text}”</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {selectedClaim.explanation || 'No verifier explanation was recorded for this claim.'}
                  </p>
                </div>

                <h4 className="text-muted-caps" style={{ marginBottom: 10 }}>
                  Retrieved source passages ({selectedClaim.evidence.length})
                </h4>

                {selectedClaim.evidence.length === 0 ? (
                  <EmptyState
                    icon={<BookOpen size={18} />}
                    title="No passages retrieved for this claim"
                    description="With no supporting or contradicting passage, the verifier classifies the claim as insufficient evidence rather than guessing."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13, maxHeight: 480, overflowY: 'auto', paddingRight: 2 }}>
                    {selectedClaim.evidence.map((ev, idx) => (
                      <div
                        key={ev.id || idx}
                        style={{
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: 15,
                          display: 'flex', flexDirection: 'column', gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                              <BookOpen size={13} color="var(--accent-blue)" />
                              <h5 style={{ fontSize: '0.86rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.document_title}>
                                {ev.document_title}
                              </h5>
                            </div>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              {ev.document_authors} · <span className="mono" style={{ color: 'var(--accent-blue)' }}>{ev.document_identifier}</span>
                            </span>
                          </div>
                          {getEntailmentBadge(ev.entailment_type)}
                        </div>

                        <blockquote className="passage-quote" style={{ margin: 0 }}>
                          “{ev.passage_text}”
                        </blockquote>

                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span>Retrieval score: <strong className="mono">{typeof ev.retrieval_score === 'number' ? ev.retrieval_score.toFixed(3) : 'N/A'}</strong></span>
                          <span>NLI support: <strong className="mono" style={{ color: 'var(--accent-emerald)' }}>{typeof ev.support_score === 'number' ? `${(ev.support_score * 100).toFixed(1)}%` : 'N/A'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<Search size={18} />}
                title="Select a claim"
                description="Choose a claim on the left to inspect its linked literature provenance."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
