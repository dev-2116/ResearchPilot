# ResearchPilot

**Evidence-Verified Autonomous AI Research Agent**

ResearchPilot is a full-stack research assistant that runs a controlled, traceable research workflow instead of free-form text generation. You submit a research question; the backend plans the task, retrieves literature, extracts evidence passages with citation provenance, verifies claims against that evidence, designs and executes a sandboxed experiment, evaluates the results, and produces a structured report — recording every step as a replayable trace. The repository is both a working web application and a research testbed for studying evidence-grounded agent architectures.

## Table of Contents

- What ResearchPilot Does
- Current Implementation Status
- Tech Stack
- Architecture
- Repository Layout
- Prerequisites
- Backend Setup (Windows PowerShell)
- Frontend Setup (Windows PowerShell)
- Environment Configuration
- Service URLs
- API Overview
- Running Tests
- Database and Artifacts
- Research Design and Roadmap
- Security Notes
- License
- Status

## What ResearchPilot Does

- **Research dashboard** — create research tasks, launch runs, follow the pipeline on a live state graph, inspect evidence, experiments, and reports.
- **11-step agent pipeline** — `PLAN → RETRIEVE → EXTRACT_EVIDENCE → VERIFY → DESIGN_EXPERIMENT → GENERATE_CODE → EXECUTE → EVALUATE → REVIEW → REPORT → COMPLETE`, implemented as an explicit state machine with step budgets rather than an unbounded loop.
- **Hybrid retrieval** — BM25 + dense semantic scoring with reciprocal-rank fusion over a preloaded academic corpus, plus optional live lookups against public scholarly APIs (Semantic Scholar, OpenAlex, CrossRef — no API keys required).
- **Claim-level provenance** — every claim maps to evidence passages with support scores, entailment labels, and full citation metadata; retrieval relevance alone never counts as support.
- **Sandboxed experiments** — generated Python code executes in an isolated subprocess with a hard timeout and restricted environment; a deterministic random seed and a SHA-256-hashed manifest make every run reproducible and auditable.
- **JWT-secured multi-user access** — register/login with bcrypt password hashing.
- **Benchmark runner** — compares standard-LLM / basic-RAG / agentic-RAG / ResearchPilot profiles on a fixed case suite.
- **Full run traces** — every step records inputs, outputs, latency, token accounting, and evidence counts; reports embed provenance hashes.

## Current Implementation Status

Read this before contributing, so expectations match the code.

**Implemented and verified** (all commands in this README were executed against the code):

- FastAPI backend with 26 endpoints (verified via `/openapi.json`), JWT authentication, and SQLite persistence with 14 auto-initialized tables.
- React 18 + Vite 5 dashboard; production build type-checks cleanly.
- pytest suite: 13 tests across five test files, all passing.
- Hybrid retrieval, evidence extraction, heuristic claim verification, sandboxed experiment execution, report generation, and the full end-to-end pipeline.

**Deterministic simulations (by design, clearly labeled in code):**

- Experiment metrics are produced by synthetic-data experiments (seed 42) generated from a sandbox template. They exercise the entire pipeline and its reproducibility machinery, but they are not measurements from real machine-learning experiments.
- The benchmark comparison computes its metric table from a fixed, code-defined dataset.
- Claim verification is a heuristic scorer, not a neural NLI model.

**Roadmap targets (not current behavior):** wiring an external LLM (e.g. Google Gemini via the reserved `LLM_API_KEY`), PostgreSQL + pgvector persistence, Docker-isolated experiment execution, and the empirical benchmark study described under *Research Design and Roadmap*.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5, lucide-react, clsx |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 |
| Authentication | bcrypt + python-jose (HS256 JWT) |
| Data | SQLite via the standard library (`sqlite3`); PostgreSQL/pgvector is a roadmap target |
| Retrieval & analysis | httpx, numpy, scikit-learn, matplotlib |
| Configuration | python-dotenv (`.env` support) |
| Testing | pytest |

## Architecture

```
Browser — React SPA (http://localhost:5173)
   │  fetches /api/* — proxied by the Vite dev server
   ▼
FastAPI / Uvicorn (http://127.0.0.1:8000)
   ├─ app/api/auth.py            JWT register / login / me (bcrypt, HS256)
   ├─ app/api/endpoints.py       tasks, runs, trace, evidence, experiments,
   │                             artifacts, benchmarks, literature, midsem…
   ├─ app/services/orchestrator.py   11-step state machine (background task)
   ├─ app/services/retrieval.py      hybrid BM25 + dense fusion, RRF
   ├─ app/services/paper_fetcher.py  live scholarly APIs (no keys)
   ├─ app/services/verifier.py       claim–evidence support scoring
   ├─ app/services/sandbox.py        subprocess experiment runner
   ├─ app/services/report.py         structured report assembly
   ├─ app/services/benchmark.py      architecture comparison runner
   └─ app/db/database.py             SQLite schema, init_db(), all queries
   ▼
Backend/data/researchpilot.db          Backend/artifacts/<run_id>/
(SQLite, auto-created)                 (per-run outputs, hashed manifests)
```

The API layer creates a run and returns immediately; the orchestrator executes the pipeline as a background task while the dashboard polls run status. CORS is enabled so the frontend can also talk to the backend directly without the proxy.

## Repository Layout

```
ResearchPilot/
├── Backend/
│   ├── app/
│   │   ├── api/                # HTTP layer: endpoints.py (research API), auth.py (JWT)
│   │   ├── core/config.py      # Settings, .env loading, runtime directories
│   │   ├── db/database.py      # SQLite schema (14 tables), init_db(), queries
│   │   ├── models/schemas.py   # Pydantic request/response models
│   │   ├── services/           # orchestrator, retrieval, verifier, sandbox,
│   │   │                       #   report, benchmark, paper_fetcher, corpus, midsem_qa
│   │   └── main.py             # FastAPI app; startup runs init_db + config report
│   ├── tests/                  # pytest suite (api, retrieval, verifier, sandbox, paper_fetcher)
│   ├── requirements.txt        # pinned-minimum Python dependencies
│   ├── .env.example            # configuration template with explanations
│   ├── pytest.ini              # sets pythonpath=. (run pytest from Backend/)
│   ├── data/                   # runtime: SQLite DB — git-ignored, auto-created
│   └── artifacts/              # runtime: per-run experiment outputs — git-ignored
├── Frontend/
│   ├── src/pages/              # Dashboard, ResearchWorkspace, EvidenceExplorer,
│   │                           #   ExperimentLab, EvaluationHub, ReportViewer,
│   │                           #   LiteratureDiscovery, MidSemDemo, Login/Register
│   ├── src/components/         # Navbar, Sidebar, StateGraph, NewResearchModal
│   ├── src/context/            # AuthContext (JWT), ToastContext
│   ├── src/services/api.ts     # typed backend client
│   ├── src/types/index.ts      # shared TypeScript types
│   ├── vite.config.ts          # dev port 5173, /api proxy → 127.0.0.1:8000
│   └── package.json            # scripts: dev, build (tsc && vite build), preview
├── docs/examples/research-pipeline/   # curated real-run artifact example + provenance
├── .gitignore                  # excludes deps, caches, env files, runtime data
└── README.md
```

## Prerequisites

| Tool | Required version | Verified with |
|---|---|---|
| Python | 3.11 or later | 3.12.15 |
| Node.js | 18 or later (Vite 5 requirement) | 24.21.0 |
| npm | 9 or later | 11.19.0 |
| Git | any recent version | — |

No Docker, PostgreSQL, or external API keys are required for local development.

## Backend Setup (Windows PowerShell)

```powershell
# 1. Clone and enter the project
git clone https://github.com/dev-2116/ResearchPilot.git
cd ResearchPilot\Backend

# 2. Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# If PowerShell blocks script execution, run this once, then retry:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 3. Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 4. (Optional) configure the environment
Copy-Item .env.example .env
notepad .env    # placeholders and explanations are inside the file

# 5. Start the API on http://127.0.0.1:8000
uvicorn app.main:app --reload
```

Notes:

- Run from the `Backend` directory — the app module path is `app.main:app`. `python -m app.main` is an equivalent launcher (see `app/main.py`); both serve on `127.0.0.1:8000`.
- The SQLite database is created and initialized automatically on first startup — there is no migration step.
- To change the port: `uvicorn app.main:app --reload --port 8001` (then update the frontend proxy, see *Service URLs*).
- Temporary environment variables in PowerShell: `$env:JWT_SECRET_KEY = "your-generated-value"`. Prefer the `.env` file — it is loaded automatically.

Equivalent bash (Linux/macOS):

```bash
cd Backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Frontend Setup (Windows PowerShell)

```powershell
# In a second terminal
cd ResearchPilot\Frontend

node -v          # confirm 18 or later
npm install      # or: npm ci — installs exactly from package-lock.json
npm run dev      # serves the dashboard at http://localhost:5173
```

Production build:

```powershell
npm run build    # type-checks with tsc, outputs Frontend/dist/
npm run preview  # serves the built app at http://localhost:4173
```

Keep the backend running in its own terminal — the dashboard needs it for every page except login/registration, which also require it.

## Environment Configuration

Copy `Backend/.env.example` to `Backend/.env` and fill in values you need. The example file contains placeholders and explanations only — never real credentials. Real environment variables take precedence over `.env` values, and `.env` is git-ignored.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///data/researchpilot.db` | Connection string; may contain credentials, so keep it in `.env` only. PostgreSQL URLs are a roadmap target — the current DB layer uses SQLite directly. |
| `DEBUG` | `true` | Development mode; set `false` for production. |
| `LLM_API_KEY` | *(empty)* | Reserved for wiring an external LLM (e.g. Google Gemini) into the verifier. The built-in heuristic verifier makes no external calls — no key is required today. |
| `LLM_MODEL` | `researchpilot-verifier-v1` | Model identifier recorded in traces and manifests. |
| `JWT_SECRET_KEY` | *(ephemeral random)* | Signs auth tokens. Required for real deployments; if unset, a random per-process key is used with a clear notice, and sessions reset on restart. Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm. |

On startup the API prints a configuration report naming which variables are set or missing. It never prints secret values: database URLs are reduced to their scheme (`sqlite://***`), and keys are reported only as *set (value hidden)*.

## Service URLs

| URL | Service | How to change the port |
|---|---|---|
| `http://localhost:5173` | Frontend dev server | `npm run dev -- --port 3000`, or `server.port` in `Frontend/vite.config.ts` |
| `http://127.0.0.1:8000` | Backend API | `uvicorn app.main:app --port <port>` |
| `http://127.0.0.1:8000/docs` | Swagger UI (interactive API docs) | follows the backend port |
| `http://127.0.0.1:8000/openapi.json` | OpenAPI schema | follows the backend port |
| `http://127.0.0.1:8000/health` | Health check | follows the backend port |
| `http://localhost:4173` | Built frontend (`npm run preview`) | `npm run preview -- --port 5000` |

If you move the backend off port 8000, update the proxy target in `Frontend/vite.config.ts` (`server.proxy['/api'].target`) and restart the dev server, otherwise dashboard requests will fail.

## API Overview

All endpoints are prefixed with `/api` (26 routes, verified via `/openapi.json`):

- **Authentication** — `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **Tasks & runs** — `POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/{task_id}`, `POST /api/tasks/{task_id}/runs`, `GET /api/runs/{run_id}`, `POST /api/runs/{run_id}/approve`
- **Run inspection** — `GET /api/runs/{run_id}/trace`, `/evidence`, `/experiments`, `/artifacts`, `/report`
- **Experiments** — `POST /api/experiments/{experiment_id}/execute` (re-executes in the sandbox)
- **Artifacts** — `GET /api/artifacts/{run_id}/{filename}` (serves charts, manifests, metrics)
- **Benchmarks** — `GET /api/benchmarks/cases`, `POST /api/benchmarks/run`
- **Literature** — `GET /api/literature/search`, `GET /api/literature/sources`, `POST /api/literature/import`
- **Utilities** — `GET /api/search`, `GET /api/corpus`, `GET /api/midsem/questions`, `POST /api/midsem/validate`, `GET /health`

Interactive documentation lives at `/docs` while the backend is running.

## Running Tests

```powershell
cd ResearchPilot\Backend
.\.venv\Scripts\Activate.ps1
python -m pytest tests -v
```

The suite contains 13 tests across five files: `test_api.py` (end-to-end pipeline, benchmark, and midsem endpoints), `test_retrieval.py`, `test_verifier.py`, `test_sandbox.py`, and `test_paper_fetcher.py`. Run pytest from the `Backend` directory (`pytest.ini` sets `pythonpath = .`). All 13 tests passed when this documentation was last verified.

## Database and Artifacts

- The SQLite database (`Backend/data/researchpilot.db`) and its 14 tables are created automatically at startup; there is no migration or seed step. The demo corpus and benchmark cases live in code (`app/services/corpus.py`, `app/services/benchmark.py`), not in the database.
- To reset local data: stop the server, then `Remove-Item .\data\researchpilot.db*` (PowerShell) or `rm -f data/researchpilot.db*` (bash), and restart.
- Experiment outputs (script, manifest, metrics, chart) are written to `Backend/artifacts/<run_id>/` and are git-ignored. A curated, verified example of a real run — including how to reproduce it byte-for-byte — lives in `docs/examples/research-pipeline/`.

## Research Design and Roadmap

*(Planned study — this section describes the research direction, not current behavior.)*

The project is organized around four research questions: whether evidence verification reduces unsupported claims; whether claim-level provenance improves citation precision; whether experiment feedback improves conclusion validity; and what verification costs in latency and tokens. The planned study compares ResearchPilot against three baselines — a plain LLM, basic RAG, and agentic RAG — on a shared benchmark, with ablations for verification, hybrid retrieval, reranking, and the feedback loop. Results should be analyzed for quality **and** cost, and the design stays falsifiable.

The development roadmap proceeds in phases: full-stack skeleton → retrieval → evidence layer → orchestration → experiment lab → evaluation suite → the comparative study → paper and deployment. The target architecture adds PostgreSQL + pgvector for scalable semantic retrieval, Docker-based experiment isolation, and external LLM integration. The working title for the resulting paper is *"ResearchPilot: An Evidence-Verified Agentic Framework for Reproducible AI-Assisted Research."*

## Security Notes

- **Secrets** live only in `Backend/.env` (git-ignored); `.env.example` contains placeholders. The startup report and logs never print secret values. If a credential is ever committed, treat it as compromised: revoke and rotate it at the provider, remove it from the source, and rewrite history (e.g. `git filter-repo` or BFG) before force-pushing.
- **Authentication** uses bcrypt password hashing and HS256 JWTs. Set `JWT_SECRET_KEY` in any shared or deployed environment; the per-process ephemeral fallback is for local development only.
- **Generated experiment code** is treated as untrusted: it runs in a subprocess with a 15-second timeout, a restricted environment, and hashed artifacts (Docker isolation is a roadmap target).
- **Retrieved text** is treated as untrusted input, never as instructions (prompt-injection defense).

## License

Add your chosen license here (for example, MIT or Apache 2.0).

## Status

This project is under active development. The documentation above was verified against the codebase on 2026-10-26: every command was executed on Linux (Python 3.12.15, Node 24.21.0, npm 11.19.0), and the Windows PowerShell commands use standard, equivalent syntax. Backend behavior was confirmed via live requests to `/health`, `/docs`, and `/openapi.json`, and the frontend via `npm run dev`, `npm run build`, and `npm run preview`.
