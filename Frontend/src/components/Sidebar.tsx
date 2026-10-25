import React from 'react';
import {
  Compass,
  GitBranch,
  Search,
  FlaskConical,
  BarChart3,
  FileText,
  Cpu,
  ShieldCheck,
  Zap,
  Globe
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
  const builtItems = [
    { id: 'core', label: 'Interactive Core Demo', icon: Zap, badge: 'Live Prototype' },
    { id: 'literature', label: 'Literature Discovery', icon: Globe, badge: '3 APIs Live' },
  ];

  const plannedItems = [
    { id: 'dashboard', label: 'Dashboard & FSM', icon: Compass, badge: 'Planned' },
    { id: 'workspace', label: 'Research Workspace', icon: GitBranch, badge: 'Planned' },
    { id: 'evidence', label: 'Evidence Explorer', icon: Search, badge: 'Planned', count: evidenceCount },
    { id: 'experiment', label: 'Experiment Lab', icon: FlaskConical, badge: 'Planned' },
    { id: 'evaluation', label: 'Evaluation Hub', icon: BarChart3, badge: 'Planned' },
    { id: 'report', label: 'Final Report', icon: FileText, badge: 'Planned', highlight: hasReport },
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
        {/* Currently Built Section */}
        <div style={{ padding: '6px 12px 6px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          ⚡ Active Core
        </div>
        {builtItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              style={isActive ? { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' } : {}}
            >
              <Icon size={18} color={isActive ? 'var(--accent-emerald)' : 'var(--text-muted)'} />
              <span style={{ flex: 1, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
              {item.badge && (
                <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}

        {/* Planned Modules Section */}
        <div style={{ padding: '18px 12px 6px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Planned Architecture
        </div>
        {plannedItems.map((item) => {
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
                <span className="badge badge-indigo" style={{ fontSize: '0.68rem', padding: '1px 6px', marginRight: 4 }}>
                  {item.count}
                </span>
              )}
              <span className="badge badge-slate" style={{ fontSize: '0.65rem', padding: '2px 6px', opacity: 0.85 }}>
                {item.badge}
              </span>
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
            Zero ungrounded assertions. Strict NLI provenance verification and reproducible manifests.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>
          <span style={{ fontWeight: 600 }}>ResearchPilot v1.0</span>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>● Ready</span>
        </div>
      </div>
    </aside>
  );
};
