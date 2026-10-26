import React from 'react';
import { AlertCircle, Inbox } from 'lucide-react';

/* ── Status → badge variant mapping (single source of truth) ─────────────── */

export type BadgeVariant =
  | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'cyan' | 'slate' | 'brand';

export const statusVariant = (status?: string | null): BadgeVariant => {
  const s = (status || '').toUpperCase();
  if (['COMPLETED', 'SUPPORTED', 'SUCCESS', 'OK', 'CONNECTED', 'CREATED'].includes(s)) return 'emerald';
  if (['RUNNING', 'ACTIVE'].includes(s)) return 'brand';
  if (['WAITING_APPROVAL', 'PENDING', 'PENDING_REVIEW', 'INSUFFICIENT_EVIDENCE', 'UNVERIFIED', 'NEUTRAL', 'SKIPPED'].includes(s)) return 'amber';
  if (['FAILED', 'ERROR', 'REFUTED', 'CONTRADICTION', 'CANCELLED'].includes(s)) return 'rose';
  if (['AUTONOMOUS'].includes(s)) return 'purple';
  if (['GATED'].includes(s)) return 'amber';
  return 'slate';
};

export const VARIANT_CLASS: Record<BadgeVariant, string> = {
  emerald: 'badge-emerald',
  amber: 'badge-amber',
  rose: 'badge-rose',
  indigo: 'badge-indigo',
  purple: 'badge-purple',
  cyan: 'badge-cyan',
  slate: 'badge-slate',
  brand: 'badge-amber-brand',
};

export const StatusBadge: React.FC<{ status?: string | null; children?: React.ReactNode; className?: string }> = ({
  status, children, className,
}) => (
  <span className={`badge ${VARIANT_CLASS[statusVariant(status)]}${className ? ` ${className}` : ''}`}>
    {children ?? (status || 'UNKNOWN').replace(/_/g, ' ')}
  </span>
);

/* ── Empty state (honest, actionable) ─────────────────────────────────────── */

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="empty-state" role="status">
    <div className="empty-state-icon">{icon ?? <Inbox size={22} />}</div>
    <div className="empty-state-title">{title}</div>
    {description && <p className="empty-state-desc">{description}</p>}
    {action && <div style={{ marginTop: 14 }}>{action}</div>}
  </div>
);

/* ── Error note (inline, actionable) ──────────────────────────────────────── */

export const ErrorNote: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'var(--accent-rose-light)', border: '1px solid var(--accent-rose-border)',
      borderRadius: 'var(--radius-md)', padding: '12px 15px', color: 'var(--accent-rose)', fontSize: '0.82rem',
    }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      <span style={{ overflowWrap: 'anywhere' }}>{message}</span>
    </span>
    {onRetry && (
      <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.75rem', flexShrink: 0 }} onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);

/* ── Skeleton block ───────────────────────────────────────────────────────── */

export const Skeleton: React.FC<{ h?: number; w?: string; style?: React.CSSProperties }> = ({ h = 14, w, style }) => (
  <div className="skeleton" style={{ height: h, width: w, ...style }} />
);

export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Skeleton h={12} w="40%" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} h={11} w={`${88 - i * 14}%`} />
    ))}
  </div>
);

/* ── Stat card ────────────────────────────────────────────────────────────── */

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'amber' | 'emerald' | 'rose' | 'purple' | 'blue';
}> = ({ label, value, hint, icon, tone = 'amber' }) => {
  const toneStyle: Record<string, React.CSSProperties> = {
    amber: { background: 'var(--accent-primary-light)', border: '1px solid var(--accent-primary-border)', color: 'var(--accent-primary)' },
    emerald: { background: 'var(--accent-emerald-light)', border: '1px solid var(--accent-emerald-border)', color: 'var(--accent-emerald)' },
    rose: { background: 'var(--accent-rose-light)', border: '1px solid var(--accent-rose-border)', color: 'var(--accent-rose)' },
    purple: { background: 'var(--accent-purple-light)', border: '1px solid var(--accent-purple-border)', color: 'var(--accent-purple)' },
    blue: { background: 'var(--accent-blue-light)', border: '1px solid var(--accent-blue-border)', color: 'var(--accent-blue)' },
  };
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <span className="stat-label">{label}</span>
        {icon && (
          <div className="card-icon-tile" style={toneStyle[tone]}>{icon}</div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
};

/* ── Progress bar ─────────────────────────────────────────────────────────── */

export const ProgressBar: React.FC<{
  value: number; // 0..1
  tone?: 'amber' | 'emerald' | 'rose' | 'blue' | 'purple';
  height?: number;
  label?: string;
}> = ({ value, tone = 'amber', height = 7, label }) => {
  const pct = Math.max(0, Math.min(100, Math.round((Number.isFinite(value) ? value : 0) * 100)));
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 5 }}>
          {label}
          <span className="mono" style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
        </div>
      )}
      <div className="progress-track" style={{ height }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progress-fill ${tone === 'amber' ? '' : tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/* ── Section header ───────────────────────────────────────────────────────── */

export const SectionHeader: React.FC<{
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ icon, title, subtitle, right }) => (
  <div className="card-header">
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
      {icon && <div className="card-icon-tile">{icon}</div>}
      <div style={{ minWidth: 0 }}>
        <h3 className="section-heading">{title}</h3>
        {subtitle && <p className="section-sub">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

/* ── Value formatting helper: honest N/A handling ─────────────────────────── */

export const fmtInt = (n: number | null | undefined): string =>
  typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString() : '—';

export const fmtDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const fmtTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export const fmtDuration = (ms?: number | null): string => {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
};
