import React from 'react';
import {
  Activity,
  LogOut,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  FlaskConical
} from 'lucide-react';
import { Run } from '../types';
import { AuthUser } from '../types';

interface NavbarProps {
  activeRun: Run | null;
  onOpenNewModal: () => void;
  apiConnected: boolean;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRun,
  onOpenNewModal,
  apiConnected,
  user,
  onLogout,
}) => {
  return (
    <header className="top-header no-print">
      <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>System State:</span>
          <span className={`badge ${apiConnected ? 'badge-emerald' : 'badge-rose'}`}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: apiConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}></span>
            {apiConnected ? 'Backend Operational' : 'Offline / Reconnecting'}
          </span>
        </div>

        {activeRun && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '16px', borderLeft: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Investigation:</span>
            <span className="mono badge badge-indigo" style={{ fontWeight: 700 }}>{activeRun.run_id}</span>
            <span className={`badge ${activeRun.status === 'COMPLETED' ? 'badge-emerald' : activeRun.status === 'WAITING_APPROVAL' ? 'badge-amber' : activeRun.status === 'FAILED' ? 'badge-rose' : 'badge-cyan'}`}>
              {activeRun.status} ({activeRun.current_step})
            </span>
          </div>
        )}
      </div>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
            <ShieldCheck size={15} color="var(--accent-emerald)" />
            <span style={{ fontWeight: 600 }}>NLI Verifier</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
            <Terminal size={15} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600 }}>Subprocess Sandbox</span>
          </div>
        </div>

        {user && (
          <div className="navbar-user-area">
            <div className="navbar-user-avatar">
              <User size={15} />
            </div>
            <div className="navbar-user-info">
              <span className="navbar-user-name">{user.full_name}</span>
              <span className="navbar-user-role">{user.role}</span>
            </div>
            <button
              id="logout-btn"
              className="navbar-logout-btn"
              onClick={onLogout}
              title="Sign out of researcher account"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={onOpenNewModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontWeight: 600 }}
        >
          <Sparkles size={16} />
          <span>New Investigation</span>
        </button>
      </div>
    </header>
  );
};
