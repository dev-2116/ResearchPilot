import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  LogOut,
  Menu,
  Plus,
  User,
} from 'lucide-react';
import { AuthUser, Run } from '../types';
import { StatusBadge } from './ui';

interface NavbarProps {
  activeRun: Run | null;
  onOpenNewModal: () => void;
  apiConnected: boolean;
  user?: AuthUser | null;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
}

const SHORT_STEP: Record<string, string> = {
  TASK_CREATED: 'Queued', PLAN: 'Planning', RETRIEVE: 'Retrieving',
  EXTRACT_EVIDENCE: 'Extracting', VERIFY: 'Verifying', DESIGN_EXPERIMENT: 'Designing',
  GENERATE_CODE: 'Generating code', EXECUTE: 'Executing', EVALUATE: 'Evaluating',
  REVIEW: 'Reviewing', REPORT: 'Reporting', COMPLETE: 'Complete',
};

export const Navbar: React.FC<NavbarProps> = ({
  activeRun,
  onOpenNewModal,
  apiConnected,
  user,
  onLogout,
  onToggleSidebar,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initials = (user?.full_name || '?')
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <header className="top-header no-print">
      <div className="header-title">
        <button
          className="btn btn-ghost"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation sidebar"
          style={{ padding: 7, display: 'none' }}
          id="sidebar-toggle"
        >
          <Menu size={18} />
        </button>

        <span className="header-status-badge" title={apiConnected ? 'Backend API is reachable' : 'Backend API is unreachable'}>
          <Activity size={13} color={apiConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)'} />
          {apiConnected ? 'API Connected' : 'API Offline'}
        </span>

        {activeRun && (
          <span className="header-run-chip">
            <span style={{ color: 'var(--text-light)' }}>Active run</span>
            <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeRun.run_id}
            </span>
            <StatusBadge status={activeRun.status}>
              {activeRun.status === 'RUNNING'
                ? (SHORT_STEP[activeRun.current_step] || activeRun.current_step)
                : activeRun.status.replace(/_/g, ' ')}
            </StatusBadge>
          </span>
        )}
      </div>

      <div className="header-actions">
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            className="navbar-user-area"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            style={{ cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            <span className="navbar-user-avatar">{initials || <User size={14} />}</span>
            <span className="navbar-user-info">
              <span className="navbar-user-name">{user?.full_name}</span>
              <span className="navbar-user-role">{user?.role}</span>
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 210,
                background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 6, zIndex: 80,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.full_name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
              </div>
              <button
                role="menuitem"
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem' }}
                onClick={() => { setMenuOpen(false); onLogout?.(); }}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={onOpenNewModal} style={{ padding: '8px 16px' }}>
          <Plus size={15} />
          <span>New Investigation</span>
        </button>
      </div>
    </header>
  );
};
