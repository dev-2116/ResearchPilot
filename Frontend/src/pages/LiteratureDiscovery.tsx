import React, { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  ExternalLink,
  Download,
  CheckCircle2,
  Filter,
  Sparkles,
  Layers,
  Globe,
  Database,
  Calendar,
  Users,
  Award,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Library,
  X,
  ArrowUpDown
} from 'lucide-react';
import { api } from '../services/api';
import { AcademicPaper, LiteratureSourceInfo } from '../types';
import { useToast } from '../context/ToastContext';

export const LiteratureDiscovery: React.FC = () => {
  const { showToast } = useToast();

  const [query, setQuery] = useState('retrieval augmented generation');
  const [activeSourceFilter, setActiveSourceFilter] = useState<'all' | 'OpenAlex' | 'Crossref' | 'Semantic Scholar'>('all');
  const [sortBy, setSortBy] = useState<'citations' | 'year' | 'relevance'>('citations');
  const [sources, setSources] = useState<LiteratureSourceInfo[]>([]);
  const [papers, setPapers] = useState<AcademicPaper[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [totalFound, setTotalFound] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});
  const [ingestedMap, setIngestedMap] = useState<Record<string, boolean>>({});
  const [isIngestingAll, setIsIngestingAll] = useState<boolean>(false);

  const PRESET_TOPICS = [
    'retrieval augmented generation',
    'hybrid BM25 dense retrieval',
    'LLM hallucination verification',
    'autonomous agent tool use',
    'ReAct language models reasoning',
    'fact verification FEVER'
  ];

  useEffect(() => {
    const fetchSourcesAndInit = async () => {
      try {
        const srcData = await api.getLiteratureSources();
        setSources(srcData.sources || []);
      } catch (err) {
        console.warn('Failed to load literature sources:', err);
      }
      handleSearch('retrieval augmented generation');
    };
    fetchSourcesAndInit();
  }, []);

  const handleSearch = async (searchQuery: string = query) => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return;
    setIsLoading(true);
    try {
      const res = await api.searchLiterature(cleanQuery, undefined, 6);
      setPapers(res.papers || []);
      setSourceCounts(res.source_counts || {});
      setTotalFound(res.total_found || 0);
    } catch (err: any) {
      console.error('Literature search failed:', err);
      showToast({
        title: 'Search Failed',
        message: err.message || 'Unable to fetch publications.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleAbstract = (paperId: string) => {
    setExpandedAbstracts((prev) => ({
      ...prev,
      [paperId]: !prev[paperId]
    }));
  };

  const handleDownloadPaper = (paper: AcademicPaper) => {
    const passages = paper.chunks && paper.chunks.length > 0
      ? `\n\n## Extracted Passages for RAG Grounding (${paper.chunks.length} Chunks)\n\n` +
        paper.chunks.map((c, i) => `### Passage ${i + 1}\n${c.text}`).join('\n\n')
      : '';

    const content = `# ${paper.title}

- **Authors**: ${paper.authors}
- **Publication Year**: ${paper.publication_year}
- **Venue**: ${paper.venue || 'N/A'}
- **Source**: ${paper.source}
- **Identifier**: ${paper.identifier || 'N/A'}
- **Citations**: ${paper.citation_count.toLocaleString()}
- **URL**: ${paper.url || 'N/A'}

---

## Abstract

${paper.abstract || 'No abstract available.'}
${passages}
`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 45);
    const filename = `${safeTitle || 'research_paper'}_${paper.publication_year}.md`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast({
      title: 'Paper Downloaded',
      message: `Saved ${filename}`,
      type: 'success'
    });
  };

  const handleIngestSingle = async (paper: AcademicPaper) => {
    try {
      setIngestedMap((prev) => ({ ...prev, [paper.id]: true }));
      await api.importLiteraturePapers([paper]);
      showToast({
        title: 'Added to Corpus',
        message: `"${paper.title.slice(0, 45)}..." is now active in research corpus.`,
        type: 'success'
      });
    } catch (err: any) {
      setIngestedMap((prev) => ({ ...prev, [paper.id]: false }));
      showToast({
        title: 'Ingestion Error',
        message: err.message || 'Failed to ingest paper.',
        type: 'error'
      });
    }
  };

  const handleIngestAll = async () => {
    if (!papers.length) return;
    setIsIngestingAll(true);
    try {
      const res = await api.importLiteraturePapers(papers);
      const newMap: Record<string, boolean> = {};
      papers.forEach((p) => { newMap[p.id] = true; });
      setIngestedMap(newMap);
      showToast({
        title: 'Corpus Updated',
        message: `Imported ${res.ingested_count} papers into active corpus (Total: ${res.total_active_papers})`,
        type: 'success'
      });
    } catch (err: any) {
      showToast({ title: 'Import Failed', message: err.message, type: 'error' });
    } finally {
      setIsIngestingAll(false);
    }
  };

  // Sort and filter
  let filteredPapers = papers.filter((p) => {
    if (activeSourceFilter === 'all') return true;
    return p.source === activeSourceFilter;
  });

  if (sortBy === 'citations') {
    filteredPapers = [...filteredPapers].sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
  } else if (sortBy === 'year') {
    filteredPapers = [...filteredPapers].sort((a, b) => (b.publication_year || 0) - (a.publication_year || 0));
  }

  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case 'OpenAlex':
        return { background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)' };
      case 'Crossref':
        return { background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'Semantic Scholar':
        return { background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.3)' };
      default:
        return { background: 'rgba(148, 163, 184, 0.12)', color: '#64748b', border: '1px solid rgba(148, 163, 184, 0.3)' };
    }
  };

  return (
    <div className="page-view" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      {/* Clean Hero Search Header */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Globe size={13} /> Live Academic Fetcher
              </span>
              <span className="badge badge-indigo">Multi-API Aggregation</span>
              <span className="badge badge-cyan">Auto-Chunked for RAG</span>
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Academic Literature Discovery
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, maxWidth: 740, lineHeight: 1.5 }}>
              Query live peer-reviewed papers across <strong>Semantic Scholar</strong>, <strong>OpenAlex</strong>, and <strong>Crossref</strong>.
              Ingest papers directly into the local RAG corpus or download markdown versions for offline analysis.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Live Connected Repositories
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ ...getSourceBadgeStyle('OpenAlex'), fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                ● OpenAlex (250M+ Works)
              </span>
              <span style={{ ...getSourceBadgeStyle('Crossref'), fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                ● Crossref (Official DOIs)
              </span>
              <span style={{ ...getSourceBadgeStyle('Semantic Scholar'), fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                ● Semantic Scholar (AI Graph)
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginTop: '22px', display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by topic, paper title, authors, or DOI (e.g., retrieval augmented generation, BM25)..."
              style={{
                width: '100%',
                padding: '12px 40px 12px 42px',
                background: '#ffffff',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '0.94rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title="Clear input"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="btn btn-primary"
            style={{
              padding: '0 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              minWidth: 140,
              justifyContent: 'center'
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="spin-animation" />
                Searching…
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Search</span>
              </>
            )}
          </button>
        </div>

        {/* Suggested Topics */}
        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <Sparkles size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
            Suggested Topics:
          </span>
          {PRESET_TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => {
                setQuery(topic);
                handleSearch(topic);
              }}
              style={{
                background: query.toLowerCase() === topic.toLowerCase() ? 'var(--accent-primary-light)' : '#f8fafc',
                border: `1px solid ${query.toLowerCase() === topic.toLowerCase() ? 'var(--accent-primary-border)' : 'var(--border-subtle)'}`,
                color: query.toLowerCase() === topic.toLowerCase() ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.74rem',
                cursor: 'pointer',
                fontWeight: query.toLowerCase() === topic.toLowerCase() ? 700 : 500,
                transition: 'all 0.15s'
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Action Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Filter:
          </span>
          <button
            onClick={() => setActiveSourceFilter('all')}
            className={`btn ${activeSourceFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            All Sources ({totalFound})
          </button>
          <button
            onClick={() => setActiveSourceFilter('OpenAlex')}
            className={`btn ${activeSourceFilter === 'OpenAlex' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            OpenAlex ({sourceCounts['OpenAlex'] || 0})
          </button>
          <button
            onClick={() => setActiveSourceFilter('Crossref')}
            className={`btn ${activeSourceFilter === 'Crossref' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Crossref ({sourceCounts['Crossref'] || 0})
          </button>
          <button
            onClick={() => setActiveSourceFilter('Semantic Scholar')}
            className={`btn ${activeSourceFilter === 'Semantic Scholar' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            Semantic Scholar ({sourceCounts['Semantic Scholar'] || 0})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <ArrowUpDown size={14} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '5px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-medium)',
                background: '#ffffff',
                fontSize: '0.78rem',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="citations">Most Cited First</option>
              <option value="year">Newest Publication Year</option>
              <option value="relevance">API Relevance</option>
            </select>
          </div>

          {papers.length > 0 && (
            <button
              onClick={handleIngestAll}
              disabled={isIngestingAll}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: 'var(--accent-primary-light)',
                borderColor: 'var(--accent-primary-border)',
                color: 'var(--accent-primary)'
              }}
            >
              {isIngestingAll ? (
                <>
                  <RefreshCw size={14} className="spin-animation" />
                  Ingesting All…
                </>
              ) : (
                <>
                  <Download size={14} />
                  Ingest All ({papers.length})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Paper Results Cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="auth-spinner" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Querying academic graphs in parallel…
          </p>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Library size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
            No papers found for this query or filter
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 450, margin: '0 auto 16px' }}>
            Try one of the suggested topics above or enter broader keywords.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredPapers.map((paper) => {
            const isExpanded = !!expandedAbstracts[paper.id];
            const isIngested = !!ingestedMap[paper.id];
            const hasLongAbstract = (paper.abstract || '').length > 250;

            return (
              <div
                key={paper.id}
                className="card"
                style={{
                  padding: '20px 24px',
                  border: isIngested ? '1px solid #86efac' : '1px solid var(--border-subtle)',
                  background: isIngested ? '#f0fdf4' : '#ffffff',
                  transition: 'border-color 0.2s, background 0.2s',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        ...getSourceBadgeStyle(paper.source),
                        fontSize: '0.74rem',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontWeight: 700
                      }}
                    >
                      {paper.source}
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.74rem',
                        color: 'var(--text-muted)',
                        background: '#f8fafc',
                        border: '1px solid var(--border-subtle)',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      <Calendar size={12} /> {paper.publication_year}
                    </span>

                    {paper.citation_count > 0 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.74rem',
                          color: '#b45309',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}
                      >
                        <Award size={12} /> {paper.citation_count.toLocaleString()} citations
                      </span>
                    )}

                    {paper.chunks && paper.chunks.length > 0 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        <Layers size={12} /> {paper.chunks.length} RAG chunk{paper.chunks.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {paper.url && (
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.74rem',
                          padding: '5px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none'
                        }}
                        title="View Paper Online"
                      >
                        <span>View</span>
                        <ExternalLink size={12} />
                      </a>
                    )}

                    <button
                      id={`download-paper-btn-${paper.id}`}
                      onClick={() => handleDownloadPaper(paper)}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.74rem',
                        padding: '5px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'var(--accent-primary-light)',
                        borderColor: 'var(--accent-primary-border)',
                        color: 'var(--accent-primary)'
                      }}
                      title="Download Paper Details & Passages (Markdown)"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>

                    <button
                      onClick={() => handleIngestSingle(paper)}
                      disabled={isIngested}
                      className={`btn ${isIngested ? 'btn-secondary' : 'btn-primary'}`}
                      style={{
                        fontSize: '0.74rem',
                        padding: '5px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: isIngested ? '#dcfce7' : undefined,
                        borderColor: isIngested ? '#86efac' : undefined,
                        color: isIngested ? '#15803d' : undefined
                      }}
                    >
                      {isIngested ? (
                        <>
                          <CheckCircle2 size={13} />
                          Ingested
                        </>
                      ) : (
                        <>
                          <Download size={13} />
                          Ingest to Corpus
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', lineHeight: 1.4 }}>
                  {paper.title}
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={13} style={{ color: 'var(--text-muted)' }} />
                    {paper.authors}
                  </span>
                  <span>•</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {paper.venue || 'Scientific Proceedings'}
                  </span>
                  {paper.identifier && (
                    <>
                      <span>•</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-indigo)' }}>
                        {paper.identifier}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <p style={{ margin: 0 }}>
                    {isExpanded || !hasLongAbstract
                      ? paper.abstract || 'No abstract available.'
                      : `${(paper.abstract || '').slice(0, 250)}…`}
                  </p>

                  {hasLongAbstract && (
                    <button
                      onClick={() => toggleAbstract(paper.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 0 0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={13} /> Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} /> Expand Full Abstract
                        </>
                      )}
                    </button>
                  )}
                </div>

                {isExpanded && paper.chunks && paper.chunks.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={13} />
                      Pre-calculated RAG Grounding Passages ({paper.chunks.length}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {paper.chunks.slice(0, 3).map((chunk, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            background: '#ffffff',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>[Chunk #{idx + 1}]:</span> {chunk.text.slice(0, 180)}…
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
