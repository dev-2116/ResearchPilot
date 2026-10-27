# Labelled Query–Relevance Dataset

This directory holds the human-labelled query–passage examples used to
calibrate the retrieval relevance threshold
(`RESEARCHPILOT_MIN_RERANKER_SCORE`). Thresholds are only as good as the
labels underneath them — read the labelling instructions before adding rows.

## Files

| File | Purpose | Committed? |
|---|---|---|
| `query_relevance_labels.template.jsonl` | Copy-paste starting template with 2 example rows | yes |
| `query_relevance_labels.sample.jsonl` | Small demonstration set for the preloaded corpus (~35 rows) | yes |
| `query_relevance_labels.jsonl` | **Your** working label file (create it from the template) | no — create locally |

> **Provenance warning.** Everything currently in this directory is a
> developer-authored **demonstration** dataset (`source: developer_draft_demo`).
> The rows are hand-written for the 6-paper demo corpus so the calibration
> workflow can be run end-to-end. They are **NOT** inter-annotator-verified
> ground truth and must not be cited as human evaluation results. Collect real
> labels per the instructions below before trusting a calibrated threshold.

## Format

One JSON object per line (`.jsonl`) or a header row plus rows (`.csv`).

```json
{"query": "...", "doc_id": "doc_rag_001", "chunk_id": "chunk_rag_001_1",
 "passage_text": "exact passage text that was judged", "relevance_label": 2,
 "source": "annotator_alice_2026_10", "notes": "optional context"}
```

| Field | Required | Description |
|---|---|---|
| `query` | yes | The user query exactly as submitted |
| `doc_id` | yes | Stable paper/document identifier (matches `doc_id` in retrieval results) |
| `chunk_id` | recommended | Stable chunk identifier — preferred join key for evaluation |
| `passage_text` | yes | The EXACT passage text that was judged (calibration scores this text) |
| `relevance_label` | yes | `0`, `1`, or `2` — see scheme below |
| `source` | yes | Who/what produced the label, e.g. `annotator_alice_2026_10`. Anything containing `demo`/`synthetic` is flagged as non-authoritative in calibration reports |
| `notes` | no | Free-form context (ambiguity, dissent between annotators, etc.) |

## Label scheme

| Label | Meaning | Guidance |
|---|---|---|
| `0` | Irrelevant | Passage does not help answer the query at all |
| `1` | Partially relevant | Same topic but does not directly answer the question; useful background only |
| `2` | Relevant | A user asking this query would want this passage in the results |

### Binary mapping for threshold calibration

By default **only label `2` counts as relevant** (`label >= relevance_cutoff`
with `relevance_cutoff=2`); partially relevant (`1`) is treated as
non-relevant. This is deliberately strict: returning an irrelevant paper costs
more than missing a partially useful one. Pass `--relevance-cutoff 1` to
`scripts/calibrate_threshold.py` if you want partial relevance to count.

## How to collect labels (recommended protocol)

1. **Sample queries** from real usage (API logs, dashboard searches), covering
   keyword-style queries, natural-language questions, acronym-heavy queries,
   and some clearly out-of-domain queries.
2. **Pool passages** for each query from the retrieval pipeline (top ~20
   candidates after fusion), so labels cover both what the system gets right
   and what it misses. Judge passages WITHOUT seeing their scores to avoid
   anchoring.
3. **At least 2 annotators** per pair; keep `notes` when they disagree and
   resolve by discussion, not averaging. Record the annotator in `source`.
4. **Include negatives**: each query should have judged irrelevant passages
   too, and the full set must contain both classes (a single-class dataset
   cannot produce a reliable threshold — the calibration report will say so).
5. Split into `query_relevance_labels.jsonl` (calibration) and, when you have
   enough labelled examples (rule of thumb: ≥ 100 pairs), a separate
   `query_relevance_labels_validation.jsonl` (validation).

## Using the labels

```bash
cd Backend
# Calibrate (threshold selected on --labels, evaluated out-of-fold or on --validation):
python scripts/calibrate_threshold.py \
    --labels eval/labels/query_relevance_labels.jsonl \
    [--validation eval/labels/query_relevance_labels_validation.jsonl] \
    --output data/calibration/threshold_report.json

# Compare retrieval configurations on the same labelled queries:
python scripts/evaluate_retrieval.py --labels eval/labels/query_relevance_labels.jsonl \
    [--calibration-report data/calibration/threshold_report.json]
```

Then set `RESEARCHPILOT_MIN_RERANKER_SCORE=<reported threshold>` in
`Backend/.env`. Re-run calibration whenever the reranker model or the corpus
changes materially. See `docs/retrieval_reranking.md` for the full workflow.
