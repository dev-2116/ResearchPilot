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
import { api } from './services/api';
import {
  BenchmarkCase,
  BenchmarkResult,
  Claim,
  ExecutionMode,
  Experiment,
  FinalReport,
  ResearchTask,
  Run,
} from './types';

export const App: React.FC = () => {
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

  // Loading States
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isReexecuting, setIsReexecuting] = useState(false);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  // Polling interval ref
  const pollRef = useRef<any>(null);

  // Initial Data Fetching
  useEffect(() => {
    const initData = async () => {
      try {
        const fetchedTasks = await api.listTasks();
        setTasks(fetchedTasks);

        const cases = await api.getBenchmarkCases();
        setBenchmarkCases(cases);

        // If tasks exist, load the latest one
        if (fetchedTasks.length > 0) {
          handleSelectTask(fetchedTasks[0]);
        } else {
          // Create initial starter research task so the prototype is ready immediately
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

        // Update Claims & Evidence if generated
        if (updatedRun.evidence_count > 0 || updatedRun.current_step === 'VERIFY' || updatedRun.status === 'COMPLETED') {
          const fetchedClaims = await api.getRunEvidence(activeRun.run_id);
          setClaims(fetchedClaims);
        }

        // Update Experiment if generated
        if (updatedRun.current_step === 'EXECUTE' || updatedRun.status === 'COMPLETED' || updatedRun.status === 'WAITING_APPROVAL') {
          const exp = await api.getRunExperiment(activeRun.run_id);
          if (exp) setExperiment(exp);
        }

        // Update Report if completed
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
      // Find latest run for this task or start new one
      const currentRun = activeRun?.task_id === task.id ? activeRun : null;
      if (currentRun) {
        setActiveRun(currentRun);
      } else {
        // Fetch run evidence & experiments
        // If no run is active, create a run for it
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
      setTasks((prev) => [newTask, ...prev]);
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
        />

        {activeTab === 'dashboard' && (
          <Dashboard
            tasks={tasks}
            activeRun={activeRun}
            onSelectTask={(t) => {
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
