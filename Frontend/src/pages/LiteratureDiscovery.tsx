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
  FileText,
  Quote,
  Calendar,
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
      {/* Prominent Search Hero Card */}
      <div className="card" style={{ padding: '28px 28px 22px' }}>
        <div style={{ maxWidth: 740, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="badge badge-cyan"><Globe size={12} /> Scholarly Index</span>
            <span className="badge badge-slate">Real API Retrieval</span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Academic Literature Discovery
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>
            Search peer-reviewed preprints and publications across Semantic Scholar, OpenAlex, and Crossref with verified citations and provenance metadata.
          </p>
        </div>

        {/* Wide rounded search input */}
        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(queryInput); }}
          className="search-bar-prominent"
        >
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            className="search-input-pill"
            placeholder="Search papers by keyword, concept, or author (e.g. retrieval augmented generation)…"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            aria-label="Literature search query"
          />
          <button type="submit" className="btn btn-primary search-btn-pill" disabled={isLoading}>
            {isLoading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
            <span>{isLoading ? 'Searching…' : 'Search Literature'}</span>
          </button>
        </form>

        {/* Preset Topic Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Suggested:</span>
          {PRESET_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              className={`seg-btn ${queryInput === t ? 'active' : ''}`}
              style={{ fontSize: '0.74rem', padding: '4px 12px' }}
              onClick={() => { setQueryInput(t); runSearch(t); }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Connected scholarly sources */}
        {sources.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            {sources.map((s) => (
              <span key={s.id} className="badge badge-slate" title={s.description}>
                <Globe size={11} color="var(--accent-primary)" /> {s.name} · {s.status}
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
            icon={<BookOpen size={22} />}
            title="Search the academic literature"
            description="Enter a query above or choose a suggested research topic. Real papers are retrieved live from connected scholarly databases with titles, authors, venues, citation counts, and abstracts."
          />
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton h={15} w="65%" />
              <Skeleton h={11} w="40%" />
              <Skeleton h={11} w="90%" />
              <Skeleton h={11} w="82%" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && papers.length > 0 && (
        <>
          {/* Controls Bar */}
          <div className="card" ref={resultTopRef} style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge badge-cyan" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                  {fmtInt(totalFound)} results found
                </span>
                {Object.entries(sourceCounts).map(([src, n]) => (
                  <button
                    key={src}
                    className={`seg-btn ${sourceFilter === src ? 'active' : ''}`}
                    style={{ padding: '4px 12px', fontSize: '0.74rem' }}
                    onClick={() => setSourceFilter(sourceFilter === src ? 'all' : src)}
                    title={`Filter by ${src}`}
                  >
                    {src} ({n})
                  </button>
                ))}
                {sourceFilter !== 'all' && (
                  <button className="seg-btn" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => setSourceFilter('all')}>
                    Clear filter ×
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label className="form-label" htmlFor="lit-sort" style={{ marginBottom: 0, fontSize: '0.72rem' }}>Sort by</label>
                <select
                  id="lit-sort"
                  className="form-select"
                  style={{ width: 150, paddingTop: 6, paddingBottom: 6, fontSize: '0.8rem' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                >
                  <option value="citations">Most Citations</option>
                  <option value="year">Latest Year</option>
                  <option value="relevance">API Relevance</option>
                </select>
                {notYetIngested.length > 0 && (
                  <button className="btn btn-secondary" onClick={() => handleImport(notYetIngested)} disabled={isBulkImporting} style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
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
                title="No results for this filter"
                description="Try selecting 'All' or searching for a broader academic topic."
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visiblePapers.map((p) => {
                const key = p.identifier || p.title;
                const isOpen = expanded[p.id];
                return (
                  <div key={p.id} className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
                      {/* Left thumbnail indicator */}
                      <div
                        style={{
                          width: 44, height: 44, borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-soft-blue)', border: '1px solid var(--accent-primary-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2,
                        }}
                        title={p.source}
                      >
                        <FileText size={20} />
                      </div>

                      {/* Main paper information */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                          <span className="badge badge-cyan">{p.source}</span>
                          {p.publication_year ? (
                            <span className="badge badge-slate"><Calendar size={11} /> {p.publication_year}</span>
                          ) : (
                            <span className="badge badge-slate">Year N/A</span>
                          )}
                          <span className="badge badge-slate"><Quote size={11} /> {fmtInt(p.citation_count)} citations</span>
                          {p.venue && (
                            <span className="badge badge-slate" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.venue}>
                              {p.venue}
                            </span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '1.02rem', fontWeight: 700, lineHeight: 1.4, marginBottom: 5, color: 'var(--text-primary)' }}>
                          {p.url ? (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                              {p.title}
                            </a>
                          ) : (
                            p.title
                          )}
                        </h3>

                        {p.authors && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.authors}>
                            {p.authors}
                          </p>
                        )}

                        {p.abstract ? (
                          <p
                            style={{
                              fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6,
                              display: isOpen ? 'block' : '-webkit-box',
                              WebkitLineClamp: isOpen ? undefined : 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {p.abstract}
                          </p>
                        ) : (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                            Abstract not provided by {p.source} for this record.
                          </p>
                        )}

                        {p.abstract && p.abstract.length > 180 && (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: '0.74rem', padding: '4px 8px', marginTop: 6, color: 'var(--accent-primary)', fontWeight: 600 }}
                            onClick={() => setExpanded((m) => ({ ...m, [p.id]: !m[p.id] }))}
                          >
                            {isOpen ? 'Show less' : 'Show full abstract'}
                          </button>
                        )}
                      </div>

                      {/* Right action controls */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
                        {p.url && (
                          <a
                            className="btn btn-secondary"
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.76rem', textDecoration: 'none', padding: '6px 12px' }}
                          >
                            <ExternalLink size={12} /> Source
                          </a>
                        )}
                        <button
                          className={`btn ${savedIds[key] ? 'btn-success' : 'btn-secondary'}`}
                          style={{ fontSize: '0.76rem', padding: '6px 12px' }}
                          onClick={() => handleSave(p)}
                          disabled={!!savedIds[key]}
                          title={savedIds[key] ? 'Already in your library' : 'Save to your library'}
                        >
                          {savedIds[key] ? <Check size={13} /> : <Bookmark size={13} />}
                          <span>{savedIds[key] ? 'Saved' : 'Save'}</span>
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.76rem', padding: '6px 12px' }}
                          onClick={() => handleImport([p])}
                          disabled={!!ingestedIds[p.id] || isBulkImporting}
                          title="Add to the retrieval corpus used for claim verification"
                        >
                          {ingestedIds[p.id] ? <Check size={13} color="var(--accent-emerald)" /> : <Database size={13} />}
                          <span>{ingestedIds[p.id] ? 'In corpus' : 'To corpus'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="chart-tooltip-note" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Library size={12} /> “Save” stores a paper in your personal library; “To corpus” ingests it into the retrieval index used by verification runs.
          </p>
        </>
      )}

      {/* Honest empty result */}
      {hasSearched && !isLoading && !error && papers.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Search size={22} />}
            title={`No papers found for “${activeQuery}”`}
            description="The academic APIs returned no matches. Try different keywords or select a suggested topic above."
          />
        </div>
      )}
    </div>
  );
};
