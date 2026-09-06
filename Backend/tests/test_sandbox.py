import pytest
from app.services.sandbox import experiment_sandbox

def test_code_generation_and_execution():
    code, variables = experiment_sandbox.generate_experiment_code(
        task_question="Compare baseline LLM vs ResearchPilot",
        hypothesis="Evidence-verified agents demonstrate higher answer accuracy.",
        baseline_name="Baseline LLM",
        proposed_name="ResearchPilot"
    )
    assert "numpy" in code
    assert "experiment_results.png" in code
    
    result = experiment_sandbox.execute_in_sandbox(
        code=code,
        run_id="test_run_001",
        exp_id="test_exp_001",
        variables=variables
    )
    assert result["status"] == "COMPLETED"
    assert result["exit_code"] == 0
    assert len(result["metrics"]) > 0
    assert result["manifest"]["random_seed"] == 42
