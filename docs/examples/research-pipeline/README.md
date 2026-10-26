# Research Pipeline Artifact Example

This directory contains a curated, tracked example of the output produced by
ResearchPilot's experiment sandbox during a real pipeline run. It exists so
that the research pipeline's artifact format can be inspected without
executing the system, while the runtime directory `Backend/artifacts/` itself
stays excluded from Git.

## Provenance

- **Source run:** `run_ad043f95` — a full autonomous 11-step pipeline execution
  (PLAN → RETRIEVE → EXTRACT_EVIDENCE → VERIFY → DESIGN_EXPERIMENT →
  GENERATE_CODE → EXECUTE → EVALUATE → REVIEW → REPORT → COMPLETE)
- **Research task:** "Can claim-to-source provenance reduce unsupported claims
  in scientific research?" (domain: Artificial Intelligence)
- **Experiment:** `exp_097dd5d9`, baseline `Standard Unverified LLM` vs
  proposed `ResearchPilot Evidence-Verified Loop`
- **Date of generation:** 2026-10-26

## Contents

| File | Description |
|---|---|
| `experiment.py` | The sandbox-generated Python experiment script (originally `experiment_exp_097dd5d9.py`) |
| `experiment_manifest.json` | Full provenance manifest: code/dataset/model versions, parameters, random seed, environment, metrics, timings, SHA-256 artifact hashes, exit code |
| `metrics.json` | Structured metric results with baseline comparisons and delta percentages |
| `experiment_results.png` | Comparison chart rendered by the sandboxed experiment |

## Recreating these artifacts

Every artifact here is deterministically reproducible. The sandbox template
(`Backend/app/services/sandbox.py`) generates the experiment with a fixed
random seed (`42`), so rerunning the pipeline with the same inputs produces
byte-identical outputs (verified: regenerated script sha256
`7c422675259e...` matches both the stored file and the manifest's declared
`artifact_hashes.code`). To regenerate on a fresh setup:

```bash
cd Backend
pip install -r requirements.txt
uvicorn app.main:app --reload          # starts backend and initializes DB
# create a task and start a run via the UI or the API, e.g.:
#   POST /api/tasks   {"question": "Can claim-to-source provenance reduce unsupported claims in scientific research?"}
#   POST /api/tasks/<task_id>/runs
# then inspect the new Backend/artifacts/<run_id>/ directory
```

Integrity of any regenerated artifact can be verified by comparing its
SHA-256 hash against `artifact_hashes` inside `experiment_manifest.json`.
