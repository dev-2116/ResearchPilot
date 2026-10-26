import React, { useEffect, useState } from 'react';
import {
  Database,
  Info,
  LogOut,
  Server,
  ShieldCheck,
  User,
} from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../types';
import { SectionHeader, Skeleton, fmtDate, fmtInt } from '../components/ui';

interface SettingsPageProps {
  user: AuthUser | null;
  onLogout: () => void;
}

interface HealthInfo {
  status: string;
  service: string;
  version: string;
  database: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onLogout }) => {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [corpus, setCorpus] = useState<{ corpus_active: number; saved_papers_total: number } | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Health endpoint returned ${r.status}`))))
      .then(setHealth)
      .catch((e) => setHealthError(e?.message || 'Health endpoint unreachable'));

    api.getDashboardStats()
      .then((s) => setCorpus({ corpus_active: s.corpus_active, saved_papers_total: s.saved_papers_total }))
      .catch(() => setCorpus(null));
  }, []);

  return (
    <div className="page-view" style={{ maxWidth: 860 }}>
      {/* Account */}
      <div className="card">
        <SectionHeader
          icon={<User size={17} />}
          title="Account"
          subtitle="Your researcher profile, as registered on this server"
        />
        <div className="table-container" style={{ marginTop: 12 }}>
          <table className="formal-table">
            <tbody>
              <tr>
                <td style={{ width: 180, color: 'var(--text-muted)' }}>Full name</td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user?.full_name || '—'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Email</td>
                <td className="mono" style={{ fontSize: '0.8rem' }}>{user?.email || '—'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Role</td>
                <td><span className="badge badge-cyan">{user?.role || 'researcher'}</span></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Session</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Signed in with a JWT access token (24-hour validity). Sign-out clears it from this browser.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-danger" onClick={onLogout}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* System status */}
      <div className="card">
        <SectionHeader
          icon={<Server size={17} />}
          title="System Status"
          subtitle="Live values reported by the backend health endpoint"
        />
        {health ? (
          <div className="table-container" style={{ marginTop: 12 }}>
            <table className="formal-table">
              <tbody>
                <tr>
                  <td style={{ width: 180, color: 'var(--text-muted)' }}>Service</td>
                  <td>{health.service}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)' }}>Version</td>
                  <td className="mono">{health.version}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)' }}>API health</td>
                  <td><span className="badge badge-emerald">{health.status}</span></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)' }}>Database</td>
                  <td><span className="badge badge-emerald">{health.database}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : healthError ? (
          <p className="form-error-text" style={{ marginTop: 10 }}>{healthError}</p>
        ) : (
          <div style={{ marginTop: 12 }}><Skeleton h={60} w="100%" /></div>
        )}
      </div>

      {/* Data & corpus */}
      <div className="card">
        <SectionHeader
          icon={<Database size={17} />}
          title="Data & Corpus"
          subtitle="Real counts from the research database"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
          <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 14 }}>
            <span className="stat-label">Active retrieval corpus</span>
            <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: 6 }}>
              {corpus ? fmtInt(corpus.corpus_active) : '—'}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>preloaded + imported papers</span>
          </div>
          <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 14 }}>
            <span className="stat-label">Saved papers (you)</span>
            <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: 6 }}>
              {corpus ? fmtInt(corpus.saved_papers_total) : '—'}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>your personal library</span>
          </div>
        </div>
      </div>

      {/* Honest capability notes */}
      <div className="card">
        <SectionHeader
          icon={<Info size={17} />}
          title="How Verification Works Here"
          subtitle="Know exactly what the numbers on other pages mean"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 12, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 9 }}>
            <ShieldCheck size={15} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Claims are decomposed by the agent and scored against retrieved passages with a built-in
              lexical/NLI <strong>heuristic verifier</strong>. Confidence values are decision aids — not calibrated probabilities.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <Database size={15} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Experiments execute as isolated Python subprocesses with CPU/time caps; their stdout, exit codes
              and SHA-256 manifests are recorded verbatim and reproducible from the stored code and seed.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <Info size={15} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Literature search queries external APIs (Semantic Scholar, OpenAlex, Crossref) live. If those
              services are unreachable, the affected results show an honest error instead of cached substitutes.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <User size={15} color="var(--accent-purple)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Saved Papers are stored per user account. Registrations, runs, reports and library entries persist
              in the local SQLite database on this server.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
