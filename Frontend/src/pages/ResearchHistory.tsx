import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, History, RefreshCw, Search } from 'lucide-react';
import { api } from '../services/api';
import { HistoryEntry } from '../types';
import { EmptyState, ErrorNote, SectionHeader, Skeleton, StatusBadge, fmtDate, fmtInt } from '../components/ui';

interface ResearchHistoryProps {
  entries: HistoryEntry[];
  onSelectTask: (task: any) => void;
  onRefresh: () => void;
}

export const ResearchHistory: React.FC<ResearchHistoryProps> = ({ onSelectTask, onRefresh }) => {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await api.getHistory());
    } catch (err: any) {
      setError(err?.message || 'Failed to load research history.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    entries?.forEach((e) => e.latest_run_status && statuses.add(e.latest_run_status));
    return ['ALL', ...Array.from(statuses)];
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (statusFilter !== 'ALL' && (e.latest_run_status || 'NO_RUNS') !== statusFilter) return false;
      if (!q) return true;
      return e.question.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
    });
  }, [entries, query, statusFilter]);

  return (
    <div className="page-view">
      <div className="card">
        <SectionHeader
          icon={<History size={17} />}
          title="Research History"
          subtitle="Every investigation you created, with its latest run outcome — straight from the database"
          right={
            <button className="btn btn-secondary" onClick={() => { load(); onRefresh(); }} style={{ flexShrink: 0 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          }
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} color="var(--text-light)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="form-input"
              placeholder="Filter by question, domain or task ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 34 }}
              aria-label="Filter history"
            />
          </div>
          <div className="seg-group">
            {statusOptions.map((s) => (
              <button key={s} className={`seg-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}

      {entries === null && !error && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={34} w="100%" />)}
        </div>
      )}

      {entries !== null && filtered.length === 0 && (
        <div className="card">
          {entries.length === 0 ? (
            <EmptyState
              icon={<History size={20} />}
              title="No investigations recorded yet"
              description="Your research history builds up automatically as you create and run investigations."
            />
          ) : (
            <EmptyState
              icon={<Search size={20} />}
              title="No matches for the current filter"
              description="Adjust the search text or status filter to see more of your history."
            />
          )}
        </div>
      )}

      {entries !== null && filtered.length > 0 && (
        <div className="card">
          <div className="table-container">
            <table className="formal-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Domain</th>
                  <th>Runs</th>
                  <th>Latest Run</th>
                  <th>Claims</th>
                  <th>Report</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => onSelectTask(e)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') onSelectTask(e); }}
                    title="Open in Research Workspace"
                  >
                    <td style={{ maxWidth: 380 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.question}>
                        {e.question}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-light)', marginTop: 2 }}>{e.id}</div>
                    </td>
                    <td><span className="badge badge-slate">{e.domain}</span></td>
                    <td className="mono">{fmtInt(e.run_count)}</td>
                    <td>
                      {e.latest_run_status
                        ? <StatusBadge status={e.latest_run_status} />
                        : <span className="badge badge-slate">not run</span>}
                    </td>
                    <td className="mono">{e.latest_claims_count != null ? fmtInt(e.latest_claims_count) : '—'}</td>
                    <td>
                      {e.report_count > 0
                        ? <span className="badge badge-emerald" title="Report available"><FileText size={11} /> {e.report_count}</span>
                        : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{fmtDate(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chart-tooltip-note" style={{ marginTop: 10 }}>
            {fmtInt(filtered.length)} of {fmtInt(entries.length)} investigations shown · click a row to open it in the workspace
          </p>
        </div>
      )}
    </div>
  );
};
