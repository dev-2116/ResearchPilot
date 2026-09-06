# ResearchPilot

**Evidence-Verified Autonomous AI Research Agent**

ResearchPilot is an AI-powered research assistant that performs a controlled, traceable research workflow instead of simply generating text. A user submits a research question, and the system plans the task, retrieves literature and evidence, verifies claims, proposes an experiment, generates and executes code in a controlled sandbox, evaluates the outcome, and produces a traceable research report.

The core idea behind the project is evidence-first autonomous research: every important factual claim should be connected to retrieved evidence, every experiment should record its inputs and configuration, and every conclusion should be based on observable results. That makes this repository both a software product (a working web application) and a research testbed (a benchmark plus an empirical study comparing agent architectures).

## Table of Contents

- Overview
- Key Features
- Tech Stack
- System Architecture
- Agent Pipeline
- Repository Layout
- Getting Started
- Data Model
- API Overview
- Evaluation and Benchmark
- Research Methodology
- Development Roadmap
- Testing
- Security and Sandbox
- Observability and Reproducibility
- Deployment
- Research Paper
- Risks and Limitations
- Contributing
- License

## Overview

Large language models can generate fluent research-style answers, but fluency does not guarantee factual correctness, valid citations, valid experiments, or reproducibility. The problem ResearchPilot addresses is how an AI research agent can be designed so that its outputs are more evidence-grounded, verifiable, and reproducible than a conventional LLM or a basic RAG system.

The proposed contribution is what the project calls the Evidence-Verified Research Loop. It combines claim-level evidence tracking, verification before final conclusions, experiment provenance, and feedback from experiment results back into the agent's state.

The project is organized around four research questions. The first asks whether evidence verification reduces unsupported claims, with the hypothesis that verified agents produce a lower unsupported-claim rate. The second asks whether provenance improves citation correctness, hypothesizing that claim-level provenance increases citation precision. The third asks whether experiment feedback improves final conclusions, hypothesizing that feedback-loop agents produce more valid conclusions. The fourth asks what verification costs, hypothesizing that it improves reliability at a measurable latency and token cost.

## Key Features

ResearchPilot lets a user create and track research tasks through a web dashboard. It performs hybrid literature retrieval that combines keyword and semantic search with reranking, and it extracts evidence while tracking citations and claim-to-source provenance. A verification step checks whether claims are actually supported by retrieved evidence before the system relies on them. The agent can generate a hypothesis and an experiment plan, then execute the resulting code in a sandboxed, resource-limited environment rather than on the host system. Results are evaluated automatically against baselines, and every run produces a full trace of decisions, evidence, code, metrics, and outputs. Reports are generated with citations and experiment results attached, and a benchmark suite makes it possible to compare different agent architectures on the same tasks.

By design, the first version does not include a custom foundation model, a large-scale web crawler, a full scientific database, unrestricted shell execution, or a general-purpose autonomous agent with unbounded capabilities. Those additions increase risk without strengthening the research contribution.

## Tech Stack

The frontend is built with Next.js and TypeScript for the research dashboard and workflow UI. The backend is a FastAPI service written in Python. Data is stored in PostgreSQL, with the pgvector extension handling semantic evidence retrieval. Agent logic, retrieval, and evaluation are all implemented in Python, using structured LLM tool calling. Experiment code runs inside Docker containers to keep execution isolated and reproducible, and the project is versioned with Git and hosted on GitHub.

## System Architecture

The system uses a layered architecture so that the UI, API, agent logic, retrieval, data, and execution environment stay separate. This keeps the project from collapsing into a single large script and makes research experiments easier to reproduce.

The presentation layer is the Next.js dashboard, including forms, the run timeline, and the evidence viewer. The API layer handles authentication, task CRUD operations, run control, and report endpoints. The orchestration layer runs the agent's state machine, handling retries, routing, and stopping rules. The AI services layer wraps LLM calls, embeddings, reranking, and structured outputs. The retrieval layer handles paper and source search, chunking, indexing, and ranking. The verification layer checks claims, scores evidence, and detects contradictions. The execution layer is the sandboxed experiment runner. Persistence is handled by PostgreSQL, pgvector, and object or file storage. Finally, the observability layer captures logs, traces, metrics, and cost and run metadata.

At a high level, a user's request flows from the Next.js web UI into the FastAPI backend, which hands it to the research task manager. From there, the agent orchestrator takes over, calling out through a tool gateway to PostgreSQL and pgvector, a document and evidence store, and a sandboxed code executor as needed.

## Agent Pipeline

The agent moves through an explicit state machine rather than an uncontrolled recursive loop: a task is created, then the agent plans, retrieves, extracts evidence, verifies, designs an experiment, generates code, executes it, evaluates the results, reviews them, produces a report, and completes the run.

Within that pipeline, a planner breaks the research question into steps, and a retriever selects sources and evidence. An evidence verifier assesses whether the evidence actually supports the claims and checks for contradictions. An experiment designer defines the hypothesis, baseline, variables, and metrics, and a code generator turns that design into runnable experiment code. An executor runs that code in the sandbox, and an evaluator calculates metrics and checks their validity. A reviewer then decides whether the results actually support the claim, and a report generator writes the final structured report with full provenance.

A few control rules keep the agent bounded: there's a maximum number of steps and tool calls per run, retries only happen for recoverable failures, generated code never executes outside the sandbox, evidence is required before any high-confidence factual claim, experiment outputs are required before claiming experimental success, and the agent stops and asks the user for input whenever a task looks ambiguous or unsafe.

Retrieval itself follows a pipeline: a query is expanded, then searched with both keyword and vector retrieval, after which candidates are merged, reranked, and turned into extracted evidence. That evidence is deduplicated, scored, and finally mapped to specific claims. Each evidence record keeps track of the source ID, document title, authors, publication metadata, a URL or identifier, the passage text, its chunk location, retrieval and reranker scores, and a timestamp. It's worth emphasizing that retrieval only establishes relevance — verification is what establishes whether a piece of evidence actually supports a claim.

## Repository Layout

The repository is split into a small number of top-level areas. An `apps` directory holds the Next.js web client and the FastAPI backend as separate applications. A `services` directory holds the agent orchestrator, the retrieval service, the verification service, the evaluation service, and the sandboxed executor, each as an independent module. A `packages` directory holds shared schemas and versioned prompt templates used across services. Separately, `experiments` and `benchmarks` hold experiment configurations and benchmark cases and results, `docs` holds architecture and design documentation, `infra` holds Docker and deployment configuration, and `scripts` holds development utilities.

## Getting Started

You'll need Python 3.11 or later, Node.js 18 or later, PostgreSQL 15 or later with the pgvector extension enabled, and Docker for sandboxed experiment execution.

To set up the backend, clone the repository, move into the API app directory, create and activate a virtual environment, install the requirements, and start the server with `uvicorn main:app --reload`. To set up the frontend, move into the web app directory, run `npm install`, and start it with `npm run dev`. For local development, PostgreSQL and the other supporting services are easiest to run through Docker Compose, for example with `docker compose up -d postgres`.

The recommended build order is deliberately incremental: start with a deterministic, non-agent version of the system, then add retrieval, then evidence handling, then verification, then agent orchestration, and only at the end add autonomous experiment execution. This keeps debugging manageable and creates clear milestones along the way.

A reasonable first two weeks looks like this: create the GitHub repository and issue board, write a one-page problem statement, freeze the first research question, sketch the architecture diagram, set up Next.js, FastAPI, and PostgreSQL, implement task creation and run status, write the database migrations, add a mock agent that emits deterministic steps just to get the plumbing working, build the run timeline UI, and only then connect a real LLM.

## Data Model

The core entities are users, research tasks, and runs — a run being one execution of a task. Each run produces a sequence of agent steps, which together form the agent's trajectory through the pipeline. Documents represent research sources, and each document is broken into chunks that carry an embedding and are the actual unit of retrievable evidence. Claims are the statements the system makes during a run, and a separate claim-evidence mapping records which chunks support which claims, along with a support score — this mapping is the heart of the provenance model. Experiments capture a hypothesis and configuration, while experiment runs capture a concrete execution of that experiment, including its seed and status; metrics attached to an experiment run hold the actual measured results. Artifacts record code, logs, reports, and charts produced along the way, each with a path and hash. Finally, benchmarks and benchmark cases define the reusable evaluation suite: a benchmark is a named, versioned collection of individual cases, each with its own question and reference answer.

## API Overview

The API exposes endpoints to create and read research tasks, start a run against a task, and read a run's status. Separate endpoints expose the full agent trace for a run and the evidence gathered during it, and there's an approval endpoint for any gated action that requires explicit user sign-off before proceeding. Experiments tied to a run can be listed and then executed once approved, and a run's final report can be fetched once it's ready. There's also an endpoint to kick off a full benchmark run.

A typical run status response looks like this:

```json
{
  "run_id": "run_123",
  "status": "EVALUATING",
  "current_step": "evaluate",
  "progress": 0.78,
  "cost": { "tokens": 18240 },
  "evidence_count": 24
}
```

## Evaluation and Benchmark

Evaluation centers on a handful of metrics: answer accuracy against reference criteria, citation precision (the fraction of cited sources that actually support the associated claim), citation recall (the fraction of required supporting evidence that was successfully cited), and the unsupported-claim rate. Alongside those, the system tracks experiment success (the percentage of planned experiments that execute successfully), result validity (whether the stated conclusion is consistent with the computed metrics), and reproducibility (whether a rerun with the same configuration reproduces the result within tolerance). Latency and cost are tracked per task, and a blind human rating using a fixed rubric rounds out the picture. The goal is to avoid evaluating the system with a vague "it looks good" — metrics need to be defined before experiments are run, not after.

The benchmark itself should start small and high-quality rather than large and noisy — something like 30 to 50 cases during development, expanding to 100 or more for the final study if time allows. Each case includes a research question, a difficulty level, relevant reference documents and evidence passages, the expected claims or evaluation criteria, an experiment requirement where applicable, expected metrics, optionally some distractor or contradictory evidence, and ground-truth reviewer notes. Categories of benchmark cases include literature QA (answering a technical question from selected papers), evidence linking (selecting passages that support a claim), contradiction detection (noticing when sources disagree), hypothesis generation, experiment planning, code experiments that must actually run, and conclusion validity (deciding whether results support a hypothesis).

## Research Methodology

The study follows an empirical comparative design: ResearchPilot is the treatment, and three progressively simpler systems act as baselines. Baseline A is a standard LLM given the research question directly, with no retrieval or verification. Baseline B is basic RAG — retrieved documents are handed to the model, but there's no verification loop. Baseline C is agentic RAG, which adds planning and iterative retrieval but still omits claim-level evidence verification and experiment feedback. ResearchPilot itself adds hybrid retrieval, evidence verification, experiment provenance, and evaluation feedback on top of planning. To keep the comparison fair, the benchmark cases, evaluation rubric, and major model constraints stay consistent across all four systems.

Beyond the main comparison, a set of ablations is recommended: removing claim-level verification, replacing hybrid retrieval with vector-only retrieval, removing reranking, removing the experiment feedback loop, reducing the amount of evidence used, changing the model configuration or verification threshold, and comparing a single-pass workflow against an iterative one. Results should be analyzed for both quality and cost — a method that improves accuracy slightly while multiplying cost by twenty times may not be a practical improvement. Importantly, the results shouldn't be decided in advance; the research claim needs to stay falsifiable, so the experiments should be designed so the system could plausibly improve, stay the same, or perform worse.

## Development Roadmap

The project is designed to unfold in eight phases plus an initial setup phase. Phase zero, lasting one to two weeks, covers the problem definition, repository setup, architecture, and initial literature review. Phase one, about two weeks, builds the full-stack skeleton: Next.js, FastAPI, PostgreSQL, and basic authentication and task CRUD. Phase two, two to three weeks, adds document ingestion, chunking, embeddings, and hybrid retrieval. Phase three, about two weeks, builds out the evidence layer — claims, evidence mapping, a citation viewer, and the verifier. Phase four, about three weeks, adds agent orchestration: the planner, the state graph, tools, retries, and the trace. Phase five, three to four weeks, builds the experiment lab, including the sandbox, code generation, execution, and metrics. Phase six, two to three weeks, builds out evaluation — baselines, the benchmark, metrics, and dashboards. Phase seven, three to five weeks, is the main research study: primary runs, ablations, and analysis. Phase eight, three to four weeks, wraps up the paper, demo, documentation, and deployment. Altogether, this is roughly six to nine months part-time, or three to five months full-time.

## Testing

Testing spans several layers. Unit tests cover things like evidence score calculation, parsers, and API validation. Integration tests check that the retriever, reranker, and evidence store work correctly together. Agent-level tests check state transitions, retries, and stopping conditions. Security tests specifically probe for sandbox escape attempts and secret exposure. Regression tests make sure the same benchmark case doesn't unexpectedly get worse over time. UI tests cover task creation, the run timeline, and evidence navigation. Experiment tests check metric calculations against known values, and reproducibility tests confirm that the same seed and configuration produce equivalent outputs within tolerance.

## Security and Sandbox

Generated code should always be treated as untrusted. The experiment executor is kept isolated from the application server and the production database. Experiments run inside an isolated container with CPU, memory, and execution-time limits, mounting only the dataset and working directory they actually need. Application secrets and production credentials are never exposed to that environment, unnecessary network access is disabled, and datasets are mounted read-only wherever possible. Package versions and environment information are recorded for every run, each experiment gets a unique ID and a random seed, and stdout, stderr, the exit code, and any output artifacts are all persisted. At minimum, an experiment's manifest should record its experiment ID, code version, dataset version, model version, parameters, random seed, environment, metrics, start and end time, and artifact hashes.

## Observability and Reproducibility

Every run stores a full trace, which is essential both for debugging and for later writing up the results. A trace entry typically records the run and step IDs, the model used, the prompt version, an input hash, which tool was called and with what arguments, which documents were retrieved, the structured output of the step, its latency and token usage, and its final status. More broadly, anything that can change a result should be versioned: prompts, the model identifier, dataset version, retrieval parameters, reranker configuration, the code commit, package versions, the random seed, and the evaluation script version.

## Deployment

In development, the whole stack runs locally through Docker Compose — the web app, the API, PostgreSQL, a background worker, vector storage, and a local artifact directory all running together on one machine. In a production-style setup, requests come in through a reverse proxy to the web and API layer, long-running work is handed off to a job queue and picked up by an agent worker, which calls out to retrieval and LLM tools and to a separate sandbox worker for experiment execution, with PostgreSQL, the vector store, and object storage backing all of it. The API is designed to create a job and return a run ID immediately rather than holding an HTTP connection open for the duration of a long research task.

## Research Paper

The working title for the resulting paper is "ResearchPilot: An Evidence-Verified Agentic Framework for Reproducible AI-Assisted Research." The abstract should cover the problem, method, benchmark, and main result. The introduction should motivate why AI research assistance needs verification and reproducibility, and the related work section should cover RAG, agentic systems, other AI research agents, evaluation methodology, and provenance. A problem definition section should formalize what's meant by unsupported claims, evidence quality, and reproducibility. The method section explains the architecture and the Evidence-Verified Research Loop itself, while a separate system section gives enough implementation detail for someone else to reproduce the work. The benchmark section covers how tasks were constructed, along with the datasets, reference evidence, and rubric used. The experiments section lays out the baselines, configurations, metrics, and statistical protocol, and the results section presents the main comparison and the ablations. An error analysis section should walk through failure categories with concrete examples, and a limitations section should be honest about scope, model dependence, retrieval limitations, and cost. The paper closes with a conclusion summarizing findings and pointing toward future research.

## Risks and Limitations

A number of risks are worth planning for from the start. Hallucinated citations are mitigated by claim-level evidence verification and citation checks. Poor-quality retrieved evidence is mitigated by hybrid retrieval, reranking, and source-quality rules. Invalid experiments are caught by the sandbox itself, automated metric validation, and human review. Infinite agent loops are prevented with step, call, and time budgets plus explicit termination conditions. Because retrieved documents may contain prompt injection attempts, all retrieved text is treated as untrusted input rather than trusted instructions. Data leakage is prevented by keeping secrets out of prompts and enforcing access controls. Biased evaluation is mitigated by using a fixed benchmark, blind human rating, and multiple metrics rather than a single score. Overclaiming research novelty is guarded against through a thorough literature review and careful, precise wording. And reproducibility failures are mitigated by versioning datasets, prompts, code, environment, and seeds together.

On the ethical side, the system should always clearly label AI-generated hypotheses, code, and conclusions as assistance rather than fact. It should never present generated research claims as independently verified scientific findings unless the verification process actually supports them.

## Contributing

To contribute, fork the repository and create a feature branch — typically `feature/<name>` for new functionality or `experiment/<name>` for research experiments. Commits follow a simple prefix convention: `feat:` for new functionality, `fix:` for bug fixes, `exp:` for experiment-related changes such as comparing reranker configurations, and `docs:` for documentation updates. Pull requests should target the `develop` branch, with `main` reserved for stable, released code and `paper/*` branches used for paper artifacts and analysis.

## License

Add your chosen license here (for example, MIT or Apache 2.0).

## Status

This project is under active development. See the Development Roadmap above for current progress against the planned phases.