"""Threshold calibration for the cross-encoder relevance filter.

Reproducible workflow that determines RESEARCHPILOT_MIN_RERANKER_SCORE from
human-labelled query-passage examples.

Score representation: this module scores every labelled (query, passage) pair
with the SAME CrossEncoderReranker instance used by the production retrieval
pipeline (app/services/retrieval.py) and uses the RAW model score (logit) as
the canonical representation for both calibration and production filtering.
The sigmoid-transformed value is recorded for transparency only; it is a
transformed model score, NOT a calibrated relevance probability. Applying a
sigmoid does not calibrate the model - do not interpret it as P(relevant).

Label scheme (documented in Backend/eval/labels/README.md):
    0 - Irrelevant
    1 - Partially relevant
    2 - Relevant
Binary relevance for threshold selection defaults to `label == 2` (i.e.
label >= relevance_cutoff with relevance_cutoff=2). Partially relevant
examples are treated as non-relevant by default; pass a different
relevance_cutoff to change the mapping.

Limitations handled explicitly:
- Ties between candidate thresholds are resolved deterministically (the
  HIGHEST threshold achieving the best objective is preferred, a
  precision-leaning choice) and all tied candidates are reported.
- Datasets containing only one relevance class cannot support a reliable
  threshold; metrics are still reported but the selection is flagged
  reliable=False with an explanation.
- With limited data, leave-one-query-out cross-validation (folds grouped by
  query so no query leaks between calibration and validation) estimates how
  the chosen threshold generalizes. A separate validation labels file can be
  supplied instead when enough labelled examples exist.
"""

import csv
import json
import math
import statistics
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.retrieval import CrossEncoderReranker, _sigmoid

VALID_LABELS = {0, 1, 2}
DEFAULT_RELEVANCE_CUTOFF = 2


@dataclass
class LabelledExample:
    query: str
    doc_id: str
    passage_text: str
    relevance_label: int
    chunk_id: Optional[str] = None
    source: str = "unspecified"
    notes: Optional[str] = None

    def to_row(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "doc_id": self.doc_id,
            "chunk_id": self.chunk_id,
            "passage_text": self.passage_text,
            "relevance_label": self.relevance_label,
            "source": self.source,
            "notes": self.notes,
        }


# ── Labelled data loading ────────────────────────────────────────────────


def load_labelled_examples(path: str) -> List[LabelledExample]:
    """Load labelled examples from a .jsonl or .csv file with strict validation.

    Required fields: query, doc_id, passage_text, relevance_label.
    Optional fields: chunk_id, source, notes.
    Raises ValueError with the offending row number on any schema violation.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Labels file not found: {path}")
    examples: List[LabelledExample] = []
    if p.suffix.lower() == ".jsonl":
        with p.open("r", encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"{path}:{line_no}: invalid JSON ({exc})") from exc
                examples.append(_example_from_record(rec, f"{path}:{line_no}"))
    elif p.suffix.lower() == ".csv":
        with p.open("r", encoding="utf-8", newline="") as fh:
            for line_no, rec in enumerate(csv.DictReader(fh), start=2):
                examples.append(_example_from_record(rec, f"{path}:{line_no}"))
    else:
        raise ValueError(f"Unsupported labels file format '{p.suffix}'. Use .jsonl or .csv.")
    if not examples:
        raise ValueError(f"{path}: no labelled examples found.")
    return examples


def _example_from_record(rec: Dict[str, Any], where: str) -> LabelledExample:
    missing = [f for f in ("query", "doc_id", "passage_text", "relevance_label")
               if rec.get(f) in (None, "")]
    if missing:
        raise ValueError(f"{where}: missing required field(s): {', '.join(missing)}")
    try:
        label = int(rec["relevance_label"])
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"{where}: relevance_label must be an integer in {sorted(VALID_LABELS)}, "
            f"got {rec['relevance_label']!r}"
        ) from exc
    if label not in VALID_LABELS:
        raise ValueError(
            f"{where}: relevance_label {label} is outside the documented scheme "
            f"{sorted(VALID_LABELS)} (0=Irrelevant, 1=Partially relevant, 2=Relevant)."
        )
    return LabelledExample(
        query=str(rec["query"]).strip(),
        doc_id=str(rec["doc_id"]).strip(),
        passage_text=str(rec["passage_text"]),
        relevance_label=label,
        chunk_id=(str(rec["chunk_id"]).strip() if rec.get("chunk_id") not in (None, "") else None),
        source=str(rec.get("source") or "unspecified"),
        notes=(str(rec["notes"]) if rec.get("notes") not in (None, "") else None),
    )


# ── Scoring with the production reranker ─────────────────────────────────


def score_labelled_examples(
    examples: List[LabelledExample],
    model_name: Optional[str] = None,
    batch_size: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Score each labelled pair with the production cross-encoder.

    Uses the same model, the same class, and the same raw-score representation
    as production filtering (see retrieval.search min_score handling).
    """
    reranker = CrossEncoderReranker(model_name=model_name, batch_size=batch_size)
    rows: List[Dict[str, Any]] = []
    for ex in examples:
        raw = reranker.score(ex.query, [ex.passage_text])[0]
        rows.append({
            "query": ex.query,
            "doc_id": ex.doc_id,
            "chunk_id": ex.chunk_id,
            "relevance_label": ex.relevance_label,
            "source": ex.source,
            "raw_score": float(raw),
            "transformed_score": round(_sigmoid(float(raw)), 6),
        })
    return rows


# ── Threshold evaluation ─────────────────────────────────────────────────


def binary_relevance(label: int, relevance_cutoff: int = DEFAULT_RELEVANCE_CUTOFF) -> bool:
    """Map a graded label to binary relevance (label >= cutoff counts as relevant)."""
    return label >= relevance_cutoff


def evaluate_threshold(
    rows: List[Dict[str, Any]],
    threshold: float,
    relevance_cutoff: int = DEFAULT_RELEVANCE_CUTOFF,
) -> Dict[str, Any]:
    """Classification metrics for 'predict relevant iff raw_score >= threshold'."""
    tp = fp = tn = fn = 0
    for r in rows:
        predicted = r["raw_score"] >= threshold
        actual = binary_relevance(r["relevance_label"], relevance_cutoff)
        if predicted and actual:
            tp += 1
        elif predicted and not actual:
            fp += 1
        elif not predicted and not actual:
            tn += 1
        else:
            fn += 1
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    total = tp + fp + tn + fn
    accuracy = (tp + tn) / total if total > 0 else 0.0
    return {
        "threshold": threshold,
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "accuracy": round(accuracy, 4),
        "predicted_relevant": tp + fp,
    }


def _objective_value(metrics: Dict[str, Any], objective: str, beta: float) -> float:
    """Compute the selection objective from EXACT confusion-matrix counts.

    Deliberately not read from the rounded display fields: threshold selection
    and tie detection must operate on unrounded values.
    """
    tp, fp, fn = metrics["tp"], metrics["fp"], metrics["fn"]
    p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    if objective == "f1":
        return (2 * p * r / (p + r)) if (p + r) > 0 else 0.0
    if objective == "precision":
        return p
    if objective == "recall":
        return r
    if objective == "fbeta":
        if p + r == 0:
            return 0.0
        b2 = beta * beta
        return (1 + b2) * p * r / (b2 * p + r)
    raise ValueError(f"Unknown objective '{objective}'. Use f1, precision, recall, or fbeta.")


def select_threshold(
    rows: List[Dict[str, Any]],
    objective: str = "f1",
    beta: float = 1.0,
    relevance_cutoff: int = DEFAULT_RELEVANCE_CUTOFF,
) -> Dict[str, Any]:
    """Sweep candidate thresholds and select the best by the documented objective.

    Candidate thresholds are the unique raw scores in the dataset (a threshold
    between two observed scores selects the same set as the higher score, so
    the unique-score grid is exhaustive). Ties are resolved to the HIGHEST
    threshold achieving the best objective (precision-leaning, conservative)
    and all tied candidates are reported.

    Single-class datasets (no positives or no negatives under the binary
    mapping) are flagged reliable=False: any threshold selected on such data
    reflects only one class and must not be trusted.
    """
    if not rows:
        raise ValueError("No scored rows to calibrate on.")
    n_pos = sum(1 for r in rows if binary_relevance(r["relevance_label"], relevance_cutoff))
    n_neg = len(rows) - n_pos
    limitations: List[str] = []
    reliable = True
    if n_pos == 0:
        reliable = False
        limitations.append(
            "Calibration set contains NO relevant (label >= cutoff) examples; any "
            "selected threshold only reflects the irrelevant class and is unreliable."
        )
    if n_neg == 0:
        reliable = False
        limitations.append(
            "Calibration set contains NO irrelevant (label < cutoff) examples; any "
            "selected threshold only reflects the relevant class and is unreliable."
        )

    candidates = sorted({r["raw_score"] for r in rows})
    table = [evaluate_threshold(rows, t, relevance_cutoff) for t in candidates]
    for m in table:
        m["objective_value"] = round(_objective_value(m, objective, beta), 6)

    best_value = max(m["objective_value"] for m in table)
    tied = [m for m in table if m["objective_value"] == best_value]
    best = max(tied, key=lambda m: m["threshold"])  # deterministic: highest threshold

    return {
        "threshold": best["threshold"],
        "objective": objective,
        "objective_value": best["objective_value"],
        "tied_thresholds": [m["threshold"] for m in tied],
        "tie_count": len(tied),
        "reliable": reliable,
        "metrics_at_selected": best,
        "candidate_table": table,
        "class_counts": {"relevant": n_pos, "non_relevant": n_neg},
        "limitations": limitations,
    }


# ── Validation strategies ────────────────────────────────────────────────


def leave_one_query_out_cv(
    rows: List[Dict[str, Any]],
    objective: str = "f1",
    relevance_cutoff: int = DEFAULT_RELEVANCE_CUTOFF,
) -> Dict[str, Any]:
    """Grouped cross-validation by query (out-of-fold threshold stability check).

    Folds are keyed by query so the SAME query never appears in both the
    calibration fold and the validation fold. For each fold a threshold is
    selected on the other folds and evaluated on the held-out query. This is
    the documented out-of-fold strategy for small datasets; it estimates
    variance of the selected threshold, not a guaranteed calibrated
    probability cutoff.
    """
    by_query: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        by_query.setdefault(r["query"], []).append(r)
    queries = sorted(by_query)
    if len(queries) < 2:
        return {
            "skipped": True,
            "reason": (
                f"Need at least 2 distinct queries for leave-one-query-out CV; "
                f"got {len(queries)}. Threshold stability cannot be estimated."
            ),
            "folds": [],
        }
    folds = []
    for held_out in queries:
        calib = [r for q, rs in by_query.items() if q != held_out for r in rs]
        val = by_query[held_out]
        sel = select_threshold(calib, objective=objective, relevance_cutoff=relevance_cutoff)
        ev = evaluate_threshold(val, sel["threshold"], relevance_cutoff)
        folds.append({
            "held_out_query": held_out,
            "calibration_size": len(calib),
            "validation_size": len(val),
            "selected_threshold": sel["threshold"],
            "reliable_selection": sel["reliable"],
            "validation_metrics": ev,
        })
    thresholds = [f["selected_threshold"] for f in folds]
    return {
        "skipped": False,
        "n_folds": len(folds),
        "folds": folds,
        "threshold_mean": round(statistics.mean(thresholds), 6),
        "threshold_stdev": round(statistics.pstdev(thresholds), 6) if len(thresholds) > 1 else 0.0,
        "note": (
            "Folds are grouped by query: the held-out query contributes to "
            "validation only, never to its own threshold selection."
        ),
    }


# ── End-to-end calibration run ───────────────────────────────────────────


def run_calibration(
    labels_path: str,
    validation_path: Optional[str] = None,
    output_path: Optional[str] = None,
    model_name: Optional[str] = None,
    objective: str = "f1",
    relevance_cutoff: int = DEFAULT_RELEVANCE_CUTOFF,
    batch_size: Optional[int] = None,
) -> Dict[str, Any]:
    """Full calibration workflow. Returns (and optionally writes) a JSON report.

    - Scores all labelled pairs with the production cross-encoder (raw logits).
    - Selects the threshold on the calibration labels by the given objective.
    - If validation_path is provided, the selected threshold is evaluated on
      that SEPARATE validation set (calibration and validation never mix).
      Otherwise leave-one-query-out CV on the calibration data estimates
      out-of-fold stability.
    """
    examples = load_labelled_examples(labels_path)
    rows = score_labelled_examples(examples, model_name=model_name, batch_size=batch_size)

    selection = select_threshold(rows, objective=objective, relevance_cutoff=relevance_cutoff)
    threshold = selection["threshold"]

    if validation_path:
        val_examples = load_labelled_examples(validation_path)
        val_rows = score_labelled_examples(val_examples, model_name=model_name, batch_size=batch_size)
        validation = {
            "mode": "separate_validation_file",
            "validation_path": str(validation_path),
            "n_validation_examples": len(val_rows),
            "metrics_at_calibrated_threshold": evaluate_threshold(
                val_rows, threshold, relevance_cutoff
            ),
            "note": (
                "Threshold selected exclusively on the calibration file; the "
                "validation file was never used for selection."
            ),
        }
    else:
        cv = leave_one_query_out_cv(rows, objective=objective, relevance_cutoff=relevance_cutoff)
        validation = {
            "mode": "leave_one_query_out_cv",
            "cv": cv,
            "note": (
                "No separate validation file supplied; out-of-fold stability is "
                "estimated with query-grouped cross-validation instead."
            ),
        }

    label_counts = Counter(r["relevance_label"] for r in rows)
    sources = sorted({r["source"] for r in rows})
    demo_sources = {"developer_draft_demo", "demo", "synthetic"}
    limitations = list(selection["limitations"])
    if any(s.lower() in demo_sources for s in sources):
        limitations.append(
            "Label provenance includes demonstration-only sources "
            f"({sources}): these labels are developer-authored examples for "
            "pipeline demonstration, NOT human-verified ground truth. Recalibrate "
            "with a properly collected and agreed labelled dataset before "
            "trusting the selected threshold in production."
        )
    if len(rows) < 50:
        limitations.append(
            f"Calibration set is small ({len(rows)} labelled pairs); the selected "
            "threshold may not generalize. Collect more labelled examples for a "
            "stable estimate."
        )

    report: Dict[str, Any] = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "labels_path": str(labels_path),
        "n_examples": len(rows),
        "n_queries": len({r["query"] for r in rows}),
        "label_counts": {str(k): label_counts.get(k, 0) for k in sorted(label_counts)},
        "label_provenance": sources,
        "label_scheme": {
            "graded": "0=Irrelevant, 1=Partially relevant, 2=Relevant",
            "binary_mapping": f"label >= {relevance_cutoff} counts as relevant",
            "relevance_cutoff": relevance_cutoff,
        },
        "model": {
            "reranker_model": model_name or __import__("app.core.config", fromlist=["settings"]).settings.RERANKER_MODEL,
            "score_representation": (
                "raw cross-encoder score (logit); identical representation used "
                "for calibration and production RESEARCHPILOT_MIN_RERANKER_SCORE filtering"
            ),
            "transformed_score_note": (
                "sigmoid-transformed scores are recorded per row for display only; "
                "they are transformed model scores, NOT calibrated relevance probabilities"
            ),
        },
        "objective": objective,
        "selection": selection,
        "validation": validation,
        "limitations": limitations,
        "scored_rows": rows,
        "env_instructions": (
            "To apply: set RESEARCHPILOT_MIN_RERANKER_SCORE="
            f"{threshold} in Backend/.env, then restart the backend. Re-run this "
            "workflow whenever the reranker model or corpus changes materially."
        ),
    }

    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)

    return report


def summarize_report(report: Dict[str, Any]) -> str:
    """Compact human-readable summary of a calibration report."""
    sel = report["selection"]
    lines = [
        "=== Threshold Calibration Summary ===",
        f"Model:            {report['model']['reranker_model']}",
        f"Examples:         {report['n_examples']} pairs, {report['n_queries']} queries",
        f"Label counts:     {report['label_counts']} (mapping: {report['label_scheme']['binary_mapping']})",
        f"Objective:        maximize {report['objective']}",
        f"Selected threshold (raw score >= t is relevant): {sel['threshold']}",
        f"  objective={sel['objective_value']}  ties={sel['tie_count']}  reliable={sel['reliable']}",
        f"  P={sel['metrics_at_selected']['precision']} R={sel['metrics_at_selected']['recall']} "
        f"F1={sel['metrics_at_selected']['f1']} "
        f"(TP={sel['metrics_at_selected']['tp']} FP={sel['metrics_at_selected']['fp']} "
        f"TN={sel['metrics_at_selected']['tn']} FN={sel['metrics_at_selected']['fn']})",
    ]
    val = report["validation"]
    if val["mode"] == "separate_validation_file":
        m = val["metrics_at_calibrated_threshold"]
        lines.append(
            f"Validation (separate file, n={val['n_validation_examples']}): "
            f"P={m['precision']} R={m['recall']} F1={m['f1']}"
        )
    else:
        cv = val["cv"]
        if cv.get("skipped"):
            lines.append(f"CV: skipped - {cv['reason']}")
        else:
            lines.append(
                f"CV (leave-one-query-out, {cv['n_folds']} folds): "
                f"threshold mean={cv['threshold_mean']} stdev={cv['threshold_stdev']}"
            )
    if report["limitations"]:
        lines.append("Limitations:")
        for lim in report["limitations"]:
            lines.append(f"  - {lim}")
    return "\n".join(lines)
