import React from 'react';
import {
  Compass,
  GitBranch,
  Search,
  FlaskConical,
  BarChart3,
  FileText,
  Cpu,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  evidenceCount: number;
  hasReport: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  evidenceCount,
  hasReport,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Compass },
    { id: 'workspace', label: 'Research Workspace', icon: GitBranch },
    { id: 'evidence', label: 'Evidence Explorer', icon: Search, count: evidenceCount },
    { id: 'experiment', label: 'Experiment Lab', icon: FlaskConical },
    { id: 'evaluation', label: 'Evaluation & Ablations', icon: BarChart3 },
    { id: 'report', label: 'Final Report', icon: FileText, highlight: hasReport },
  ];

  return (
    <aside className="sidebar no-print">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Cpu size={22} color="#ffffff" />
        </div>
        <div>
          <h1>ResearchPilot</h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.01em' }}>
            Evidence-Verified Agent
          </p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="badge badge-cyan" style={{ fontSize: '0.7rem', padding: '1px 7px' }}>
                  {item.count}
                </span>
              )}
              {item.highlight && (
                <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                  Ready
                </span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldCheck size={16} color="var(--accent-emerald)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Evidence-First Protocol
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Zero ungrounded claims. Automated provenance mapping and reproducible manifests.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>
          <span style={{ fontWeight: 500 }}>v1.0.0 (Formal)</span>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>● SRS Compliant</span>
        </div>
      </div>
    </aside>
  );
};
