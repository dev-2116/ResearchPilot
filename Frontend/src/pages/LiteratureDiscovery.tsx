import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Database,
  ExternalLink,
  Globe,
  Import,
  Library,
  RefreshCw,
  Search,
  Bookmark,
} from 'lucide-react';
import { api } from '../services/api';
import { AcademicPaper, LiteratureSourceInfo } from '../types';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorNote, SectionHeader, Skeleton, fmtInt } from '../components/ui';

type SortKey = 'citations' | 'year' | 'relevance';

const PRESET_TOPICS = [
  'retrieval augmented generation',
  'hybrid BM25 dense retrieval',
  'LLM hallucination verification',
  'autonomous agent tool use',
  'fact verification FEVER',
];

export const LiteratureDiscovery: React.FC = () => {
  const { showToast } = useToast();

  const [queryInput, setQueryInput] = useState('retrieval augmented generation');
  const [activeQuery, setActiveQuery] = useState('');
  const [sources, setSources] = useState<LiteratureSourceInfo[]>([]);
  const [papers, setPapers] = useState<AcademicPaper[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [totalFound, setTotalFound] = useState(0);
  const [sourcesQueried, setSourcesQueried] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('citations');
  const [ingestedIds, setIngestedIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const resultTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getLiteratureSources()
      .then((res) => setSources(res.sources || []))
      .catch((e) => console.warn('Literature sources unavailable:', e));

    // Mark papers already present in the user's saved library
    api.listSavedPapers()
      .then((res) => {
        const map: Record<string, boolean> = {};
        res.papers.forEach((p) => { if (p.identifier) map[p.identifier] = true; });
        setSavedIds(map);
      })
      .catch(() => { /* library state is optional decoration */ });
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      showToast({ title: 'Query too short', message: 'Enter at least 2 characters to search the academic APIs.', type: 'warning' });
      return;
    }
    setIsLoading(true);
    setError(null);
    setActiveQuery(trimmed);
    setHasSearched(true);
    try {
      const res: any = await api.searchLiterature(trimmed, undefined, 6);
      setPapers(res.papers || []);
      setSourceCounts(res.source_counts || {});
      setTotalFound(res.total_found || res.papers?.length || 0);
      setSourcesQueried(res.sources_queried || []);
      setExpanded({});
    } catch (err: any) {
      setError(
        'Literature search failed — the external academic APIs (Semantic Scholar / OpenAlex / Crossref) may be unreachable from this network. ' +
        (err?.message || '')
      );
      setPapers([]);
      setTotalFound(0);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const visiblePapers = (() => {
    let list = papers;
    if (sourceFilter !== 'all') list = list.filter((p) => p.source === sourceFilter);
    const sorted = [...list];
    if (sortBy === 'citations') sorted.sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
    if (sortBy === 'year') sorted.sort((a, b) => (b.publication_year || 0) - (a.publication_year || 0));
    if (sortBy === 'relevance') sorted.sort((a, b) => papers.indexOf(a) - papers.indexOf(b));
    return sorted;
  })();

  const handleImport = async (list: AcademicPaper[]) => {
    if (list.length === 0) return;
    setIsBulkImporting(true);
    try {
      const res = await api.importLiteraturePapers(list);
      const map: Record<string, boolean> = { ...ingestedIds };
      list.forEach((p) => { map[p.id] = true; });
      setIngestedIds(map);
      showToast({
        title: 'Imported to research corpus',
        message: `${res.ingested_count} paper(s) ingested — ${res.total_active_papers} now active for retrieval & verification.`,
        type: 'success',
      });
    } catch (err: any) {
      showToast({ title: 'Import failed', message: err?.message || String(err), type: 'error' });
    } finally {
      setIsBulkImporting(false);
    }
  };

  const handleSave = async (p: AcademicPaper) => {
    try {
      const res = await api.savePaper(p);
      if (res.status === 'already_saved') {
        setSavedIds((m) => ({ ...m, [p.identifier || p.title]: true }));
        showToast({ title: 'Already saved', message: 'This paper is already in your library.', type: 'info' });
      } else {
        setSavedIds((m) => ({ ...m, [p.identifier || p.title]: true }));
        showToast({ title: 'Saved to library', message: `“${p.title.slice(0, 60)}…” added to Saved Papers.`, type: 'success' });
      }
    } catch (err: any) {
      showToast({ title: 'Save failed', message: err?.message || String(err), type: 'error' });
    }
  };

  const notYetIngested = visiblePapers.filter((p) => !ingestedIds[p.id]);

  return (
    <div className="page-view">
      {/* Search header */}
      <div className="card">
        <SectionHeader
          icon={<Globe size={17} />}
          title="Literature Discovery"
          subtitle="Live search across Semantic Scholar, OpenAlex and Crossref — results are real API responses"
        />

        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(queryInput); }}
          style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={15} color="var(--text-light)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search papers, e.g. retrieval augmented generation…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              aria-label="Literature search query"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
            <span>{isLoading ? 'Searching…' : 'Search'}</span>
          </button>
        </form>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 11 }}>
          {PRESET_TOPICS.map((t) => (
            <button key={t} type="button" className={`seg-btn ${queryInput === t ? 'active' : ''}`} onClick={() => { setQueryInput(t); runSearch(t); }}>
              {t}
            </button>
          ))}
        </div>

        {/* Connected sources — real status from backend */}
        {sources.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--border-subtle)' }}>
            {sources.map((s) => (
              <span key={s.id} className="badge badge-slate" title={s.description}>
                <Globe size={11} color="var(--accent-blue)" /> {s.name} · {s.status}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <ErrorNote message={error} onRetry={() => runSearch(activeQuery || queryInput)} />}

      {/* Initial state */}
      {!hasSearched && !isLoading && (
        <div className="card">
          <EmptyState
            icon={<BookOpen size={20} />}
            title="Search the academic literature"
            description="Enter a query above or pick a preset topic. Results come live from the connected scholarly APIs with real metadata — titles, authors, venues, citation counts and abstracts."
          />
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <Skeleton h={13} w="65%" />
              <Skeleton h={10} w="40%" />
              <Skeleton h={10} w="92%" />
              <Skeleton h={10} w="85%" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && papers.length > 0 && (
        <>
          <div className="card" ref={resultTopRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge badge-emerald">{fmtInt(totalFound)} results</span>
                {Object.entries(sourceCounts).map(([src, n]) => (
                  <button
                    key={src}
                    className={`seg-btn ${sourceFilter === src ? 'active' : ''}`}
                    style={{ padding: '3px 10px', fontSize: '0.72rem' }}
                    onClick={() => setSourceFilter(sourceFilter === src ? 'all' : src)}
                    title={`Show only ${src} results`}
                  >
                    {src} ({n})
                  </button>
                ))}
                {sourceFilter !== 'all' && (
                  <button className="seg-btn" style={{ padding: '3px 10px', fontSize: '0.72rem' }} onClick={() => setSourceFilter('all')}>
                    Clear filter ×
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                <label className="form-label" htmlFor="lit-sort" style={{ marginBottom: 0 }}>Sort</label>
                <select id="lit-sort" className="form-select" style={{ width: 140, paddingTop: 6, paddingBottom: 6 }} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
                  <option value="citations">Citations</option>
                  <option value="year">Publication year</option>
                  <option value="relevance">API relevance</option>
                </select>
                {notYetIngested.length > 0 && (
                  <button className="btn btn-secondary" onClick={() => handleImport(notYetIngested)} disabled={isBulkImporting}>
                    <Import size={13} /> Import all ({notYetIngested.length})
                  </button>
                )}
              </div>
            </div>
            {sourceFilter !== 'all' && sourceCounts[sourceFilter] !== undefined && (
              <p className="section-sub" style={{ marginTop: 8 }}>
                Showing {visiblePapers.length} of {fmtInt(papers.length)} results from {sourceFilter}
              </p>
            )}
          </div>

          {visiblePapers.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No results from this source"
                description="Try clearing the source filter or searching a broader query."
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visiblePapers.map((p) => {
                const key = p.identifier || p.title;
                const isOpen = expanded[p.id];
                return (
                  <div key={p.id} className="card" style={{ padding: 17 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 7 }}>
                          <span className="badge badge-cyan">{p.source}</span>
                          {p.publication_year ? <span className="badge badge-slate">{p.publication_year}</span> : <span className="badge badge-slate">Year N/A</span>}
                          <span className="badge badge-slate">{fmtInt(p.citation_count)} citations</span>
                          {p.venue && <span className="badge badge-slate" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.venue}>{p.venue}</span>}
                        </div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>{p.title}</h3>
                        {p.authors && (
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.authors}>
                            {p.authors}
                          </p>
                        )}
                        {p.abstract ? (
                          <p
                            style={{
                              fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 4,
                              display: isOpen ? 'block' : '-webkit-box',
                              WebkitLineClamp: isOpen ? undefined : 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {p.abstract}
                          </p>
                        ) : (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontStyle: 'italic', marginTop: 4 }}>
                            Abstract not provided by {p.source} for this record.
                          </p>
                        )}
                        {p.abstract && p.abstract.length > 180 && (
                          <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '3px 6px', marginTop: 4 }} onClick={() => setExpanded((m) => ({ ...m, [p.id]: !m[p.id] }))}>
                            {isOpen ? 'Show less' : 'Show full abstract'}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
                        {p.url && (
                          <a className="btn btn-secondary" href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.74rem', textDecoration: 'none', padding: '6px 11px' }}>
                            <ExternalLink size={12} /> Source
                          </a>
                        )}
                        <button
                          className={`btn ${savedIds[key] ? 'btn-success' : 'btn-secondary'}`}
                          style={{ fontSize: '0.74rem', padding: '6px 11px' }}
                          onClick={() => handleSave(p)}
                          disabled={!!savedIds[key]}
                          title={savedIds[key] ? 'Already in your library' : 'Save to your library'}
                        >
                          {savedIds[key] ? <Check size={12} /> : <Bookmark size={12} />}
                          <span>{savedIds[key] ? 'Saved' : 'Save'}</span>
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '6px 11px' }}
                          onClick={() => handleImport([p])}
                          disabled={!!ingestedIds[p.id] || isBulkImporting}
                          title="Add to the retrieval corpus used for claim verification"
                        >
                          {ingestedIds[p.id] ? <Check size={12} color="var(--accent-emerald)" /> : <Database size={12} />}
                          <span>{ingestedIds[p.id] ? 'In corpus' : 'To corpus'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="chart-tooltip-note" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Library size={12} /> “Save” stores a paper in your personal library; “To corpus” ingests it into the retrieval index used by verification runs.
          </p>
        </>
      )}

      {/* Honest empty result */}
      {hasSearched && !isLoading && !error && papers.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Search size={20} />}
            title={`No papers found for “${activeQuery}”`}
            description="The academic APIs returned no matches. Try different keywords or a broader topic."
          />
        </div>
      )}
    </div>
  );
};
