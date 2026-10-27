"""Unit tests for the threshold calibration module. All reranker inference is
mocked; metrics are checked against hand-computed values."""

import json
import math

import pytest

import app.services.calibration as calib
from app.services.calibration import (
    LabelledExample,
    binary_relevance,
    evaluate_threshold,
    leave_one_query_out_cv,
    load_labelled_examples,
    run_calibration,
    select_threshold,
    score_labelled_examples,
)

from app.services.retrieval import CrossEncoderReranker


# ── evaluate_threshold: hand-computed metrics ────────────────────────────

ROWS = [
    {"raw_score": 2.0, "relevance_label": 2},
    {"raw_score": 1.0, "relevance_label": 2},
    {"raw_score": 0.5, "relevance_label": 1},   # partial -> non-relevant
    {"raw_score": -1.0, "relevance_label": 0},
    {"raw_score": -2.0, "relevance_label": 0},
    {"raw_score": 3.0, "relevance_label": 0},   # hard negative
]


def test_evaluate_threshold_hand_computed():
    m = evaluate_threshold(ROWS, threshold=0.5)
    # predicted positive: 2.0, 1.0, 0.5, 3.0 | actual relevant: 2.0, 1.0
    assert m["tp"] == 2 and m["fp"] == 2 and m["tn"] == 2 and m["fn"] == 0
    assert m["precision"] == 0.5
    assert m["recall"] == 1.0
    assert m["f1"] == round(2 * 0.5 * 1.0 / 1.5, 4)
    assert m["accuracy"] == round(4 / 6, 4)


def test_binary_relevance_mapping():
    assert binary_relevance(2) is True
    assert binary_relevance(1) is False  # partial not relevant by default
    assert binary_relevance(0) is False
    assert binary_relevance(1, relevance_cutoff=1) is True


def test_evaluate_threshold_extremes():
    all_pos = evaluate_threshold(ROWS, threshold=-100.0)
    assert all_pos["fn"] == 0 and all_pos["tn"] == 0
    none_pos = evaluate_threshold(ROWS, threshold=100.0)
    assert none_pos["tp"] == 0 and none_pos["fp"] == 0
    assert none_pos["precision"] == 0.0 and none_pos["recall"] == 0.0


# ── select_threshold ─────────────────────────────────────────────────────


def test_select_threshold_maximizes_f1():
    sel = select_threshold(ROWS, objective="f1")
    # t=1.0: TP={2.0,1.0}, FP={3.0} -> P=2/3, R=1, F1=0.8 (best on this set)
    assert sel["threshold"] == 1.0
    assert sel["objective_value"] == 0.8
    assert sel["reliable"] is True
    assert sel["metrics_at_selected"]["tp"] == 2
    assert sel["metrics_at_selected"]["fp"] == 1


def test_select_threshold_precision_objective():
    sel_f1 = select_threshold(ROWS, objective="f1")
    sel_p = select_threshold(ROWS, objective="precision")
    assert sel_p["threshold"] >= sel_f1["threshold"]
    # Best achievable precision is 2/3 at t=1.0: excluding the hard negative at
    # score 3.0 would also exclude the true positive at 2.0.
    assert sel_p["threshold"] == 1.0
    assert sel_p["metrics_at_selected"]["precision"] == 0.6667


def test_select_threshold_tie_broken_to_highest_and_reported():
    # Symmetric construction: positives at {3.0, -3.0}, negatives at {1.0, -1.0}.
    # t=3.0 -> F1=2/3, t=-3.0 -> F1=2/3 (tied maximum); interior thresholds lower.
    rows = [
        {"raw_score": 3.0, "relevance_label": 2},
        {"raw_score": -3.0, "relevance_label": 2},
        {"raw_score": 1.0, "relevance_label": 0},
        {"raw_score": -1.0, "relevance_label": 0},
    ]
    sel = select_threshold(rows, objective="f1")
    assert sel["tie_count"] == 2
    assert sorted(sel["tied_thresholds"]) == [-3.0, 3.0]
    assert sel["threshold"] == 3.0  # deterministic: highest tied threshold
    assert sel["objective_value"] == round(2 / 3, 6)


def test_single_class_dataset_flagged_unreliable():
    rows = [{"raw_score": s, "relevance_label": 2} for s in (3.0, 1.0, -1.0)]
    sel = select_threshold(rows)
    assert sel["reliable"] is False
    assert any("NO irrelevant" in lim for lim in sel["limitations"])

    rows_neg = [{"raw_score": s, "relevance_label": 0} for s in (3.0, 1.0)]
    sel2 = select_threshold(rows_neg)
    assert sel2["reliable"] is False
    assert any("NO relevant" in lim for lim in sel2["limitations"])


def test_precision_priority_objective_supported():
    rows = [{"raw_score": 5.0, "relevance_label": 2}, {"raw_score": -5.0, "relevance_label": 0}]
    sel = select_threshold(rows, objective="precision", beta=2.0)  # beta accepted for fbeta
    assert sel["threshold"] == 5.0 or sel["threshold"] == -5.0  # both give P=1.0; highest kept
    assert sel["threshold"] == 5.0


# ── leave-one-query-out CV (calibration/validation separation) ────────────


def _cv_rows():
    rows = []
    for q, scores in {
        "queryA": [(3.0, 2), (2.0, 2), (-1.0, 0)],
        "queryB": [(2.5, 2), (0.5, 1), (-2.0, 0)],
        "queryC": [(-3.0, 0), (-4.0, 0), (-5.0, 1)],
    }.items():
        for s, lab in scores:
            rows.append({"query": q, "raw_score": s, "relevance_label": lab})
    return rows


def test_cv_folds_group_by_query_with_no_leakage():
    rows = _cv_rows()
    sizes = {q: sum(1 for r in rows if r["query"] == q) for q in ("queryA", "queryB", "queryC")}
    cv = leave_one_query_out_cv(rows)
    assert cv["skipped"] is False and cv["n_folds"] == 3
    held = {f["held_out_query"] for f in cv["folds"]}
    assert held == {"queryA", "queryB", "queryC"}
    for f in cv["folds"]:
        # calibration fold must exclude ALL rows of the held-out query
        assert f["calibration_size"] == len(rows) - sizes[f["held_out_query"]]
        assert f["validation_size"] == sizes[f["held_out_query"]]


def test_cv_skipped_for_single_query():
    rows = [{"query": "only", "raw_score": 1.0, "relevance_label": 2},
            {"query": "only", "raw_score": -1.0, "relevance_label": 0}]
    cv = leave_one_query_out_cv(rows)
    assert cv["skipped"] is True and "2 distinct queries" in cv["reason"]


# ── labelled data loading & validation ───────────────────────────────────


def test_load_jsonl_valid_and_invalid(tmp_path):
    good = tmp_path / "labels.jsonl"
    good.write_text(
        json.dumps({"query": "q", "doc_id": "d1", "passage_text": "p",
                    "relevance_label": 2, "source": "annotator_x"}) + "\n"
        + json.dumps({"query": "q2", "doc_id": "d2", "passage_text": "p2",
                      "relevance_label": 0, "source": "annotator_x"}) + "\n",
        encoding="utf-8",
    )
    examples = load_labelled_examples(str(good))
    assert len(examples) == 2
    assert examples[0].relevance_label == 2 and examples[1].chunk_id is None

    bad_label = tmp_path / "bad_label.jsonl"
    bad_label.write_text(json.dumps({"query": "q", "doc_id": "d", "passage_text": "p",
                                     "relevance_label": 5, "source": "s"}) + "\n", encoding="utf-8")
    with pytest.raises(ValueError) as e:
        load_labelled_examples(str(bad_label))
    assert "outside the documented scheme" in str(e.value)

    missing_field = tmp_path / "missing.jsonl"
    missing_field.write_text(json.dumps({"query": "q", "doc_id": "d", "relevance_label": 1}) + "\n",
                             encoding="utf-8")
    with pytest.raises(ValueError) as e:
        load_labelled_examples(str(missing_field))
    assert "passage_text" in str(e.value)

    invalid_json = tmp_path / "broken.jsonl"
    invalid_json.write_text("{not json}\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_labelled_examples(str(invalid_json))


def test_load_csv_supported(tmp_path):
    csvf = tmp_path / "labels.csv"
    csvf.write_text(
        "query,doc_id,passage_text,relevance_label,source\n"
        'q1,d1,"some passage",2,ann1\n'
        'q2,d2,"other passage",0,ann1\n',
        encoding="utf-8",
    )
    examples = load_labelled_examples(str(csvf))
    assert len(examples) == 2 and examples[0].relevance_label == 2


def test_shipped_sample_loads_and_covers_both_classes():
    import pathlib
    sample = pathlib.Path(__file__).resolve().parent.parent / "eval" / "labels" / "query_relevance_labels.sample.jsonl"
    if not sample.exists():
        pytest.skip("sample labels file not present")
    examples = load_labelled_examples(str(sample))
    assert len(examples) >= 30
    labels = {ex.relevance_label for ex in examples}
    assert labels == {0, 1, 2}
    assert all(ex.source == "developer_draft_demo" for ex in examples)
    assert len({ex.query for ex in examples}) >= 10
    assert all(ex.passage_text for ex in examples)


# ── run_calibration end-to-end with mocked reranker ──────────────────────


def test_run_calibration_end_to_end_with_mocked_model(tmp_path, monkeypatch):
    fixed = {"How are claims verified against retrieved evidence?": {
                 "The FEVER verification protocol categorizes": 4.0,
                 "Evidence scoring requires measuring": 3.0,
                 "Scientific claim verification systems": 2.5,
                 "However, standard RAG systems": 0.5},
             "best restaurants in Paris France": {
                 "The FEVER verification protocol categorizes": -8.0,
                 "Evidence scoring requires measuring": -9.0,
                 "Scientific claim verification systems": -7.5,
                 "However, standard RAG systems": -6.5},
             }

    def fake_score(self, query, passages):
        mapping = fixed.get(query)
        if mapping is None:
            raise AssertionError(f"unexpected query passed to reranker: {query}")
        out = []
        for p in passages:
            for prefix, val in mapping.items():
                if p.startswith(prefix):
                    out.append(val)
                    break
            else:
                raise AssertionError("fake scorer missed a passage: " + repr(p[:60]))
        return out

    monkeypatch.setattr(CrossEncoderReranker, "score", fake_score)

    labels = tmp_path / "labels.jsonl"
    rows = [
        ("How are claims verified against retrieved evidence?", "chunk_claim_002_1", "The FEVER verification protocol categorizes", 2),
        ("How are claims verified against retrieved evidence?", "chunk_claim_002_2", "Evidence scoring requires measuring", 2),
        ("How are claims verified against retrieved evidence?", "chunk_eval_006_1", "Scientific claim verification systems", 2),
        ("How are claims verified against retrieved evidence?", "chunk_rag_001_3", "However, standard RAG systems", 1),
        ("best restaurants in Paris France", "chunk_claim_002_1", "The FEVER verification protocol categorizes", 0),
        ("best restaurants in Paris France", "chunk_claim_002_2", "Evidence scoring requires measuring", 0),
        ("best restaurants in Paris France", "chunk_eval_006_1", "Scientific claim verification systems", 0),
        ("best restaurants in Paris France", "chunk_rag_001_3", "However, standard RAG systems", 0),
    ]
    with labels.open("w", encoding="utf-8") as fh:
        for q, cid, prefix, lab in rows:
            fh.write(json.dumps({"query": q, "doc_id": "doc_x", "chunk_id": cid,
                                 "passage_text": prefix + " ...", "relevance_label": lab,
                                 "source": "annotator_test"}) + "\n")

    out_path = tmp_path / "report.json"
    report = run_calibration(str(labels), output_path=str(out_path),
                             model_name="mock-reranker")
    assert out_path.exists()
    assert report["model"]["reranker_model"] == "mock-reranker"
    assert report["n_examples"] == 8 and report["n_queries"] == 2
    # relevant pairs scored 0.5..4.0; irrelevant around -9 -> threshold separates them
    thr = report["selection"]["threshold"]
    assert 0.0 <= thr <= 4.5
    assert report["selection"]["reliable"] is True
    assert report["validation"]["mode"] == "leave_one_query_out_cv"
    assert report["validation"]["cv"]["n_folds"] == 2
    # scored rows use the raw representation used in production filtering
    vals = [r["raw_score"] for r in report["scored_rows"]]
    assert all(isinstance(v, float) and math.isfinite(v) for v in vals)
    assert all("transformed_score" in r for r in report["scored_rows"])
    # no demo-provenance warning for annotator_test source, but small-set warning present
    assert any("small" in lim for lim in report["limitations"])
    assert not any("demonstration-only" in lim for lim in report["limitations"])


def test_run_calibration_with_separate_validation_file(tmp_path, monkeypatch):
    """Threshold selection must use ONLY the calibration file; the validation
    file is scored at the calibrated threshold and never influences selection."""
    calls = {"queries": []}

    def fake_score(self, query, passages):
        calls["queries"].append(query)
        base = 3.0 if "relevant query" in query else -5.0
        return [base + 0.1 * i for i in range(len(passages))]

    monkeypatch.setattr(CrossEncoderReranker, "score", fake_score)

    calib_rows, val_rows = [], []
    for i in range(6):
        calib_rows.append(("relevant query A", f"d{i}", 2 if i % 2 == 0 else 0))
        calib_rows.append(("relevant query B", f"e{i}", 2 if i % 2 == 0 else 0))
    for i in range(3):
        val_rows.append(("relevant query C", f"v{i}", 2 if i % 2 == 0 else 0))

    def write(path, rows):
        with open(path, "w", encoding="utf-8") as fh:
            for q, d, lab in rows:
                fh.write(json.dumps({"query": q, "doc_id": d, "passage_text": f"passage {d}",
                                     "relevance_label": lab, "source": "annotator_test"}) + "\n")

    calib_file, val_file = tmp_path / "calib.jsonl", tmp_path / "val.jsonl"
    write(calib_file, calib_rows)
    write(val_file, val_rows)

    report = run_calibration(str(calib_file), validation_path=str(val_file),
                             model_name="mock-reranker")
    assert report["validation"]["mode"] == "separate_validation_file"
    assert report["validation"]["n_validation_examples"] == len(val_rows)
    val_metrics = report["validation"]["metrics_at_calibrated_threshold"]
    assert set(("tp", "fp", "tn", "fn", "precision", "recall", "f1")).issubset(val_metrics)
    # validation queries were scored (3 of them), calibration queries were scored too
    assert set(calls["queries"]) == {"relevant query A", "relevant query B", "relevant query C"}


def test_score_labelled_examples_uses_raw_representation(monkeypatch):
    monkeypatch.setattr(CrossEncoderReranker, "score",
                        lambda self, q, passages: [-1.25 for _ in passages])
    rows = score_labelled_examples([
        LabelledExample(query="q", doc_id="d", passage_text="p", relevance_label=0, source="s"),
    ])
    assert rows[0]["raw_score"] == -1.25
    assert rows[0]["transformed_score"] == round(1 / (1 + math.exp(1.25)), 6)
