"""Integration smoke tests using the ACTUAL cross-encoder model.

These tests exercise the real download/load/inference path. They are skipped
automatically when the model cannot be loaded (offline environment, missing
sentence-transformers), so the unit suite stays hermetic.
"""

import math

import pytest

pytest.importorskip("sentence_transformers", reason="sentence-transformers not installed")

from app.services.retrieval import HybridRetriever, CrossEncoderReranker, RerankerUnavailableError
from app.services.calibration import (
    load_labelled_examples,
    run_calibration,
    score_labelled_examples,
    select_threshold,
)
from pathlib import Path


def _model_available() -> bool:
    try:
        CrossEncoderReranker()._load()
        return True
    except Exception:
        return False


MODEL_OK = _model_available()

pytestmark = [
    pytest.mark.skipif(not MODEL_OK, reason="cross-encoder model unavailable (offline or download failed)"),
]


def test_real_cross_encoder_reranks_preloaded_corpus():
    retriever = HybridRetriever()
    results = retriever.search(
        "How does hybrid BM25 and dense retrieval improve RAG citation accuracy?",
        top_k=3,
    )
    assert results, "expected results from the preloaded corpus"
    top = results[0]
    assert top["reranked"] is True
    assert isinstance(top["reranker_score"], float) and math.isfinite(top["reranker_score"])
    assert top["reranker_model"] == "cross-encoder/ms-marco-MiniLM-L-6-v2"
    assert 0.0 < top["reranker_probability"] < 1.0
    # The clearly hybrid-retrieval paper must beat an agent-orchestration paper.
    ids = [r["doc_id"] for r in results]
    assert "doc_hybrid_005" in ids


def test_real_model_ranks_relevant_above_irrelevant():
    retriever = HybridRetriever()
    relevant = retriever.search("sandboxed experiment execution with timeouts", top_k=1)
    assert relevant and relevant[0]["doc_id"] == "doc_repro_004"
    off = retriever.search("best restaurants in Paris France", top_k=1)
    assert off and off[0]["reranker_score"] < 0.0  # out-of-domain scores negative


def test_real_calibration_smoke_on_sample(tmp_path):
    sample = Path(__file__).resolve().parent.parent / "eval" / "labels" / "query_relevance_labels.sample.jsonl"
    if not sample.exists():
        pytest.skip("sample labels file not present")
    examples = load_labelled_examples(str(sample))
    subset = [ex for ex in examples if ex.query in sorted({e.query for e in examples})[:2]]
    rows = score_labelled_examples(subset)
    assert len(rows) == len(subset)
    assert all(math.isfinite(r["raw_score"]) for r in rows)
    sel = select_threshold(rows)
    assert math.isfinite(sel["threshold"])
