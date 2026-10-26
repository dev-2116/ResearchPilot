import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { NewResearchModal } from './components/NewResearchModal';
import { Dashboard } from './pages/Dashboard';
import { ResearchWorkspace } from './pages/ResearchWorkspace';
import { EvidenceExplorer } from './pages/EvidenceExplorer';
import { ExperimentLab } from './pages/ExperimentLab';
import { EvaluationHub } from './pages/EvaluationHub';
import { ReportViewer } from './pages/ReportViewer';
import { MidSemDemo } from './pages/MidSemDemo';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LiteratureDiscovery } from './pages/LiteratureDiscovery';
import { SavedPapers } from './pages/SavedPapers';
import { ResearchHistory } from './pages/ResearchHistory';
import { SettingsPage } from './pages/Settings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { api } from './services/api';
import {
  BenchmarkCase,
  BenchmarkResult,
  Claim,
  ExecutionMode,
  Experiment,
  FinalReport,
  MidSemQuestion,
  ResearchTask,
  Run,
} from './types';

export const TAB_IDS = [
  'dashboard', 'literature', 'workspace', 'evidence',
  'experiment', 'evaluation', 'report', 'saved', 'history', 'settings', 'core',
] as const;

export const AppInner: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiConnected, setApiConnected] = useState(true);

  // Core State
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ResearchTask | null>(null);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [benchmarkCases, setBenchmarkCases] = useState<BenchmarkCase[]>([]);
  const [midsemQuestions, setMidsemQuestions] = useState<MidSemQuestion[]>([]);

  // Loading States
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isReexecuting, setIsReexecuting] = useState(false);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  // Polling interval ref
  const pollRef = useRef<any>(null);

  // Show full-screen spinner while restoring session
  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-main)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="auth-spinner" style={{ width: 40, height: 40, borderWidth: 4, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Restoring session…</p>
        </div>
      </div>
    );
  }

  // Show auth pages if not logged in
  if (!user) {
    return authView === 'login'
      ? <LoginPage onSwitchToRegister={() => setAuthView('register')} />
      : <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
  }

  return (
    <AuthenticatedApp
      user={user}
      logout={logout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isModalOpen={isModalOpen}
      setIsModalOpen={setIsModalOpen}
      apiConnected={apiConnected}
      setApiConnected={setApiConnected}
      tasks={tasks}
      setTasks={setTasks}
      selectedTask={selectedTask}
      setSelectedTask={setSelectedTask}
      activeRun={activeRun}
      setActiveRun={setActiveRun}
      claims={claims}
      setClaims={setClaims}
      experiment={experiment}
      setExperiment={setExperiment}
      report={report}
      setReport={setReport}
      benchmarkResult={benchmarkResult}
      setBenchmarkResult={setBenchmarkResult}
      benchmarkCases={benchmarkCases}
      setBenchmarkCases={setBenchmarkCases}
      midsemQuestions={midsemQuestions}
      setMidsemQuestions={setMidsemQuestions}
      isLoadingTask={isLoadingTask}
      setIsLoadingTask={setIsLoadingTask}
      isApproving={isApproving}
      setIsApproving={setIsApproving}
      isReexecuting={isReexecuting}
      setIsReexecuting={setIsReexecuting}
      isRunningBenchmark={isRunningBenchmark}
      setIsRunningBenchmark={setIsRunningBenchmark}
      pollRef={pollRef}
    />
  );
};

// ── Main authenticated app component ──────────────────────────────────────────
const AuthenticatedApp: React.FC<any> = (props) => {
  const {
    user, logout,
    activeTab, setActiveTab,
    isModalOpen, setIsModalOpen,
    apiConnected, setApiConnected,
    tasks, setTasks,
    selectedTask, setSelectedTask,
    activeRun, setActiveRun,
    claims, setClaims,
    experiment, setExperiment,
    report, setReport,
    benchmarkResult, setBenchmarkResult,
    benchmarkCases, setBenchmarkCases,
    midsemQuestions, setMidsemQuestions,
    isLoadingTask, setIsLoadingTask,
    isApproving, setIsApproving,
    isReexecuting, setIsReexecuting,
    isRunningBenchmark, setIsRunningBenchmark,
    pollRef,
  } = props;

  const { showToast } = useToast();

  /** Load the latest existing run of a task (if any) WITHOUT starting a new
   * one. The user stays in control of when a run is launched (HCI Rule 7). */
  const loadLatestRunForTask = useCallback(async (task: ResearchTask) => {
    setClaims([]);
    setExperiment(null);
    setReport(null);
    setActiveRun(null);
    try {
      const runs = await api.listTaskRuns(task.id);
      if (runs.length === 0) return;
      const latest = await api.getRun(runs[0].run_id); // full run incl. steps
      setActiveRun(latest);
      try { setClaims(await api.getRunEvidence(latest.run_id)); } catch { /* no evidence yet */ }
      try {
        const exp = await api.getRunExperiment(latest.run_id);
        if (exp) setExperiment(exp);
      } catch { /* none yet */ }
      if (latest.status === 'COMPLETED') {
        try { setReport(await api.getFinalReport(latest.run_id)); } catch { /* none yet */ }
      }
    } catch (err) {
      console.warn('Failed to load runs for task:', err);
    }
  }, []);

  // Initial Data Fetching — no fabricated demo tasks; empty state is honest.
  useEffect(() => {
    const initData = async () => {
      try {
        const fetchedTasks = await api.listTasks();
        setTasks(fetchedTasks);

        api.getBenchmarkCases()
          .then((cases) => setBenchmarkCases(cases))
          .catch((e) => console.warn('Benchmark cases unavailable:', e));

        api.getMidSemQuestions()
          .then((d) => setMidsemQuestions(d.questions || []))
          .catch((e) => console.warn('Failed to load midsem questions:', e));

        setApiConnected(true);
      } catch (err) {
        console.error('API connection check failed:', err);
        setApiConnected(false);
      }
    };
    initData();
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      setTasks(await api.listTasks());
    } catch (err) {
      console.warn('Failed to refresh tasks:', err);
    }
  }, []);

  // Poll active run progress
  useEffect(() => {
    if (!activeRun || activeRun.status === 'COMPLETED' || activeRun.status === 'FAILED') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const updatedRun = await api.getRun(activeRun.run_id);
        setActiveRun(updatedRun);

        if (updatedRun.evidence_count > 0 || updatedRun.current_step === 'VERIFY' || updatedRun.status === 'COMPLETED') {
          const fetchedClaims = await api.getRunEvidence(activeRun.run_id);
          setClaims(fetchedClaims);
        }

        if (updatedRun.current_step === 'EXECUTE' || updatedRun.status === 'COMPLETED' || updatedRun.status === 'WAITING_APPROVAL') {
          const exp = await api.getRunExperiment(activeRun.run_id);
          if (exp) setExperiment(exp);
        }

        if (updatedRun.status === 'COMPLETED') {
          try {
            const rep = await api.getFinalReport(activeRun.run_id);
            setReport(rep);
          } catch (e) { /* report not ready */ }
          clearInterval(pollRef.current);

          showToast({
            title: 'Investigation Completed',
            message: `Research run finished with ${updatedRun.claims_count ?? 0} decomposed claims.`,
            type: 'success'
          });
          refreshTasks();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRun?.run_id, activeRun?.status, refreshTasks, showToast]);

  /** Select a task and load its latest run (explicit, no side-effect runs). */
  const handleSelectTask = useCallback(async (task: ResearchTask) => {
    setSelectedTask(task);
    await loadLatestRunForTask(task);
  }, [loadLatestRunForTask]);

  /** Explicitly start a run for the selected task (user-initiated action). */
  const handleStartRun = useCallback(async (task: ResearchTask, mode?: ExecutionMode) => {
    try {
      const newRun = await api.startRun(task.id, mode || task.execution_mode || 'autonomous');
      setActiveRun(newRun);
      setClaims([]);
      setExperiment(null);
      setReport(null);
      showToast({
        title: 'Run Started',
        message: `Agent pipeline launched for ${task.id} (${newRun.execution_mode} mode).`,
        type: 'info'
      });
    } catch (err) {
      showToast({ title: 'Run Failed to Start', message: String(err), type: 'error' });
    }
  }, [showToast]);

  const handleCreateTask = async (data: {
    question: string;
    domain: string;
    constraints: string;
    execution_mode: ExecutionMode;
  }) => {
    setIsLoadingTask(true);
    try {
      const newTask = await api.createTask(data);
      const newRun = await api.startRun(newTask.id, data.execution_mode);
      setTasks((prev: ResearchTask[]) => [newTask, ...prev]);
      setSelectedTask(newTask);
      setActiveRun(newRun);
      setClaims([]);
      setExperiment(null);
      setReport(null);
      setIsModalOpen(false);
      setActiveTab('workspace');

      showToast({
        title: 'Task Created',
        message: `Launched investigation in ${data.execution_mode} mode.`,
        type: 'success'
      });
    } catch (err) {
      showToast({
        title: 'Launch Failed',
        message: String(err),
        type: 'error'
      });
    } finally {
      setIsLoadingTask(false);
    }
  };

  const handleApproveGated = async () => {
    if (!activeRun) return;
    setIsApproving(true);
    try {
      await api.approveGatedRun(activeRun.run_id);
      const updated = await api.getRun(activeRun.run_id);
      setActiveRun(updated);
      showToast({
        title: 'Run Approved',
        message: `Execution authorized for ${activeRun.run_id}.`,
        type: 'success'
      });
    } catch (err) {
      showToast({
        title: 'Approval Error',
        message: String(err),
        type: 'error'
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReexecuteExperiment = async (expId: string) => {
    setIsReexecuting(true);
    try {
      const res = await api.reexecuteExperiment(expId);
      if (activeRun) {
        const exp = await api.getRunExperiment(activeRun.run_id);
        setExperiment(exp);
      }
      showToast({
        title: 'Experiment Re-executed',
        message: `Sandbox run finished (exit code ${res?.exit_code ?? '—'}).`,
        type: res?.exit_code === 0 ? 'success' : 'warning'
      });
    } catch (err) {
      showToast({
        title: 'Execution Failed',
        message: String(err),
        type: 'error'
      });
    } finally {
      setIsReexecuting(false);
    }
  };

  const handleRunBenchmark = async (limit: number) => {
    setIsRunningBenchmark(true);
    try {
      const res = await api.runBenchmark(limit);
      setBenchmarkResult(res);
      showToast({
        title: 'Benchmark Finished',
        message: `Tested ${res.case_results?.length ?? 0} benchmark cases.`,
        type: 'success'
      });
    } catch (err) {
      showToast({
        title: 'Benchmark Failed',
        message: String(err),
        type: 'error'
      });
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  const handleExecuteMidSemQuestion = async (questionText: string, domain: string = 'Artificial Intelligence & RAG') => {
    setIsLoadingTask(true);
    try {
      const newTask = await api.createTask({
        question: questionText,
        domain: domain,
        constraints: 'Core Verification Prototype',
        execution_mode: 'autonomous'
      });
      const newRun = await api.startRun(newTask.id, 'autonomous');
      setTasks((prev: ResearchTask[]) => [newTask, ...prev]);
      setSelectedTask(newTask);
      setActiveRun(newRun);
      setClaims([]);
      setExperiment(null);
      setReport(null);

      showToast({
        title: 'Question Running',
        message: `Analyzing: ${questionText.slice(0, 45)}...`,
        type: 'info'
      });
    } catch (err) {
      showToast({
        title: 'Execution Failed',
        message: String(err),
        type: 'error'
      });
    } finally {
      setIsLoadingTask(false);
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        evidenceCount={claims.length}
        hasReport={!!report}
        savedCount={undefined}
      />

      <div className="main-content">
        <Navbar
          activeRun={activeRun}
          onOpenNewModal={() => setIsModalOpen(true)}
          apiConnected={apiConnected}
          user={user}
          onLogout={logout}
          onToggleSidebar={() => {
            const el = document.querySelector('.sidebar');
            el?.classList.toggle('open');
          }}
        />

        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            tasks={tasks}
            activeRun={activeRun}
            onSelectTask={(t: ResearchTask) => {
              handleSelectTask(t);
              setActiveTab('workspace');
            }}
            onOpenNewModal={() => setIsModalOpen(true)}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'literature' && (
          <LiteratureDiscovery />
        )}

        {activeTab === 'workspace' && (
          <ResearchWorkspace
            task={selectedTask}
            run={activeRun}
            onApproveGated={handleApproveGated}
            onStartRun={handleStartRun}
            onNavigateTab={setActiveTab}
            isApproving={isApproving}
          />
        )}

        {activeTab === 'evidence' && (
          <EvidenceExplorer claims={claims} isLoading={false} />
        )}

        {activeTab === 'experiment' && (
          <ExperimentLab
            experiment={experiment}
            onReexecute={handleReexecuteExperiment}
            isExecuting={isReexecuting}
          />
        )}

        {activeTab === 'evaluation' && (
          <EvaluationHub
            benchmarkResult={benchmarkResult}
            benchmarkCases={benchmarkCases}
            onRunBenchmark={handleRunBenchmark}
            isRunningBenchmark={isRunningBenchmark}
          />
        )}

        {activeTab === 'report' && (
          <ReportViewer report={report} isLoading={false} />
        )}

        {activeTab === 'saved' && (
          <SavedPapers onNavigateTab={setActiveTab} />
        )}

        {activeTab === 'history' && (
          <ResearchHistory
            entries={tasks}
            onSelectTask={(t: ResearchTask) => {
              handleSelectTask(t);
              setActiveTab('workspace');
            }}
            onRefresh={refreshTasks}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage user={user} onLogout={logout} />
        )}

        {activeTab === 'core' && (
          <MidSemDemo
            questions={midsemQuestions}
            onExecuteQuestion={handleExecuteMidSemQuestion}
            isLoading={isLoadingTask || (activeRun !== null && activeRun.status === 'RUNNING')}
            activeRun={activeRun}
            claims={claims}
            report={report}
            onNavigateTab={setActiveTab}
          />
        )}
      </div>

      <NewResearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
        isLoading={isLoadingTask}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  </AuthProvider>
);
