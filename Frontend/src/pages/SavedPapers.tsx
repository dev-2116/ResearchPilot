import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, BookOpen, ExternalLink, Library, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { SavedPaper } from '../types';
import { EmptyState, ErrorNote, SectionHeader, Skeleton, fmtDate, fmtInt } from '../components/ui';
import { useToast } from '../context/ToastContext';

interface SavedPapersProps {
  onNavigateTab: (tab: string) => void;
}

export const SavedPapers: React.FC<SavedPapersProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [papers, setPapers] = useState<SavedPaper[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listSavedPapers();
      setPapers(res.papers);
    } catch (err: any) {
      setError(err?.message || 'Failed to load your library.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (paper: SavedPaper) => {
    setRemovingId(paper.id);
    try {
      await api.removeSavedPaper(paper.id);
      setPapers((prev) => prev!.filter((p) => p.id !== paper.id));
      setConfirmId(null);
      showToast({ title: 'Paper removed', message: `“${paper.title.slice(0, 60)}…” was removed from your library.`, type: 'info' });
    } catch (err: any) {
      showToast({ title: 'Remove failed', message: err?.message || String(err), type: 'error' });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="page-view">
      <div className="card">
        <SectionHeader
          icon={<Library size={17} />}
          title="Saved Papers"
          subtitle="Your personal reading list — papers you saved from Literature Discovery"
          right={
            <button className="btn btn-secondary" onClick={() => onNavigateTab('literature')} style={{ flexShrink: 0 }}>
              <BookOpen size={14} /> Find more papers
            </button>
          }
        />
        {papers && (
          <p className="section-sub" style={{ marginTop: 8 }}>
            {fmtInt(papers.length)} paper{papers.length === 1 ? '' : 's'} saved
          </p>
        )}
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}

      {papers === null && !error && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton h={13} w="70%" />
              <Skeleton h={10} w="45%" />
            </div>
          ))}
        </div>
      )}

      {papers?.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Bookmark size={20} />}
            title="Your library is empty"
            description="Search the academic APIs in Literature Discovery and use the Save button on any result to build your reading list. Saved papers persist in your account."
            action={
              <button className="btn btn-primary" onClick={() => onNavigateTab('literature')}>
                <BookOpen size={14} /> Open Literature Discovery
              </button>
            }
          />
        </div>
      )}

      {papers && papers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {papers.map((p) => (
            <div key={p.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 7 }}>
                    {p.source && <span className="badge badge-cyan">{p.source}</span>}
                    {p.publication_year && <span className="badge badge-slate">{p.publication_year}</span>}
                    {p.citation_count > 0 && <span className="badge badge-slate">{fmtInt(p.citation_count)} citations</span>}
                    <span className="badge badge-slate">Saved {fmtDate(p.saved_at)}</span>
                  </div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>{p.title}</h3>
                  {p.authors && (
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.authors}>
                      {p.authors}
                    </p>
                  )}
                  {p.venue && (
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <em>{p.venue}</em>{p.identifier ? ` · ${p.identifier}` : ''}
                    </p>
                  )}
                  {p.abstract && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.abstract}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
                  {p.url && (
                    <a className="btn btn-secondary" href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.76rem', textDecoration: 'none' }}>
                      <ExternalLink size={13} /> Source
                    </a>
                  )}
                  {confirmId === p.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-danger" style={{ fontSize: '0.74rem', padding: '6px 11px' }} onClick={() => handleRemove(p)} disabled={removingId === p.id}>
                        {removingId === p.id ? 'Removing…' : 'Confirm'}
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: '0.74rem', padding: '6px 9px' }} onClick={() => setConfirmId(null)} disabled={removingId === p.id}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.76rem', color: 'var(--text-light)' }}
                      onClick={() => setConfirmId(p.id)}
                      aria-label={`Remove ${p.title} from library`}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
