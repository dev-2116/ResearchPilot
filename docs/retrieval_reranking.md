# Retrieval Reranking & Relevance Threshold Calibration

This document describes the upgraded retrieval pipeline in
`Backend/app/services/retrieval.py`, the cross-encoder reranker, and the
reproducible workflow that calibrates the relevance threshold
(`RESEARCHPILOT_MIN_RERANKER_SCORE`) from human-labelled query–passage
examples.

## 1. Pipeline overview

```
User Query
   │
   ├──────────────┬──────────────────────────────┐
   ▼              ▼                              │
BM25 keyword   Dense embedding                Query expansion
ranking        ranking (all-MiniLM-L6-v2)     (feeds BM25 terms)
   │              │
   └──────┬───────┘
          ▼
Reciprocal Rank Fusion (RRF, k=60, weighted by hybrid_weight)
          ▼
Candidate selection  ← RESEARCHPILOT_RERANKER_CANDIDATES (default 25)
per-paper diversity cap  ← RESEARCHPILOT_RERANKER_MAX_PER_PAPER (default 2)
          ▼
Cross-encoder reranking  ← cross-encoder/ms-marco-MiniLM-L-6-v2
(candidates ONLY — the full corpus is never reranked)
          ▼
Sort by raw reranker score (descending)
          ▼
Calibrated relevance threshold  ← RESEARCHPILOT_MIN_RERANKER_SCORE
(optional: unset means no filtering)
          ▼
top_k results
```

The pre-upgrade stages are preserved: BM25 scoring is unchanged, the dense
stage still produces a full ranking, and fusion still combines both rankings
(it is now a true RRF instead of a linear score blend, matching what the
README always documented). What changed downstream: reranking is now a real
cross-encoder instead of a heuristic that mixed the fused score with a
publication-year bonus (the year bonus was removed — it is not a relevance
signal).

### Purpose of each component

| Component | Purpose |
|---|---|
| **BM25** | Exact lexical matching: rare terms, acronyms, identifiers, model names. |
| **Dense embeddings** | Semantic matching: paraphrases and concept overlap that share no keywords. |
| **RRF fusion** | Merges the two rankings by rank (robust to incomparable score scales); documents found by both signals surface on top. |
| **Cross-encoder** | Reads query and passage **together** (full attention across the pair), so it scores true query–passage relevance far more accurately than independent embeddings; applied only to the fused candidate set for cost control. |
| **Threshold** | Suppresses results the reranker considers irrelevant (e.g. out-of-domain queries), configured from labelled data instead of an invented constant. |

### Result fields

Every result keeps all legacy fields (`chunk_id`, `doc_id`, `title`,
`authors`, `identifier`, `publication_year`, `venue`, `passage_text`,
`chunk_index`, `retrieval_score`, `reranker_score`, `timestamp`) and adds:

| Field | Meaning |
|---|---|
| `retrieval_score` | Fused RRF score (float). Previously the linear blend; now genuinely rank-fused. |
| `reranker_score` | **Raw cross-encoder score (logit)** — the canonical score used for sorting and threshold filtering. `None` when reranking is unavailable (never fabricated). |
| `reranker_probability` | `sigmoid(reranker_score)`. **Display-only transformed model score — NOT a calibrated relevance probability.** Applying a sigmoid does not calibrate a model. |
| `reranked` | `True` only when the cross-encoder actually scored the candidates. |
| `reranker_model` | Model name when reranked, else `None`. |
| `reranker_error` | Present **only** when a reranking attempt failed; results then fall back to RRF ordering, flagged with `reranked: False`. |
| `bm25_rank`, `dense_rank`, `rrf_rank` | Provenance of each candidate in the pipeline. |
| `embedding_backend` | `minilm` or `lexical_fallback`. |

## 2. Models, dependencies, and resources

| Model | Role | Size | Notes |
|---|---|---|---|
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | Reranking (default; `RESEARCHPILOT_RERANKER_MODEL`) | ~80 MB | Trained on MS MARCO passage ranking. |
| `sentence-transformers/all-MiniLM-L6-v2` | Dense embeddings (default; `RESEARCHPILOT_EMBEDDING_MODEL`) | ~90 MB | L2-normalized; cosine similarity. |

- Both load **lazily on first use** — importing the backend or running the
  test suite that does not touch them never triggers a download. Models are
  cached in-process (one load per model name) and on disk in the HuggingFace
  cache (`~/.cache/huggingface`).
- Dependency: `sentence-transformers` (appended to `Backend/requirements.txt`;
  it installs PyTorch — CPU wheels are sufficient:
  `pip install torch --index-url https://download.pytorch.org/whl/cpu`).
- Hardware: CPU inference is adequate. Measured on a small corpus: ~10 ms/query
  for embeddings + fusion, ~150 ms/query for reranking ~13 candidates on CPU.
  Memory: ~500 MB extra for both models. GPU is optional.
- Offline behavior: if the embedding model is unavailable, the dense stage
  falls back to the original lexical-overlap scorer (`embedding_backend:
  "lexical_fallback"`). If the reranker is unavailable, results are returned
  RRF-ordered with `reranked: false` and an explicit `reranker_error` — scores
  are never fabricated.

## 3. Configuration

All variables are read by `Backend/app/core/config.py`; see
`Backend/.env.example` for annotated defaults.

| Variable | Default | Effect |
|---|---|---|
| `RESEARCHPILOT_RERANKER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Reranker model. |
| `RESEARCHPILOT_RERANKER_ENABLED` | `true` | Master switch; `false` ranks by RRF only. |
| `RESEARCHPILOT_RERANKER_CANDIDATES` | `25` | Max candidates forwarded to the reranker. |
| `RESEARCHPILOT_RERANKER_MAX_PER_PAPER` | `2` | Max chunks per paper in candidates and results. |
| `RESEARCHPILOT_RERANKER_BATCH_SIZE` | `16` | Cross-encoder inference batch size. |
| `RESEARCHPILOT_MIN_RERANKER_SCORE` | *(unset)* | Minimum raw reranker score to return a result. **No default is invented**: unset = no filtering. |
| `RESEARCHPILOT_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Dense-stage embedding model. |

Threshold semantics:

- The threshold compares against **raw logits** — exactly the representation
  used during calibration. It is applied only to genuinely reranked results;
  degraded (RRF-ordered) results are never filtered against a reranker
  threshold because RRF scores are not comparable to model logits.
- Threshold filtering happens **before** the `top_k` slice, so `top_k` counts
  only threshold-passing results.
- Per-call override: `search(..., min_score=...)` (also `rerank=`,
  `rerank_candidates=`, `max_per_paper=`) — all keyword-only, so existing
  callers are unaffected.

## 4. Labelled dataset

See **`Backend/eval/labels/README.md`** for the full format specification,
label scheme, and collection protocol. Summary:

- Format: JSONL (or CSV) with `query`, `doc_id`, `chunk_id`,
  `passage_text` (exact judged text), `relevance_label`, `source`.
- Label scheme: `0` Irrelevant, `1` Partially relevant, `2` Relevant.
- Binary mapping for calibration: **label ≥ 2 counts as relevant** (strict;
  partial relevance is not enough). Override with `--relevance-cutoff`.
- `query_relevance_labels.sample.jsonl` (39 pairs, 11 queries, all 13 corpus
  chunks) is a **developer-authored demonstration set**
  (`source: developer_draft_demo`) — NOT human-verified ground truth. The
  calibration report flags demo provenance automatically.
- Template: `query_relevance_labels.template.jsonl`. Create your working
  `query_relevance_labels.jsonl` from it.

## 5. Threshold calibration workflow

One command, from `Backend/`:

```bash
# With a separate validation split (recommended when you have enough labels):
python scripts/calibrate_threshold.py \
    --labels eval/labels/query_relevance_labels.jsonl \
    --validation eval/labels/query_relevance_labels_validation.jsonl \
    --output data/calibration/threshold_report.json

# Without a validation split: leave-one-query-out cross-validation is used.
python scripts/calibrate_threshold.py \
    --labels eval/labels/query_relevance_labels.jsonl \
    --output data/calibration/threshold_report.json
```

What it does (all in `Backend/app/services/calibration.py`):

1. **Loads and validates** the labelled examples (strict schema; labels must
   be 0/1/2; row-level error messages).
2. **Scores every pair with the production cross-encoder** (same class, same
   model, same raw-score representation as production filtering).
3. **Sweeps candidate thresholds** (the unique observed scores) and computes
   TP, FP, TN, FN, precision, recall, F1, accuracy for each.
4. **Selects the threshold** by the documented objective (`--objective f1`
   default; `precision`, `recall`, `fbeta` supported). Ties are broken
   deterministically to the **highest** threshold (precision-leaning) and all
   tied candidates are reported. Objectives are computed from exact
   confusion-matrix counts, not rounded display values.
5. **Handles degenerate cases**: a dataset with only one relevance class is
   flagged `reliable: false` with an explanation; tiny datasets add an
   explicit small-sample limitation; demo provenance is flagged.
6. **Validates** either on a separate validation file (never used for
   selection) or via **leave-one-query-out CV** — folds grouped by query so
   the same query never appears on both sides.
7. **Writes a JSON report** containing the selected threshold, the full
   candidate-threshold table, per-fold CV results, label provenance, and
   copy-paste instructions for `.env`.

The report is a **classification-threshold selection**, not a probability
calibration. If you need actual P(relevant) values, calibrate the model's
outputs separately (e.g. Platt scaling / isotonic regression on held-out
labels) — do not treat the sigmoid-transformed score as a probability.

### Applying and updating the threshold

```bash
# Backend/.env
RESEARCHPILOT_MIN_RERANKER_SCORE=-6.2959   # example: value from the report
```

Re-run calibration whenever:

- the reranker model changes (scores are model-specific — a threshold from a
  different model is meaningless),
- the corpus changes materially (new domains shift the score distribution),
- you collect substantially more/better labels.

The startup configuration report prints whether a threshold is set (never any
secret values).

## 6. Running the backend and tests

```bash
cd Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # or: pip install torch --index-url https://download.pytorch.org/whl/cpu first
uvicorn app.main:app --reload            # API on http://127.0.0.1:8000

python -m pytest tests -v                # full suite (no model download required
                                         # for unit tests; integration tests skip
                                         # gracefully when models are unavailable)
```

## 7. Evaluation results

Configuration: preloaded 6-paper corpus (13 chunks), fixed labelled set
`eval/labels/query_relevance_labels.sample.jsonl` (39 pairs, 11 queries),
relevance cutoff 2, `scripts/evaluate_retrieval.py`, models warm before
timing. `legacy` is an evaluation-only reference copy of the pre-upgrade
scoring formula.

**Threshold selection (pooled calibration on all 39 pairs):**
threshold = **-6.2959** (raw logit), F1 = **0.9032**, P = 0.8235, R = 1.00
(TP=14, FP=3, TN=22, FN=0). Leave-one-query-out CV (11 folds): threshold mean
-5.71, stdev 1.84 — the selection direction is stable but the exact value
varies with the fold, as expected at this sample size. Separate-split run
(29 calibration / 10 validation rows, query-grouped): validation P = 1.0,
R = 1.0 at the calibrated threshold.

**Retrieval comparison** (mean over the 11 labelled queries):

| config | P@10 | R@20 (pool) | nDCG@10 | ms/query | dupRate@10 | noRel@10 |
|---|---|---|---|---|---|---|
| legacy (pre-upgrade formula) | 0.118 | 0.950 | 0.800 | 0.3 | 0.473 | 1 |
| rrf_only (no reranker) | 0.118 | 0.950 | 0.827 | 11.0 | 0.446 | 1 |
| reranked (no threshold) | 0.118 | 0.950 | 0.836 | 142.3 | 0.400 | 1 |
| reranked + threshold −6.2959 | **0.706** | 0.950 | 0.755 | 154.2 | **0.124** | **0** |

Reading of the numbers (and what they do NOT say):

- **Precision@10 0.118 → 0.706** and duplicate rate 0.473 → 0.124 with the
  threshold: irrelevant and partially-relevant results are suppressed. The
  out-of-domain control query ("best restaurants in Paris") now returns zero
  results instead of ten irrelevant ones.
- **nDCG@10 slightly decreases with the threshold** (0.836 → 0.755): filtering
  trades graded-ranking richness for precision. Without a threshold, reranking
  improves nDCG (0.800 → 0.836). Choose based on your cost asymmetry.
- P@10 is identical for `legacy`/`rrf_only`/`reranked` without threshold
  because top-10 covers most of the 13-chunk corpus; ranking quality shows up
  in nDCG instead. P@10 becomes discriminative with larger corpora.
- Recall@20 is **restricted to the judged pool** (unlabelled passages count as
  non-relevant) — a property of the tiny demo corpus, not of the system.
- Latency is CPU-only on this machine; reranking costs ~140 ms for 13
  candidates and scales with `RESEARCHPILOT_RERANKER_CANDIDATES`.
- **These results are measured on the demonstration labels** (developer-draft,
  not inter-annotator verified). They demonstrate the workflow; they are not a
  human evaluation claim. With the current sample size the measurements cannot
  support a claim that the upgrade improves retrieval quality in general.

## 8. Known limitations

- The demonstration label set is small (39 pairs) and developer-authored;
  recalibrate with properly collected labels before trusting any threshold.
- No probability calibration is performed; `reranker_probability` is a
  display transform only.
- Cross-encoder inference is CPU-bound; for high-throughput deployments
  consider a GPU, a smaller candidate set, or a distilled model.
- `datetime.utcnow()` deprecation warnings in Python 3.12 come from untouched
  pre-existing code paths.
- If the embedding model cannot load, dense ranking degrades to lexical
  overlap (functional but weaker); reranking still works and the degradation
  is visible in `embedding_backend`.
