"""Unit tests for the reranking pipeline. All model inference is mocked so
these tests are hermetic and offline-safe."""

import math

import pytest

import app.services.retrieval as retrieval_module
from app.services.retrieval import (
    RRF_K,
    CrossEncoderReranker,
    DenseEmbedder,
    HybridRetriever,
    RerankerUnavailableError,
    _sigmoid,
)
from app.services.corpus import PRELOADED_PAPERS


class StubReranker:
    """Deterministic reranker stub: scores passages by a caller-supplied map."""

    def __init__(self, logits_by_text=None, model_name="stub-reranker", fail=False):
        self.logits_by_text = logits_by_text or {}
        self.model_name = model_name
        self.fail = fail
        self.calls = 0
        self.last_batch_size = 0

    def score(self, query, passages):
        self.calls += 1
        self.last_batch_size = len(passages)
        if self.fail:
            raise RerankerUnavailableError(f"stub failure: {self.model_name} unavailable")
        return [self.logits_by_text.get(p, 0.0) for p in passages]


@pytest.fixture
def retriever():
    """Fresh retriever on the preloaded corpus with a stub reranker and a
    disabled embedding model (lexical dense fallback) so no model downloads
    happen in unit tests."""
    r = HybridRetriever()
    r._embedder._load_error = "unit-test: embedding model disabled"
    r._embedder._model = None
    r._reranker = StubReranker()
    return r


def test_bm25_and_dense_both_run_and_produce_ranks(retriever):
    results = retriever.search("hybrid BM25 dense retrieval", top_k=5, rerank=False)
    assert results
    for r in results:
        assert r["bm25_rank"] is not None and r["bm25_rank"] >= 1
        assert r["dense_rank"] is not None and r["dense_rank"] >= 1
        assert r["embedding_backend"] == "lexical_fallback"


def test_rrf_fusion_combines_both_rankings():
    bm25 = ["a", "b", "c"]
    dense = ["b", "a", "d"]
    fused = HybridRetriever._rrf_fuse(bm25, dense, hybrid_weight=0.5, k=RRF_K)
    # Weighted RRF: each contribution scaled by its ranking's weight (0.5 each).
    # a: bm25 rank 1 + dense rank 2; b: bm25 rank 2 + dense rank 1 (symmetric -> tie)
    assert fused["a"] == pytest.approx(0.5 / (RRF_K + 1) + 0.5 / (RRF_K + 2))
    assert fused["b"] == pytest.approx(fused["a"])
    assert fused["d"] == pytest.approx(0.5 / (RRF_K + 3))  # dense rank 3 only
    assert fused["c"] == pytest.approx(0.5 / (RRF_K + 3))  # bm25 rank 3 only
    assert fused["a"] > fused["c"]
    # weighted variant: w=1.0 -> dense-only contributions
    only_dense = HybridRetriever._rrf_fuse(bm25, dense, hybrid_weight=1.0, k=RRF_K)
    assert only_dense["b"] > only_dense["a"] > only_dense["d"]
    assert only_dense["c"] == 0.0


def test_rrf_beats_single_signal_in_search(retriever):
    """A chunk ranked #1 by BOTH signals must beat one ranked high by only one."""
    results = retriever.search("sandboxed execution resource limits timeouts", top_k=13, rerank=False)
    assert results[0]["chunk_id"] == "chunk_repro_004_2"  # top for BM25 AND lexical-dense


def test_cross_encoder_reranks_candidates_after_fusion(retriever):
    # Logits deliberately invert the expected RRF order.
    logits = {}
    for i, paper in enumerate(PRELOADED_PAPERS):
        for j, ch in enumerate(paper["chunks"]):
            logits[ch["text"]] = -float(len(logits))  # first corpus chunk scores highest
    stub = StubReranker(logits_by_text=logits)
    retriever._reranker = stub

    results = retriever.search("any research query about agents", top_k=5)
    assert stub.calls == 1
    assert all(r["reranked"] for r in results)
    assert all(r["reranker_model"] == "stub-reranker" for r in results)
    scores = [r["reranker_score"] for r in results]
    assert scores == sorted(scores, reverse=True)
    # The chunk with logit 0.0 (highest in the stub) is first.
    expected_top = min(logits, key=lambda t: -logits[t])
    assert results[0]["passage_text"] == expected_top


def test_results_sorted_by_reranker_score_descending(retriever):
    texts = [ch["text"] for p in PRELOADED_PAPERS for ch in p["chunks"]]
    logits = {t: float(-i) for i, t in enumerate(reversed(texts))}
    retriever._reranker = StubReranker(logits_by_text=logits)
    results = retriever.search("query", top_k=10)
    scores = [r["reranker_score"] for r in results]
    assert scores == sorted(scores, reverse=True)
    for r in results:
        assert r["reranker_probability"] == pytest.approx(round(_sigmoid(r["reranker_score"]), 6))


def test_probability_is_sigmoid_of_raw_score(retriever):
    retriever._reranker = StubReranker(logits_by_text={PRELOADED_PAPERS[0]["chunks"][0]["text"]: 2.0})
    results = retriever.search("q", top_k=1)
    assert results[0]["reranker_score"] == 2.0
    assert results[0]["reranker_probability"] == pytest.approx(1 / (1 + math.exp(-2.0)), abs=1e-5)


def test_threshold_filters_when_configured(retriever, monkeypatch):
    logits = {}
    for i, paper in enumerate(PRELOADED_PAPERS):
        for ch in paper["chunks"]:
            logits[ch["text"]] = {0: 3.0, 1: 1.0, 2: -2.0, 3: -9.0}[i % 4]
    retriever._reranker = StubReranker(logits_by_text=logits)

    # Default cap = 2 chunks/paper: papers 0,1,4,5 have logits >= 0 and
    # contribute at most 2 chunks each -> 8 results survive the threshold.
    results = retriever.search("q", top_k=13, min_score=0.0)
    assert len(results) == 8
    assert all(r["reranker_score"] >= 0.0 for r in results)


def test_unset_threshold_does_not_filter(retriever, monkeypatch):
    monkeypatch.setattr(retrieval_module.settings, "MIN_RERANKER_SCORE", None)
    logits = {}
    for paper in PRELOADED_PAPERS:
        for ch in paper["chunks"]:
            logits[ch["text"]] = -100.0  # everything far below any plausible cutoff
    retriever._reranker = StubReranker(logits_by_text=logits)
    results = retriever.search("q", top_k=6)
    assert len(results) == 6  # no arbitrary filtering when no threshold configured


def test_env_threshold_applies_without_call_override(retriever, monkeypatch):
    logits = {}
    for paper in PRELOADED_PAPERS:
        for ch in paper["chunks"]:
            logits[ch["text"]] = 0.5
    retriever._reranker = StubReranker(logits_by_text=logits)
    monkeypatch.setattr(retrieval_module.settings, "MIN_RERANKER_SCORE", 1.0)
    assert retriever.search("q", top_k=13) == []  # all below 1.0 -> all filtered
    monkeypatch.setattr(retrieval_module.settings, "MIN_RERANKER_SCORE", 0.0)
    assert len(retriever.search("q", top_k=13)) > 0


def test_per_paper_cap_and_no_duplicate_chunks(retriever):
    results = retriever.search("retrieval verification experiment", top_k=13, rerank=False, max_per_paper=1)
    doc_ids = [r["doc_id"] for r in results]
    chunk_ids = [r["chunk_id"] for r in results]
    assert len(doc_ids) == len(set(doc_ids))  # max 1 chunk per paper
    assert len(chunk_ids) == len(set(chunk_ids))  # no duplicate chunks


def test_candidate_cap_limits_reranker_input(retriever):
    stub = StubReranker()
    retriever._reranker = stub
    retriever.search("q", top_k=5, rerank_candidates=3, max_per_paper=None)
    assert stub.calls == 1
    assert stub.last_batch_size == 3  # only the fused top-3 reached the model


def test_legacy_signature_and_fields_remain_compatible(retriever):
    results = retriever.search("How does hybrid BM25 and dense retrieval improve RAG citation accuracy?", 3)
    assert len(results) == 3
    legacy_fields = {"chunk_id", "doc_id", "title", "authors", "identifier",
                     "publication_year", "venue", "passage_text", "chunk_index",
                     "retrieval_score", "reranker_score", "timestamp"}
    assert legacy_fields.issubset(results[0].keys())
    kw_results = retriever.search(query="verification", top_k=2, hybrid_weight=0.7)
    assert len(kw_results) == 2


def test_empty_query_and_empty_corpus(retriever):
    assert retriever.search("", top_k=3) == []
    assert retriever.search("  \t ", top_k=3) == []
    empty = HybridRetriever(papers=[])
    empty._embedder._load_error = "unit-test"
    assert empty.search("real query", top_k=3) == []


def test_model_load_failure_degrades_clearly_without_fabricated_scores(retriever, monkeypatch):
    retriever._reranker = StubReranker(fail=True)
    results = retriever.search("q", top_k=5, min_score=-1000.0)
    assert results  # degraded results are still returned
    assert all(r["reranked"] is False for r in results)
    assert all(r["reranker_score"] is None for r in results)
    assert all("stub failure" in r["reranker_error"] for r in results)
    # Degraded results must NOT be threshold-filtered with a reranker cutoff:
    # count equals the unfiltered RRF candidate count for the same query.
    unfiltered = retriever.search("q", top_k=25, rerank=False)
    assert len(results) == min(5, len(unfiltered))


def test_reranker_model_load_failure_raises_with_clear_error():
    rr = CrossEncoderReranker(model_name="nonexistent-org/nonexistent-model-xyz")
    with pytest.raises(RerankerUnavailableError) as excinfo:
        rr.score("q", ["passage"])
    assert "nonexistent-org/nonexistent-model-xyz" in str(excinfo.value)


def test_models_not_loaded_at_construction():
    # Constructing a reranker for an unseen model must not load anything
    # until score() is called (lazy initialization).
    rr = CrossEncoderReranker(model_name="unloaded/test-model")
    assert not rr.is_available


def test_embedding_cache_hits_and_misses(monkeypatch):
    class FakeST:
        def encode(self, texts, batch_size=None, convert_to_numpy=True,
                   normalize_embeddings=False, show_progress_bar=False):
            import numpy as np
            return np.ones((len(texts), 4), dtype=np.float32)

    emb = DenseEmbedder(model_name="fake-embedder")
    monkeypatch.setattr(DenseEmbedder, "_ensure_model",
                        lambda self: setattr(self, "_model", FakeST()) or True)
    v1 = emb.embed_texts(["hello world", "second text"])
    assert emb.stats["cache_misses"] == 2 and emb.stats["cache_hits"] == 0
    v2 = emb.embed_texts(["hello world", "second text"])
    assert emb.stats["cache_hits"] == 2  # fully served from cache
    assert v1.shape == v2.shape == (2, 4)
    emb.clear_caches()
    assert emb.stats["cache_misses"] == 0 and len(emb._cache) == 0


def test_embedding_cache_invalidated_after_ingestion(retriever, monkeypatch):
    class FakeST:
        def encode(self, texts, batch_size=None, convert_to_numpy=True,
                   normalize_embeddings=False, show_progress_bar=False):
            import numpy as np
            return np.arange(len(texts) * 2, dtype=np.float32).reshape(len(texts), 2)

    monkeypatch.setattr(DenseEmbedder, "_ensure_model",
                        lambda self: setattr(self, "_model", FakeST()) or True)
    retriever._embedder.clear_caches()
    retriever.search("warmup query", top_k=1)
    misses_before = retriever._embedder.stats["cache_misses"]

    new_paper = {
        "id": "doc_new_999", "title": "Novel Neural Reranking Study",
        "authors": "Nobody, A.", "identifier": "arXiv:9999.9999",
        "publication_year": 2026, "venue": "TestConf",
        "chunks": [{"chunk_id": "chunk_new_999_1", "text": "novel reranking cache test passage"}],
    }
    assert retriever.ingest_papers([new_paper]) == 1
    retriever.search("novel reranking study", top_k=3)
    misses_after = retriever._embedder.stats["cache_misses"]
    # The ingested chunk's text got a fresh cache entry (no stale reuse possible).
    assert misses_after > misses_before
    hits = retriever.search("novel reranking study", top_k=3)
    assert all(h["embedding_backend"] == "minilm" for h in hits)
    # Duplicate ingestion is idempotent.
    assert retriever.ingest_papers([new_paper]) == 0


def test_dense_scores_fallback_when_model_unavailable():
    emb = DenseEmbedder(model_name="fake-embedder")
    emb._load_error = "offline"
    scores = emb.dense_scores("retrieval verification", ["retrieval verification systems", "cooking recipes"])
    assert len(scores) == 2
    assert scores[0] >= scores[1]  # lexical overlap must rank the matching text higher
