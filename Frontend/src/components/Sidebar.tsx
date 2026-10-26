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
  Globe,
  Bookmark,
  History,
  Settings,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  evidenceCount: number;
  hasReport: boolean;
  savedCount?: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  count?: number;
  highlight?: boolean;
}

const RESEARCH_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Compass },
  { id: 'literature', label: 'Literature Discovery', icon: Globe },
  { id: 'workspace', label: 'Research Workspace', icon: GitBranch },
  { id: 'evidence', label: 'Evidence Explorer', icon: Search },
  { id: 'experiment', label: 'Experiment Lab', icon: FlaskConical },
  { id: 'evaluation', label: 'Evaluation Hub', icon: BarChart3 },
  { id: 'report', label: 'Report Viewer', icon: FileText },
];

const LIBRARY_ITEMS: NavItem[] = [
  { id: 'saved', label: 'Saved Papers', icon: Bookmark },
  { id: 'history', label: 'Research History', icon: History },
  { id: 'core', label: 'Core Demo Suite', icon: Layers },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  evidenceCount,
  hasReport,
  savedCount,
}) => {
  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <div
        key={item.id}
        className={`nav-item ${isActive ? 'active' : ''}`}
        onClick={() => setActiveTab(item.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); } }}
        role="button"
        tabIndex={0}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={17} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.id === 'evidence' && evidenceCount > 0 && (
          <span className={`nav-count ${isActive ? 'count-amber' : ''}`}>{evidenceCount}</span>
        )}
        {item.id === 'saved' && typeof savedCount === 'number' && savedCount > 0 && (
          <span className={`nav-count ${isActive ? 'count-amber' : ''}`}>{savedCount}</span>
        )}
        {item.id === 'report' && hasReport && (
          <span className="status-dot ok" title="Report available for the active run" />
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar no-print" aria-label="Primary navigation">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Cpu size={21} color="#131007" />
        </div>
        <div>
          <h1>ResearchPilot</h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 600, letterSpacing: '0.02em' }}>
            Evidence-Verified Research Agent
          </p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Research</div>
        {RESEARCH_ITEMS.map(renderItem)}

        <div className="sidebar-section-label">Library</div>
        {LIBRARY_ITEMS.map(renderItem)}

        <div className="sidebar-section-label">Account</div>
        {ACCOUNT_ITEMS.map(renderItem)}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-protocol">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ShieldCheck size={15} color="var(--accent-emerald)" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>
              Evidence-First Protocol
            </span>
          </div>
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Claims are verified against retrieved passages with NLI heuristics before synthesis. Scores are decision aids, not calibrated probabilities.
          </p>
        </div>
        <div className="sidebar-status-row">
          <span style={{ fontWeight: 600 }}>ResearchPilot v1.0</span>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
            <span className="status-dot ok" /> Ready
          </span>
        </div>
      </div>
    </aside>
  );
};
