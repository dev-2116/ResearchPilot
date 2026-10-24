import React, { useState, useEffect, useRef } from 'react';
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
import { AuthProvider, useAuth } from './context/AuthContext';
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

export const AppInner: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const [activeTab, setActiveTab] = useState<string>('core');
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

  // ── Auth guards ──────────────────────────────────────────────────────────────

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

  // ── Main App (authenticated) ────────────────────────────────────────────────

  return <AuthenticatedApp
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
  />;
};

// ── Main authenticated app ──────────────────────────────────────────────────
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

  // Initial Data Fetching
  useEffect(() => {
    const initData = async () => {
      try {
        const fetchedTasks = await api.listTasks();
        setTasks(fetchedTasks);

        const cases = await api.getBenchmarkCases();
        setBenchmarkCases(cases);

        try {
          const midsemData = await api.getMidSemQuestions();
          setMidsemQuestions(midsemData.questions || []);
        } catch (e) {
          console.warn('Failed to load midsem questions:', e);
        }

        // If tasks exist, load the latest one
        if (fetchedTasks.length > 0) {
          handleSelectTask(fetchedTasks[0]);
        } else {
          const initialTask = await api.createTask({
            question: 'How does hybrid BM25 and dense retrieval compare against dense-only embeddings in scientific domain QA?',
            domain: 'Artificial Intelligence & RAG',
            constraints: 'Evaluate recall and latency on technical terminology',
            execution_mode: 'autonomous'
          });
          const initialRun = await api.startRun(initialTask.id, 'autonomous');
          setTasks([initialTask]);
          setSelectedTask(initialTask);
          setActiveRun(initialRun);
        }
        setApiConnected(true);
      } catch (err) {
        console.error('API connection check failed:', err);
        setApiConnected(false);
      }
    };
    initData();
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
          } catch (e) {}
          clearInterval(pollRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRun?.run_id, activeRun?.status]);

  const handleSelectTask = async (task: ResearchTask) => {
    setSelectedTask(task);
    try {
      const currentRun = activeRun?.task_id === task.id ? activeRun : null;
      if (currentRun) {
        setActiveRun(currentRun);
      } else {
        const newRun = await api.startRun(task.id, task.execution_mode);
        setActiveRun(newRun);
      }

      const fetchedClaims = await api.getRunEvidence(activeRun?.run_id || task.id);
      setClaims(fetchedClaims);
      const exp = await api.getRunExperiment(activeRun?.run_id || task.id);
      setExperiment(exp);
    } catch (err) {
      console.warn('Error syncing task selection:', err);
    }
  };

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
    } catch (err) {
      alert(`Failed to launch research task: ${err}`);
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
    } catch (err) {
      alert(`Approval error: ${err}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReexecuteExperiment = async (expId: string) => {
    setIsReexecuting(true);
    try {
      await api.reexecuteExperiment(expId);
      if (activeRun) {
        const exp = await api.getRunExperiment(activeRun.run_id);
        setExperiment(exp);
      }
    } catch (err) {
      alert(`Execution error: ${err}`);
    } finally {
      setIsReexecuting(false);
    }
  };

  const handleRunBenchmark = async (limit: number) => {
    setIsRunningBenchmark(true);
    try {
      const res = await api.runBenchmark(limit);
      setBenchmarkResult(res);
    } catch (err) {
      alert(`Benchmark failed: ${err}`);
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
    } catch (err) {
      alert(`Failed to launch research task: ${err}`);
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
      />

      <div className="main-content">
        <Navbar
          activeRun={activeRun}
          onOpenNewModal={() => setIsModalOpen(true)}
          apiConnected={apiConnected}
          user={user}
          onLogout={logout}
        />

        {activeTab !== 'core' && (
          <div
            className="no-print"
            style={{
              margin: '16px 28px 0',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-amber" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Planned Architecture
              </span>
              <span style={{ fontSize: '0.84rem', color: '#92400e', fontWeight: 500 }}>
                This module is part of the planned architecture and is <strong>yet to be built</strong>. The live working prototype is the Literature Retrieval & Evidence Verification Core.
              </span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setActiveTab('core')}
              style={{
                fontSize: '0.78rem',
                padding: '5px 12px',
                background: '#ffffff',
                borderColor: '#f59e0b',
                color: '#b45309',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              ← Back to Implemented Core Demo
            </button>
          </div>
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

        {activeTab === 'dashboard' && (
          <Dashboard
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

        {activeTab === 'workspace' && (
          <ResearchWorkspace
            task={selectedTask}
            run={activeRun}
            onApproveGated={handleApproveGated}
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
    <AppInner />
  </AuthProvider>
);
