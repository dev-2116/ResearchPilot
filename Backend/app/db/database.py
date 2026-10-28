import json
import sqlite3
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.core.config import DATA_DIR, settings

DB_PATH = DATA_DIR / "researchpilot.db"

_lock = threading.Lock()

def get_connection():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with _lock:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Users Table (Authentication)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            role TEXT DEFAULT 'researcher',
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
        """)

        # Tasks Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS research_tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT 'user_default',
            question TEXT NOT NULL,
            domain TEXT DEFAULT 'AI/ML',
            constraints TEXT,
            execution_mode TEXT DEFAULT 'autonomous',
            status TEXT DEFAULT 'PENDING',
            created_at TEXT NOT NULL
        )
        """)
        
        # Runs Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            config_id TEXT DEFAULT 'default_cfg',
            status TEXT NOT NULL,
            current_step TEXT NOT NULL,
            progress REAL DEFAULT 0.0,
            execution_mode TEXT DEFAULT 'autonomous',
            started_at TEXT NOT NULL,
            ended_at TEXT,
            cost_tokens INTEGER DEFAULT 0,
            cost_usd REAL DEFAULT 0.0,
            evidence_count INTEGER DEFAULT 0,
            claims_count INTEGER DEFAULT 0,
            latest_error TEXT,
            FOREIGN KEY (task_id) REFERENCES research_tasks(id)
        )
        """)
        
        # Agent Steps Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_steps (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            step_index INTEGER NOT NULL,
            step_type TEXT NOT NULL,
            input_json TEXT,
            output_json TEXT,
            status TEXT NOT NULL,
            latency_ms INTEGER DEFAULT 0,
            token_usage INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        )
        """)
        
        # Documents Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            authors TEXT NOT NULL,
            identifier TEXT NOT NULL,
            publication_year INTEGER,
            venue TEXT,
            abstract TEXT,
            metadata_json TEXT
        )
        """)
        
        # Chunks Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            embedding_json TEXT,
            token_count INTEGER DEFAULT 0,
            FOREIGN KEY (document_id) REFERENCES documents(id)
        )
        """)
        
        # Claims Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS claims (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            text TEXT NOT NULL,
            confidence REAL DEFAULT 0.0,
            verification_status TEXT NOT NULL,
            explanation TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        )
        """)
        
        # Claim Evidence Mapping
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS claim_evidence (
            id TEXT PRIMARY KEY,
            claim_id TEXT NOT NULL,
            chunk_id TEXT NOT NULL,
            document_title TEXT NOT NULL,
            document_authors TEXT NOT NULL,
            document_identifier TEXT NOT NULL,
            passage_text TEXT NOT NULL,
            support_score REAL DEFAULT 0.0,
            entailment_type TEXT NOT NULL,
            retrieval_score REAL DEFAULT 0.0,
            FOREIGN KEY (claim_id) REFERENCES claims(id)
        )
        """)
        
        # Experiments Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            hypothesis TEXT NOT NULL,
            variables_json TEXT,
            baseline_method TEXT,
            proposed_method TEXT,
            code TEXT NOT NULL,
            status TEXT NOT NULL,
            stdout TEXT,
            stderr TEXT,
            exit_code INTEGER,
            duration_ms INTEGER,
            manifest_json TEXT,
            chart_url TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        )
        """)
        
        # Metrics Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            id TEXT PRIMARY KEY,
            experiment_id TEXT NOT NULL,
            name TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT,
            baseline_value REAL,
            delta_percentage REAL,
            FOREIGN KEY (experiment_id) REFERENCES experiments(id)
        )
        """)
        
        # Artifacts Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS artifacts (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            type TEXT NOT NULL,
            hash TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        )
        """)

        # Benchmarks Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS benchmarks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            description TEXT
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS benchmark_cases (
            id TEXT PRIMARY KEY,
            benchmark_id TEXT NOT NULL,
            category TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            question TEXT NOT NULL,
            reference_json TEXT,
            ground_truth_claims_json TEXT,
            FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id)
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS benchmark_runs (
            id TEXT PRIMARY KEY,
            benchmark_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            results_json TEXT NOT NULL
        )
        """)

        # Saved Papers Table (user library)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_papers (
            id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT 'user_default',
            title TEXT NOT NULL,
            authors TEXT,
            publication_year INTEGER,
            venue TEXT,
            abstract TEXT,
            identifier TEXT,
            url TEXT,
            source TEXT,
            citation_count INTEGER DEFAULT 0,
            saved_at TEXT NOT NULL
        )
        """)

        # Reports Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            run_id TEXT PRIMARY KEY,
            task_question TEXT NOT NULL,
            title TEXT NOT NULL,
            executive_summary TEXT NOT NULL,
            methodology TEXT NOT NULL,
            evidence_synthesis_json TEXT NOT NULL,
            experiment_results_json TEXT,
            limitations_json TEXT NOT NULL,
            citations_json TEXT NOT NULL,
            provenance_hash TEXT NOT NULL,
            generated_at TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        )
        """)

        conn.commit()
        conn.close()

# Database Helper Functions
class DB:
    @staticmethod
    def create_task(task_id: str, question: str, domain: str, constraints: Optional[str], execution_mode: str) -> Dict[str, Any]:
        with _lock:
            conn = get_connection()
            created_at = datetime.utcnow().isoformat() + "Z"
            conn.execute(
                "INSERT INTO research_tasks (id, question, domain, constraints, execution_mode, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (task_id, question, domain, constraints, execution_mode, "CREATED", created_at)
            )
            conn.commit()
            conn.close()
            return {
                "id": task_id,
                "question": question,
                "domain": domain,
                "constraints": constraints,
                "execution_mode": execution_mode,
                "status": "CREATED",
                "created_at": created_at
            }

    @staticmethod
    def get_task(task_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        row = conn.execute("SELECT * FROM research_tasks WHERE id = ?", (task_id,)).fetchone()
        conn.close()
        if not row:
            return None
        return dict(row)

    @staticmethod
    def list_tasks(limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_connection()
        rows = conn.execute("SELECT * FROM research_tasks ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def create_run(run_id: str, task_id: str, execution_mode: str = "autonomous") -> Dict[str, Any]:
        with _lock:
            conn = get_connection()
            started_at = datetime.utcnow().isoformat() + "Z"
            conn.execute(
                """INSERT INTO runs (id, task_id, status, current_step, progress, execution_mode, started_at, cost_tokens, cost_usd) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (run_id, task_id, "RUNNING", "TASK_CREATED", 0.05, execution_mode, started_at, 0, 0.0)
            )
            conn.commit()
            conn.close()
            return {
                "run_id": run_id,
                "task_id": task_id,
                "status": "RUNNING",
                "current_step": "TASK_CREATED",
                "progress": 0.05,
                "execution_mode": execution_mode,
                "started_at": started_at,
                "ended_at": None,
                "cost": {"tokens": 0, "usd": 0.0},
                "evidence_count": 0,
                "claims_count": 0,
                "steps": [],
                "latest_error": None
            }

    @staticmethod
    def update_run(run_id: str, **kwargs):
        with _lock:
            conn = get_connection()
            set_clauses = []
            values = []
            for k, v in kwargs.items():
                set_clauses.append(f"{k} = ?")
                values.append(v)
            values.append(run_id)
            query = f"UPDATE runs SET {', '.join(set_clauses)} WHERE id = ?"
            conn.execute(query, tuple(values))
            conn.commit()
            conn.close()

    @staticmethod
    def get_run(run_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if not row:
            conn.close()
            return None
        run_data = dict(row)
        
        # Fetch Steps
        step_rows = conn.execute(
            "SELECT * FROM agent_steps WHERE run_id = ? ORDER BY step_index ASC", (run_id,)
        ).fetchall()
        steps = []
        for s in step_rows:
            steps.append({
                "id": s["id"],
                "run_id": s["run_id"],
                "step_index": s["step_index"],
                "step_type": s["step_type"],
                "input": json.loads(s["input_json"]) if s["input_json"] else {},
                "output": json.loads(s["output_json"]) if s["output_json"] else {},
                "status": s["status"],
                "latency_ms": s["latency_ms"],
                "token_usage": s["token_usage"],
                "error_message": s["error_message"],
                "created_at": s["created_at"]
            })
            
        conn.close()
        return {
            "run_id": run_data["id"],
            "task_id": run_data["task_id"],
            "status": run_data["status"],
            "current_step": run_data["current_step"],
            "progress": run_data["progress"],
            "execution_mode": run_data["execution_mode"],
            "started_at": run_data["started_at"],
            "ended_at": run_data["ended_at"],
            "cost": {
                "tokens": run_data["cost_tokens"],
                "usd": run_data["cost_usd"]
            },
            "evidence_count": run_data["evidence_count"],
            "claims_count": run_data["claims_count"],
            "steps": steps,
            "latest_error": run_data["latest_error"]
        }

    @staticmethod
    def add_step(run_id: str, step_type: str, step_index: int, input_data: Dict, output_data: Dict, status: str, latency_ms: int, token_usage: int, error: Optional[str] = None, error_message: Optional[str] = None):
        step_id = f"step_{run_id}_{step_index}_{uuid.uuid4().hex[:6]}"
        created_at = datetime.utcnow().isoformat() + "Z"
        err_val = error or error_message
        with _lock:
            conn = get_connection()
            conn.execute(
                """INSERT INTO agent_steps (id, run_id, step_index, step_type, input_json, output_json, status, latency_ms, token_usage, error_message, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (step_id, run_id, step_index, step_type, json.dumps(input_data), json.dumps(output_data), status, latency_ms, token_usage, err_val, created_at)
            )
            conn.execute(
                "UPDATE runs SET cost_tokens = cost_tokens + ?, cost_usd = cost_usd + ? WHERE id = ?",
                (token_usage, token_usage * 0.000002, run_id)
            )
            conn.commit()
            conn.close()
        return step_id

    @staticmethod
    def save_claim(run_id: str, claim_id: str, text: str, confidence: float, verification_status: str, explanation: str):
        with _lock:
            conn = get_connection()
            conn.execute(
                "INSERT INTO claims (id, run_id, text, confidence, verification_status, explanation) VALUES (?, ?, ?, ?, ?, ?)",
                (claim_id, run_id, text, confidence, verification_status, explanation)
            )
            conn.execute("UPDATE runs SET claims_count = claims_count + 1 WHERE id = ?", (run_id,))
            conn.commit()
            conn.close()

    @staticmethod
    def save_claim_evidence(evidence_id: str, claim_id: str, chunk_id: str, doc_title: str, doc_authors: str, doc_identifier: str, passage: str, support_score: float, entailment_type: str, ret_score: float):
        with _lock:
            conn = get_connection()
            conn.execute(
                """INSERT INTO claim_evidence (id, claim_id, chunk_id, document_title, document_authors, document_identifier, passage_text, support_score, entailment_type, retrieval_score)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (evidence_id, claim_id, chunk_id, doc_title, doc_authors, doc_identifier, passage, support_score, entailment_type, ret_score)
            )
            conn.commit()
            conn.close()

    @staticmethod
    def get_run_claims(run_id: str) -> List[Dict[str, Any]]:
        conn = get_connection()
        claims_rows = conn.execute("SELECT * FROM claims WHERE run_id = ?", (run_id,)).fetchall()
        result = []
        for c in claims_rows:
            ev_rows = conn.execute("SELECT * FROM claim_evidence WHERE claim_id = ?", (c["id"],)).fetchall()
            evidence_list = []
            for ev in ev_rows:
                evidence_list.append({
                    "id": ev["id"],
                    "claim_id": ev["claim_id"],
                    "chunk_id": ev["chunk_id"],
                    "document_title": ev["document_title"],
                    "document_authors": ev["document_authors"],
                    "document_identifier": ev["document_identifier"],
                    "passage_text": ev["passage_text"],
                    "support_score": ev["support_score"],
                    "entailment_type": ev["entailment_type"],
                    "retrieval_score": ev["retrieval_score"]
                })
            result.append({
                "id": c["id"],
                "run_id": c["run_id"],
                "text": c["text"],
                "confidence": c["confidence"],
                "verification_status": c["verification_status"],
                "explanation": c["explanation"],
                "evidence": evidence_list
            })
        conn.close()
        return result

    @staticmethod
    def save_experiment(exp_id: str, run_id: str, hypothesis: str, variables: Dict, baseline: str, proposed: str, code: str, status: str, stdout: Optional[str] = None, stderr: Optional[str] = None, exit_code: Optional[int] = None, duration_ms: Optional[int] = None, manifest: Optional[Dict] = None, chart_url: Optional[str] = None):
        with _lock:
            conn = get_connection()
            conn.execute(
                """INSERT OR REPLACE INTO experiments (id, run_id, hypothesis, variables_json, baseline_method, proposed_method, code, status, stdout, stderr, exit_code, duration_ms, manifest_json, chart_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (exp_id, run_id, hypothesis, json.dumps(variables), baseline, proposed, code, status, stdout, stderr, exit_code, duration_ms, json.dumps(manifest) if manifest else None, chart_url)
            )
            conn.commit()
            conn.close()

    @staticmethod
    def add_metric(exp_id: str, name: str, value: float, unit: Optional[str] = None, baseline_value: Optional[float] = None, delta_percentage: Optional[float] = None):
        metric_id = f"met_{uuid.uuid4().hex[:8]}"
        with _lock:
            conn = get_connection()
            conn.execute(
                "INSERT INTO metrics (id, experiment_id, name, value, unit, baseline_value, delta_percentage) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (metric_id, exp_id, name, value, unit, baseline_value, delta_percentage)
            )
            conn.commit()
            conn.close()

    @staticmethod
    def get_run_experiment(run_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        row = conn.execute("SELECT * FROM experiments WHERE run_id = ?", (run_id,)).fetchone()
        if not row:
            conn.close()
            return None
        exp = dict(row)
        metrics_rows = conn.execute("SELECT * FROM metrics WHERE experiment_id = ?", (exp["id"],)).fetchall()
        metrics = []
        for m in metrics_rows:
            metrics.append({
                "id": m["id"],
                "name": m["name"],
                "value": m["value"],
                "unit": m["unit"],
                "baseline_value": m["baseline_value"],
                "delta_percentage": m["delta_percentage"]
            })
        conn.close()
        return {
            "id": exp["id"],
            "run_id": exp["run_id"],
            "hypothesis": exp["hypothesis"],
            "variables": json.loads(exp["variables_json"]) if exp["variables_json"] else {},
            "baseline_method": exp["baseline_method"],
            "proposed_method": exp["proposed_method"],
            "code": exp["code"],
            "status": exp["status"],
            "stdout": exp["stdout"],
            "stderr": exp["stderr"],
            "exit_code": exp["exit_code"],
            "duration_ms": exp["duration_ms"],
            "metrics": metrics,
            "manifest": json.loads(exp["manifest_json"]) if exp["manifest_json"] else None,
            "chart_url": exp["chart_url"]
        }

    @staticmethod
    def save_artifact(artifact_id: str, run_id: str, name: str, path: str, art_type: str, file_hash: str, file_size: int):
        with _lock:
            conn = get_connection()
            created_at = datetime.utcnow().isoformat() + "Z"
            conn.execute(
                "INSERT INTO artifacts (id, run_id, name, path, type, hash, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (artifact_id, run_id, name, path, art_type, file_hash, file_size, created_at)
            )
            conn.commit()
            conn.close()

    @staticmethod
    def get_run_artifacts(run_id: str) -> List[Dict[str, Any]]:
        conn = get_connection()
        rows = conn.execute("SELECT * FROM artifacts WHERE run_id = ?", (run_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def save_report(run_id: str, question: str, title: str, summary: str, methodology: str, evidence: List[Dict], experiments: Optional[Dict], limitations: List[str], citations: List[Dict], provenance_hash: str):
        with _lock:
            conn = get_connection()
            now = datetime.utcnow().isoformat() + "Z"
            conn.execute(
                """INSERT OR REPLACE INTO reports (run_id, task_question, title, executive_summary, methodology, evidence_synthesis_json, experiment_results_json, limitations_json, citations_json, provenance_hash, generated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (run_id, question, title, summary, methodology, json.dumps(evidence), json.dumps(experiments) if experiments else None, json.dumps(limitations), json.dumps(citations), provenance_hash, now)
            )
            conn.commit()
            conn.close()

    @staticmethod
    def get_report(run_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        row = conn.execute("SELECT * FROM reports WHERE run_id = ?", (run_id,)).fetchone()
        conn.close()
        if not row:
            return None
        r = dict(row)
        return {
            "run_id": r["run_id"],
            "task_question": r["task_question"],
            "title": r["title"],
            "executive_summary": r["executive_summary"],
            "methodology": r["methodology"],
            "evidence_synthesis": json.loads(r["evidence_synthesis_json"]),
            "experiment_results": json.loads(r["experiment_results_json"]) if r["experiment_results_json"] else None,
            "limitations": json.loads(r["limitations_json"]),
            "citations": json.loads(r["citations_json"]),
            "provenance_hash": r["provenance_hash"],
            "generated_at": r["generated_at"]
        }

    # ── Saved Papers (user library) ──────────────────────────────────────────

    @staticmethod
    def save_paper(paper_id: str, user_id: str, title: str, authors: Optional[str],
                   publication_year: Optional[int], venue: Optional[str], abstract: Optional[str],
                   identifier: Optional[str], url: Optional[str], source: Optional[str],
                   citation_count: Optional[int]) -> Optional[Dict[str, Any]]:
        """Persist a paper to the user's library. Returns None if it was already saved."""
        with _lock:
            conn = get_connection()
            # Deduplicate per user on identifier when available, else on exact title.
            if identifier:
                existing = conn.execute(
                    "SELECT id FROM saved_papers WHERE user_id = ? AND identifier = ?",
                    (user_id, identifier),
                ).fetchone()
            else:
                existing = conn.execute(
                    "SELECT id FROM saved_papers WHERE user_id = ? AND title = ?",
                    (user_id, title),
                ).fetchone()
            if existing:
                conn.close()
                return None
            saved_at = datetime.utcnow().isoformat() + "Z"
            conn.execute(
                """INSERT INTO saved_papers
                   (id, user_id, title, authors, publication_year, venue, abstract, identifier, url, source, citation_count, saved_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (paper_id, user_id, title, authors, publication_year, venue, abstract,
                 identifier, url, source, citation_count or 0, saved_at),
            )
            conn.commit()
            conn.close()
            return {
                "id": paper_id, "user_id": user_id, "title": title, "authors": authors,
                "publication_year": publication_year, "venue": venue, "abstract": abstract,
                "identifier": identifier, "url": url, "source": source,
                "citation_count": citation_count or 0, "saved_at": saved_at,
            }

    @staticmethod
    def list_saved_papers(user_id: str) -> List[Dict[str, Any]]:
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM saved_papers WHERE user_id = ? ORDER BY saved_at DESC",
            (user_id,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def delete_saved_paper(paper_id: str, user_id: str) -> bool:
        with _lock:
            conn = get_connection()
            cur = conn.execute(
                "DELETE FROM saved_papers WHERE id = ? AND user_id = ?",
                (paper_id, user_id),
            )
            conn.commit()
            deleted = cur.rowcount > 0
            conn.close()
            return deleted

    # ── Benchmark run persistence (real historical results) ─────────────────

    @staticmethod
    def save_benchmark_run(results: Dict[str, Any]) -> str:
        """Persist a completed benchmark suite execution so its results survive
        the process lifetime and become queryable history."""
        run_id = f"br_{uuid.uuid4().hex[:12]}"
        with _lock:
            conn = get_connection()
            conn.execute(
                "INSERT INTO benchmark_runs (id, benchmark_id, timestamp, results_json) VALUES (?, ?, ?, ?)",
                (
                    run_id,
                    results.get("benchmark_id", "unknown"),
                    results.get("timestamp", datetime.utcnow().isoformat() + "Z"),
                    json.dumps(results),
                ),
            )
            conn.commit()
            conn.close()
        return run_id

    @staticmethod
    def list_benchmark_runs(limit: int = 10) -> List[Dict[str, Any]]:
        conn = get_connection()
        rows = conn.execute(
            "SELECT id, benchmark_id, timestamp, results_json FROM benchmark_runs ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        out: List[Dict[str, Any]] = []
        for r in rows:
            entry = dict(r)
            try:
                entry["results"] = json.loads(entry.pop("results_json"))
            except (TypeError, ValueError):
                entry["results"] = {}
            out.append(entry)
        return out

    @staticmethod
    def get_monthly_investigations(year: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Aggregate actual research tasks created in each calendar month for the specified year.
        Uses authoritative created_at timestamps. Returns 12 records (Jan through Dec).
        Months with 0 investigations are included with count 0.
        """
        if year is None:
            year = datetime.utcnow().year

        conn = get_connection()
        year_str = str(year)
        rows = conn.execute(
            """SELECT CAST(substr(created_at, 6, 2) AS INTEGER) AS m, COUNT(*) AS cnt
               FROM research_tasks
               WHERE substr(created_at, 1, 4) = ?
               GROUP BY m""",
            (year_str,)
        ).fetchall()
        conn.close()

        counts = {int(r["m"]): int(r["cnt"]) for r in rows if r["m"] is not None}
        month_defs = [
            ("Jan", "January", 1),
            ("Feb", "February", 2),
            ("Mar", "March", 3),
            ("Apr", "April", 4),
            ("May", "May", 5),
            ("Jun", "June", 6),
            ("Jul", "July", 7),
            ("Aug", "August", 8),
            ("Sep", "September", 9),
            ("Oct", "October", 10),
            ("Nov", "November", 11),
            ("Dec", "December", 12),
        ]
        return [
            {
                "month": short_m,
                "month_full": full_m,
                "month_num": m_num,
                "year": year,
                "count": counts.get(m_num, 0),
            }
            for short_m, full_m, m_num in month_defs
        ]

    # ── Aggregated statistics (real data for the dashboard) ──────────────────

    @staticmethod
    def get_dashboard_stats(recent_limit: int = 8) -> Dict[str, Any]:
        conn = get_connection()

        def scalar(sql: str, params: tuple = ()) -> int:
            row = conn.execute(sql, params).fetchone()
            return row[0] if row else 0

        current_year = datetime.utcnow().year
        monthly_investigations = DB.get_monthly_investigations(current_year)

        stats: Dict[str, Any] = {
            "tasks_total": scalar("SELECT COUNT(*) FROM research_tasks"),
            "runs_total": scalar("SELECT COUNT(*) FROM runs"),
            "runs_completed": scalar("SELECT COUNT(*) FROM runs WHERE status = 'COMPLETED'"),
            "runs_failed": scalar("SELECT COUNT(*) FROM runs WHERE status = 'FAILED'"),
            "runs_active": scalar(
                "SELECT COUNT(*) FROM runs WHERE status IN ('PENDING','RUNNING','WAITING_APPROVAL')"
            ),
            "claims_total": scalar("SELECT COUNT(*) FROM claims"),
            "claims_supported": scalar(
                "SELECT COUNT(*) FROM claims WHERE verification_status = 'SUPPORTED'"
            ),
            "claims_refuted": scalar(
                "SELECT COUNT(*) FROM claims WHERE verification_status = 'REFUTED'"
            ),
            "claims_insufficient": scalar(
                "SELECT COUNT(*) FROM claims WHERE verification_status NOT IN ('SUPPORTED','REFUTED')"
            ),
            "experiments_total": scalar("SELECT COUNT(*) FROM experiments"),
            "experiments_completed": scalar(
                "SELECT COUNT(*) FROM experiments WHERE status = 'COMPLETED'"
            ),
            "reports_total": scalar("SELECT COUNT(*) FROM reports"),
            "documents_total": scalar("SELECT COUNT(*) FROM documents"),
            "chunks_total": scalar("SELECT COUNT(*) FROM chunks"),
            "benchmark_runs_total": scalar("SELECT COUNT(*) FROM benchmark_runs"),
            "saved_papers_total": scalar("SELECT COUNT(*) FROM saved_papers"),
            "monthly_investigations": monthly_investigations,
            "investigations_year": current_year,
            "task_status_distribution": [
                {"status": r["status"], "count": r["cnt"]}
                for r in conn.execute(
                    "SELECT status, COUNT(*) AS cnt FROM research_tasks GROUP BY status ORDER BY cnt DESC"
                ).fetchall()
            ],
            "task_domain_distribution": [
                {"domain": r["domain"] or "Unspecified", "count": r["cnt"]}
                for r in conn.execute(
                    "SELECT domain, COUNT(*) AS cnt FROM research_tasks GROUP BY domain ORDER BY cnt DESC LIMIT 6"
                ).fetchall()
            ],
            "activity_daily": [
                {"date": r["d"], "tasks": r["cnt"]}
                for r in conn.execute(
                    """SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS cnt
                       FROM research_tasks
                       WHERE substr(created_at, 1, 10) >= date('now', '-13 days')
                       GROUP BY d ORDER BY d ASC"""
                ).fetchall()
            ],
            "recent_tasks": [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM research_tasks ORDER BY created_at DESC LIMIT ?",
                    (recent_limit,),
                ).fetchall()
            ],
        }
        conn.close()
        return stats

    @staticmethod
    def list_task_runs(task_id: str) -> List[Dict[str, Any]]:
        """List runs for a task (lightweight: no per-step payloads)."""
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM runs WHERE task_id = ? ORDER BY started_at DESC",
            (task_id,),
        ).fetchall()
        conn.close()
        return [
            {
                "run_id": r["id"],
                "task_id": r["task_id"],
                "status": r["status"],
                "current_step": r["current_step"],
                "progress": r["progress"],
                "execution_mode": r["execution_mode"],
                "started_at": r["started_at"],
                "ended_at": r["ended_at"],
                "cost": {"tokens": r["cost_tokens"], "usd": r["cost_usd"]},
                "evidence_count": r["evidence_count"],
                "claims_count": r["claims_count"],
                "latest_error": r["latest_error"],
            }
            for r in rows
        ]

    @staticmethod
    def list_history(limit: int = 100) -> List[Dict[str, Any]]:
        """Tasks enriched with their run summaries for the Research History page."""
        conn = get_connection()
        rows = conn.execute(
            """SELECT t.*,
                      (SELECT COUNT(*) FROM runs r WHERE r.task_id = t.id) AS run_count,
                      (SELECT r.status FROM runs r WHERE r.task_id = t.id
                        ORDER BY r.started_at DESC LIMIT 1) AS latest_run_status,
                      (SELECT r.id FROM runs r WHERE r.task_id = t.id
                        ORDER BY r.started_at DESC LIMIT 1) AS latest_run_id,
                      (SELECT r.claims_count FROM runs r WHERE r.task_id = t.id
                        ORDER BY r.started_at DESC LIMIT 1) AS latest_claims_count,
                      (SELECT r.evidence_count FROM runs r WHERE r.task_id = t.id
                        ORDER BY r.started_at DESC LIMIT 1) AS latest_evidence_count,
                      (SELECT COUNT(*) FROM reports rep WHERE rep.run_id IN
                        (SELECT r.id FROM runs r WHERE r.task_id = t.id)) AS report_count
               FROM research_tasks t
               ORDER BY t.created_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    # ── User / Auth helpers ────────────────────────────────────────────────────

    @staticmethod
    def create_user(user_id: str, full_name: str, email: str, hashed_password: str, role: str = "researcher") -> Dict[str, Any]:
        now = datetime.utcnow().isoformat()
        with _lock:
            conn = get_connection()
            conn.execute(
                "INSERT INTO users (id, full_name, email, hashed_password, role, is_active, created_at) VALUES (?,?,?,?,?,1,?)",
                (user_id, full_name, email, hashed_password, role, now)
            )
            conn.commit()
            conn.close()
        return {"id": user_id, "full_name": full_name, "email": email, "role": role, "created_at": now}

    @staticmethod
    def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower(),)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return dict(row) if row else None
