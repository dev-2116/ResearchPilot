import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import init_db

init_db()
client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_task_creation_and_run_flow():
    # 1. Create Task
    task_payload = {
        "question": "Can claim-to-source provenance reduce unsupported claims in scientific research?",
        "domain": "Artificial Intelligence",
        "execution_mode": "autonomous"
    }
    create_res = client.post("/api/tasks", json=task_payload)
    assert create_res.status_code == 201
    task_data = create_res.json()
    task_id = task_data["id"]

    # 2. Get Task
    get_res = client.get(f"/api/tasks/{task_id}")
    assert get_res.status_code == 200
    assert get_res.json()["question"] == task_payload["question"]

    # 3. Start Run
    run_res = client.post(f"/api/tasks/{task_id}/runs", json={"execution_mode": "autonomous"})
    assert run_res.status_code == 202
    run_data = run_res.json()
    assert run_data["task_id"] == task_id
    assert "run_id" in run_data

def test_benchmark_runner():
    bench_res = client.post("/api/benchmarks/run", json={"cases_limit": 2})
    assert bench_res.status_code == 200
    b_data = bench_res.json()
    assert "metrics" in b_data
    assert "researchpilot" in b_data["metrics"]

def test_midsem_questions_endpoint():
    res = client.get("/api/midsem/questions")
    assert res.status_code == 200
    data = res.json()
    assert data["supported_count"] >= 10
    assert len(data["questions"]) >= 10

def test_midsem_query_validation():
    # Valid Question Match
    valid_res = client.post("/api/midsem/validate", json={"question": "How does hybrid BM25 compare to dense embeddings?"})
    assert valid_res.status_code == 200
    assert valid_res.json()["is_supported"] is True
    assert valid_res.json()["matched_question"]["id"] == "midsem_q1"

    # All questions across all domains are supported (guardrail removed)
    open_res = client.post("/api/midsem/validate", json={"question": "What are the latest advancements in quantum computing qubits?"})
    assert open_res.status_code == 200
    assert open_res.json()["is_supported"] is True

