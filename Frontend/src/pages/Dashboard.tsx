import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bookmark,
  Compass,
  FileText,
  FlaskConical,
  GitBranch,
  Globe,
  Layers,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { AuthUser, DashboardStats, ResearchTask } from '../types';
import { DonutChart, BarChart, LineChart } from '../components/charts';
import {
  EmptyState, ErrorNote, Skeleton, SkeletonCard, StatCard, StatusBadge,
  fmtDate, fmtInt,
} from '../components/ui';

interface DashboardProps {
  user: AuthUser | null;
  tasks: ResearchTask[];
  activeRun: any;
  onSelectTask: (task: ResearchTask) => void;
  onOpenNewModal: () => void;
  onNavigateTab: (tab: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: '#FFAA24',
  RUNNING: '#60A5FA',
  WAITING_APPROVAL: '#FBBF24',
  COMPLETED: '#34D399',
  FAILED: '#F87171',
};

const QUICK_ACTIONS = [
  { id: 'literature', icon: Globe, title: 'Discover Literature', desc: 'Search Semantic Scholar, OpenAlex & Crossref', tone: 'var(--accent-blue)' },
  { id: 'workspace', icon: GitBranch, title: 'Research Workspace', desc: 'Follow the live agent pipeline state machine', tone: 'var(--accent-purple)' },
  { id: 'evaluation', icon: Award, title: 'Run Evaluation', desc: 'Benchmark the pipeline on real cases', tone: 'var(--accent-emerald)' },
  { id: 'report', icon: FileText, title: 'View Report', desc: 'Read the latest synthesis with provenance', tone: 'var(--accent-primary)' },
];

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onSelectTask,
  onOpenNewModal,
  onNavigateTab,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStats(await api.getDashboardStats());
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard statistics.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 15000); // keep counts fresh while open
    return () => clearInterval(t);
  }, [loadStats]);

  const firstName = (user?.full_name || '').split(/\s+/)[0];

  if (isLoading && !stats) {
    return (
      <div className="page-view">
        <SkeletonCard lines={2} />
        <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
        <div className="grid-sidebar" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <SkeletonCard lines={5} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="page-view">
        <ErrorNote message={error} onRetry={loadStats} />
      </div>
    );
  }

  const s = stats!;
  const hasAnyTask = s.tasks_total > 0;
  const verificationTotal = s.claims_supported + s.claims_refuted + s.claims_insufficient;

  return (
    <div className="page-view">
      {/* Welcome + hero */}
      <div className="card" style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(255,170,36,0.07) 0%, rgba(17,20,23,0) 55%), var(--bg-card)',
      }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', right: -40, top: -60, width: 260, height: 260,
            background: `radial-gradient(circle, rgba(255,170,36,0.10) 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-amber-brand"><ShieldCheck size={12} /> Evidence-First Pipeline</span>
              <span className="badge badge-slate">11-stage agent FSM</span>
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: 8 }}>
              {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 640, lineHeight: 1.6 }}>
              Retrieve literature, decompose and verify claims against sources, run sandboxed experiments,
              and generate provenance-sealed research reports — all from one workspace.
            </p>
          </div>
          <button className="btn btn-primary" onClick={onOpenNewModal} style={{ padding: '11px 20px', flexShrink: 0 }}>
            <Plus size={16} /> New Investigation
          </button>
        </div>
      </div>

      {/* Quick actions (only real destinations) */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {QUICK_ACTIONS.map((qa) => {
          const Icon = qa.icon;
          return (
            <button key={qa.id} className="quick-action" onClick={() => onNavigateTab(qa.id)}>
              <span className="quick-action-icon" style={{ background: `${qa.tone}1f`, border: `1px solid ${qa.tone}55` }}>
                <Icon size={18} color={qa.tone} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="quick-action-title" style={{ display: 'block' }}>{qa.title}</span>
                <span className="quick-action-desc" style={{ display: 'block' }}>{qa.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Real KPI stats */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard
          label="Investigations"
          value={fmtInt(s.tasks_total)}
          hint={`${fmtInt(s.runs_total)} runs · ${fmtInt(s.runs_active)} active`}
          icon={<Layers size={17} />}
          tone="amber"
        />
        <StatCard
          label="Verified Evidence"
          value={verificationTotal > 0 ? fmtInt(s.claims_supported) : fmtInt(0)}
          hint={
            verificationTotal > 0
              ? `of ${fmtInt(verificationTotal)} claims · ${fmtInt(s.claims_refuted)} refuted · ${fmtInt(s.claims_insufficient)} insufficient`
              : 'No claims verified yet'
          }
          icon={<ShieldCheck size={17} />}
          tone="emerald"
        />
        <StatCard
          label="Experiments Run"
          value={fmtInt(s.experiments_total)}
          hint={s.experiments_total > 0 ? `${fmtInt(s.experiments_completed)} completed in sandbox` : 'No experiments generated yet'}
          icon={<FlaskConical size={17} />}
          tone="purple"
        />
        <StatCard
          label="Reports Generated"
          value={fmtInt(s.reports_total)}
          hint={s.reports_total > 0 ? 'Each sealed with a SHA-256 provenance hash' : 'Reports appear after a run completes'}
          icon={<FileText size={17} />}
          tone="blue"
        />
      </div>

      {/* Charts row — real data only */}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        {/* Activity over time */}
        <div className="card chart-card">
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="section-heading">Research Activity</h3>
              <p className="section-sub">Investigations created per day (last 14 days, from actual records)</p>
            </div>
          </div>
          {s.activity_daily.length >= 2 ? (
            <LineChart points={s.activity_daily.map((d) => ({ date: d.date, value: d.tasks }))} unit=" tasks" />
          ) : (
            <EmptyState
              icon={<Compass size={20} />}
              title="Not enough historical data yet"
              description={
                s.activity_daily.length === 1
                  ? 'Only one day with recorded activity so far — a trend line needs at least two days of real data.'
                  : 'No investigations have been created in the last 14 days. Launch one to start building your history.'
              }
              action={
                <button className="btn btn-secondary" onClick={onOpenNewModal}>
                  <Plus size={14} /> Start an investigation
                </button>
              }
            />
          )}
        </div>

        {/* Task status distribution */}
        <div className="card chart-card">
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="section-heading">Task Status</h3>
              <p className="section-sub">Distribution of {fmtInt(s.tasks_total)} investigations by current status</p>
            </div>
          </div>
          {s.task_status_distribution.length > 0 ? (
            <DonutChart
              data={s.task_status_distribution.map((d) => ({
                label: d.status.replace(/_/g, ' '),
                value: d.count,
                color: STATUS_COLORS[d.status.toUpperCase()] || '#4A5058',
              }))}
              centerLabel="investigations"
            />
          ) : (
            <EmptyState
              icon={<Layers size={20} />}
              title="No tasks recorded"
              description="Create your first investigation to see its lifecycle status here."
              action={
                <button className="btn btn-secondary" onClick={onOpenNewModal}>
                  <Plus size={14} /> New Investigation
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Recent investigations + domain breakdown */}
      <div className="grid-sidebar" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Recent tasks table */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <div>
              <h3 className="section-heading">Recent Investigations</h3>
              <p className="section-sub">Select a task to open it in the Research Workspace</p>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 13px', fontSize: '0.76rem' }} onClick={() => onNavigateTab('history')}>
              View History <ArrowRight size={13} />
            </button>
          </div>

          {s.recent_tasks.length === 0 ? (
            <EmptyState
              icon={<Search size={20} />}
              title="No investigations yet"
              description="Launch your first evidence-verified investigation, or explore the literature index while you plan one."
              action={
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={onOpenNewModal}>
                    <Plus size={14} /> New Investigation
                  </button>
                  <button className="btn btn-secondary" onClick={() => onNavigateTab('literature')}>
                    <BookOpen size={14} /> Browse Literature
                  </button>
                </div>
              }
            />
          ) : (
            <div className="table-container">
              <table className="formal-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Domain</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {s.recent_tasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      style={{ cursor: 'pointer' }}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSelectTask(t); }}
                    >
                      <td style={{ maxWidth: 340 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.question}>
                          {t.question}
                        </div>
                        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-light)', marginTop: 2 }}>{t.id}</div>
                      </td>
                      <td><span className="badge badge-slate">{t.domain}</span></td>
                      <td><span className="badge badge-slate">{t.execution_mode}</span></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{fmtDate(t.created_at)}</td>
                      <td><ArrowRight size={14} color="var(--text-light)" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Domain breakdown + pipeline overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card chart-card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="section-heading">Domains Explored</h3>
                <p className="section-sub">Investigations grouped by declared domain</p>
              </div>
            </div>
            {s.task_domain_distribution.length > 0 ? (
              <BarChart
                data={s.task_domain_distribution.map((d) => ({
                  label: d.domain.length > 14 ? d.domain.slice(0, 13) + '…' : d.domain,
                  value: d.count,
                }))}
                height={150}
              />
            ) : (
              <EmptyState
                icon={<Compass size={18} />}
                title="No domain data yet"
                description="Domains are derived from the investigations you create."
              />
            )}
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="section-heading">Corpus Index</h3>
                <p className="section-sub">Documents available for retrieval & verification</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <BookOpen size={15} color="var(--accent-blue)" /> Active retrieval corpus
                </span>
                <strong className="mono" style={{ fontSize: '0.95rem' }}>{fmtInt(s.corpus_active)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <Layers size={15} color="var(--accent-purple)" /> Benchmark suites executed
                </span>
                <strong className="mono" style={{ fontSize: '0.95rem' }}>{fmtInt(s.benchmark_runs_total)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <Bookmark size={15} color="var(--accent-emerald)" /> Papers in your library
                </span>
                <strong className="mono" style={{ fontSize: '0.95rem' }}>{fmtInt(s.saved_papers_total)}</strong>
              </div>
              <button className="btn btn-secondary" style={{ marginTop: 6 }} onClick={() => onNavigateTab('literature')}>
                <Globe size={14} /> Discover & import more papers
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
