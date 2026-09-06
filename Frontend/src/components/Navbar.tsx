import React from 'react';
import { Activity, ShieldCheck, Sparkles, Terminal, Layers } from 'lucide-react';
import { Run } from '../types';

interface NavbarProps {
  activeRun: Run | null;
  onOpenNewModal: () => void;
  apiConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeRun, onOpenNewModal, apiConnected }) => {
  return (
    <header className="top-header no-print">
      <div className="header-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>System State:</span>
          <span className={`badge ${apiConnected ? 'badge-emerald' : 'badge-rose'}`}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: apiConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}></span>
            {apiConnected ? 'Backend Operational' : 'Offline / Reconnecting'}
          </span>
        </div>

        {activeRun && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px', paddingLeft: '20px', borderLeft: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Investigation:</span>
            <span className="mono badge badge-indigo" style={{ fontWeight: 700 }}>{activeRun.run_id}</span>
            <span className={`badge ${activeRun.status === 'COMPLETED' ? 'badge-emerald' : activeRun.status === 'WAITING_APPROVAL' ? 'badge-amber' : activeRun.status === 'FAILED' ? 'badge-rose' : 'badge-cyan'}`}>
              {activeRun.status} ({activeRun.current_step})
            </span>
          </div>
        )}
      </div>

      <div className="header-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <ShieldCheck size={15} color="var(--accent-emerald)" />
            <span style={{ fontWeight: 500 }}>NLI Verifier</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <Terminal size={15} color="var(--accent-primary)" />
            <span style={{ fontWeight: 500 }}>Subprocess Sandbox</span>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onOpenNewModal}>
          <Sparkles size={16} />
          <span>New Investigation</span>
        </button>
      </div>
    </header>
  );
};
