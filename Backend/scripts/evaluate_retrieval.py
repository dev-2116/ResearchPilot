#!/usr/bin/env python3
"""CLI: evaluate retrieval configurations on a fixed labelled query set.

Compares, on the SAME corpus and the SAME labelled queries:

  legacy    - reference copy of the PRE-UPGRADE scoring formula (BM25 +
              lexical-overlap blend + publication-year bonus). Lives ONLY in
              this evaluation script and is never used in production; it
              exists so the upgrade can be measured against the original
              behavior.
  rrf_only  - upgraded pipeline with reranking disabled (BM25 + dense + RRF).
  reranked  - upgraded pipeline with cross-encoder reranking (production
              default, optional calibrated threshold applied).

Reported metrics (per configuration):
  - Precision@10          (binary relevance: label >= --relevance-cutoff)
  - Recall@20             (recall WITHIN the judged pool - see limitations)
  - nDCG@10               (graded gains 2^label - 1, unjudged items count 0)
  - Latency per query     (ms; models are warmed up before timing)
  - Duplicate-paper rate  (top-10 positions sharing an already-seen doc_id)
  - Queries with no relevant result in the top 10
  - Threshold P/R/F1      (for the configured/calibrated threshold)

All numbers are measured, never asserted. See --output JSON for details.
"""

import argparse
import json
import math
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.calibration import (  # noqa: E402
    evaluate_threshold,
    load_labelled_examples,
    score_labelled_examples,
)
from app.services.retrieval import HybridRetriever, tokenize  # noqa: E402


# ── Legacy scorer (evaluation-only reference of the pre-upgrade formula) ──


def _legacy_search(retriever: HybridRetriever, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
    """Replicates the pre-upgrade `search()` scoring exactly:

        combined = (1 - w) * bm25/(bm25+5) + w * lexical_dense
        reranker_score = min(0.99, combined * 0.95 + 0.05 if year >= 2021)

    EVALUATION ONLY - this formula is intentionally kept out of production.
    """
    hybrid_weight = 0.5
    expanded = retriever._expand_query(query)
    tokens: List[str] = []
    for eq in expanded:
        tokens.extend(tokenize(eq))
    tokens = list(set(tokens))

    scored = []
    for chunk in retriever.chunks_index:
        bm25 = retriever._bm25_score(tokens, chunk)
        q_toks = set(tokenize(query))
        c_toks = set(tokenize(chunk["text"]))
        jaccard = (len(q_toks & c_toks) / len(q_toks | c_toks)) if (q_toks and c_toks) else 0.0
        domain = ["hallucination", "rag", "verification", "claim", "provenance",
                  "experiment", "reproducibility", "baseline", "metric", "agent",
                  "benchmark", "evidence"]
        bonus = sum(0.15 for kw in domain if kw in q_toks and kw in c_toks)
        dense = min(1.0, jaccard * 1.8 + bonus)
        combined = (1 - hybrid_weight) * (bm25 / max(1.0, bm25 + 5.0)) + hybrid_weight * dense
        reranker = min(0.99, combined * 0.95 + (0.05 if chunk["publication_year"] >= 2021 else 0.0))
        scored.append({"chunk_id": chunk["chunk_id"], "doc_id": chunk["doc_id"],
                       "retrieval_score": combined, "reranker_score": reranker})
    scored.sort(key=lambda x: x["reranker_score"], reverse=True)
    return scored[:top_k]


# ── Metric helpers ───────────────────────────────────────────────────────


def _label_index(labels) -> Dict[str, Dict[str, Dict[str, Any]]]:
    """query -> chunk_id (or doc_id fallback) -> record."""
    idx: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)
    for ex in labels:
        key = ex.chunk_id if ex.chunk_id else f"doc:{ex.doc_id}"
        idx[ex.query][key] = {
            "relevance_label": ex.relevance_label,
            "doc_id": ex.doc_id,
            "chunk_id": ex.chunk_id,
        }
    return idx


def _grade(item: Dict[str, Any], q_idx: Dict[str, Dict[str, Any]]) -> int:
    key = item.get("chunk_id") or f"doc:{item.get('doc_id')}"
    rec = q_idx.get(key) or q_idx.get(f"doc:{item.get('doc_id')}")
    return rec["relevance_label"] if rec else 0


def _binary_relevant(item: Dict[str, Any], q_idx: Dict[str, Dict[str, Any]], cutoff: int) -> bool:
    return _grade(item, q_idx) >= cutoff


def evaluate_configuration(
    name: str,
    ranked_by_query: Dict[str, List[Dict[str, Any]]],
    q_idx: Dict[str, Dict[str, Dict[str, Any]]],
    relevance_cutoff: int,
    latencies_ms: List[float],
) -> Dict[str, Any]:
    p_at_10_vals, ndcg_vals, dup_rates = [], [], []
    recall_vals, queries_no_relevant_top10 = [], 0

    for query, ranked in ranked_by_query.items():
        q_labels = q_idx.get(query, {})
        pool_relevant = sum(1 for rec in q_labels.values() if rec["relevance_label"] >= relevance_cutoff)

        top10 = ranked[:10]
        top20 = ranked[:20]

        # Precision@10
        if top10:
            rel10 = sum(1 for it in top10 if _binary_relevant(it, q_labels, relevance_cutoff))
            p_at_10_vals.append(rel10 / len(top10))
            if rel10 == 0:
                queries_no_relevant_top10 += 1

        # Recall@20 (pool-restricted)
        if pool_relevant > 0:
            rel20 = sum(1 for it in top20 if _binary_relevant(it, q_labels, relevance_cutoff))
            recall_vals.append(rel20 / pool_relevant)

        # nDCG@10 (graded)
        dcg = sum((2 ** _grade(it, q_labels) - 1) / math.log2(i + 2) for i, it in enumerate(top10))
        ideal = sorted((rec["relevance_label"] for rec in q_labels.values()), reverse=True)[:10]
        idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
        ndcg_vals.append(dcg / idcg if idcg > 0 else 0.0)

        # Duplicate-paper rate in top 10
        seen_docs, dups = set(), 0
        for it in top10:
            if it["doc_id"] in seen_docs:
                dups += 1
            seen_docs.add(it["doc_id"])
        dup_rates.append(dups / len(top10) if top10 else 0.0)

    n = len(ranked_by_query)
    return {
        "configuration": name,
        "n_queries": n,
        "precision_at_10": round(sum(p_at_10_vals) / n, 4) if n else None,
        "recall_at_20_pool_restricted": round(sum(recall_vals) / len(recall_vals), 4) if recall_vals else None,
        "ndcg_at_10": round(sum(ndcg_vals) / n, 4) if n else None,
        "latency_ms_mean": round(sum(latencies_ms) / len(latencies_ms), 2) if latencies_ms else None,
        "latency_ms_median": round(sorted(latencies_ms)[len(latencies_ms) // 2], 2) if latencies_ms else None,
        "duplicate_paper_rate_top10": round(sum(dup_rates) / n, 4) if n else None,
        "queries_no_relevant_in_top10": queries_no_relevant_top10,
    }


# ── Main ─────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--labels", required=True, help="Labelled JSONL/CSV evaluation queries")
    parser.add_argument("--corpus", default=None, help="Optional papers JSON file (defaults to preloaded corpus)")
    parser.add_argument("--calibration-report", default=None,
                        help="Calibration report JSON to read the threshold from")
    parser.add_argument("--min-score", type=float, default=None, help="Threshold override (raw logit)")
    parser.add_argument("--relevance-cutoff", type=int, default=2)
    parser.add_argument("--top-k", type=int, default=10, help="Results fetched per query (default 10)")
    parser.add_argument("--output", default=None, help="Write the evaluation JSON here")
    args = parser.parse_args()

    labels = load_labelled_examples(args.labels)
    if args.corpus:
        papers = json.loads(Path(args.corpus).read_text(encoding="utf-8"))
        retriever = HybridRetriever(papers=papers)
    else:
        retriever = HybridRetriever()

    threshold = args.min_score
    if threshold is None and args.calibration_report:
        with open(args.calibration_report, "r", encoding="utf-8") as fh:
            threshold = json.load(fh)["selection"]["threshold"]

    q_idx = _label_index(labels)
    queries = sorted(q_idx)

    # Warm up models so latency numbers exclude one-time loading.
    retriever.search(queries[0], top_k=1)

    configs: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
        "legacy": {q: [] for q in queries},
        "rrf_only": {q: [] for q in queries},
        "reranked": {q: [] for q in queries},
    }
    latencies: Dict[str, List[float]] = {k: [] for k in configs}

    for q in queries:
        t0 = time.perf_counter()
        configs["legacy"][q] = _legacy_search(retriever, q, top_k=args.top_k)
        latencies["legacy"].append((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        configs["rrf_only"][q] = retriever.search(q, top_k=args.top_k, rerank=False)
        latencies["rrf_only"].append((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        configs["reranked"][q] = retriever.search(q, top_k=args.top_k, min_score=threshold)
        latencies["reranked"].append((time.perf_counter() - t0) * 1000)

    results = [
        evaluate_configuration(name, ranked, q_idx, args.relevance_cutoff, latencies[name])
        for name, ranked in configs.items()
    ]

    # Threshold P/R/F1 on the labelled pairs (scored with the production reranker).
    threshold_section: Optional[Dict[str, Any]] = None
    if threshold is not None:
        scored_rows = score_labelled_examples(labels)
        thr_metrics = evaluate_threshold(scored_rows, threshold, args.relevance_cutoff)
        threshold_section = {
            "threshold": threshold,
            "source": ("--min-score" if args.min_score is not None else "--calibration-report"),
            **thr_metrics,
        }
    else:
        threshold_section = {
            "threshold": None,
            "note": "No threshold configured (-min-score/--calibration-report); "
                    "threshold P/R/F1 not evaluated. This mirrors production when "
                    "RESEARCHPILOT_MIN_RERANKER_SCORE is unset.",
        }

    report = {
        "labels_path": args.labels,
        "n_queries": len(queries),
        "n_labelled_pairs": len(labels),
        "relevance_cutoff": args.relevance_cutoff,
        "binary_mapping": f"label >= {args.relevance_cutoff} counts as relevant",
        "configurations": results,
        "threshold": threshold_section,
        "limitations": [
            "Recall@20 and nDCG are computed WITHIN the judged pool: passages "
            "without labels count as non-relevant. Adding labels can change these values.",
            "The 'legacy' configuration is an evaluation-only reference copy of the "
            "pre-upgrade scoring formula; it is not part of the production pipeline.",
            "Latency was measured on this machine after a warm-up query; absolute "
            "numbers depend on hardware.",
        ],
    }

    print("\n=== Retrieval Evaluation (fixed labelled query set) ===")
    header = f"{'config':<10} {'P@10':>6} {'R@20*':>7} {'nDCG@10':>8} {'ms/query':>9} {'dupRate':>8} {'noRel@10':>9}"
    print(header)
    for r in results:
        print(f"{r['configuration']:<10} "
              f"{r['precision_at_10']:>6.3f} "
              f"{r['recall_at_20_pool_restricted']:>7.3f} "
              f"{r['ndcg_at_10']:>8.3f} "
              f"{r['latency_ms_mean']:>9.1f} "
              f"{r['duplicate_paper_rate_top10']:>8.3f} "
              f"{r['queries_no_relevant_in_top10']:>9d}")
    print("* Recall@20 is restricted to the judged pool (see limitations).")

    if threshold_section and threshold_section.get("threshold") is not None:
        t = threshold_section
        print(f"\nThreshold {t['threshold']} ({t['source']}): "
              f"P={t['precision']} R={t['recall']} F1={t['f1']} "
              f"(TP={t['tp']} FP={t['fp']} TN={t['tn']} FN={t['fn']})")
    else:
        print(f"\nThreshold: {threshold_section['note']}")

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
        print(f"\nFull report written to: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
