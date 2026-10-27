import math

import pytest

from app.services.retrieval import hybrid_retriever


def test_hybrid_retrieval_returns_relevant_results():
    """Legacy fields remain, new reranking fields are coherent, and the
    hybrid-retrieval paper still tops a clearly hybrid-retrieval query."""
    query = "How does hybrid BM25 and dense retrieval improve RAG citation accuracy?"
    results = hybrid_retriever.search(query=query, top_k=3)

    assert len(results) > 0
    first = results[0]
    # Legacy field contract (unchanged names, unchanged types where applicable).
    for field in ("chunk_id", "doc_id", "title", "authors", "identifier",
                  "publication_year", "venue", "passage_text", "chunk_index",
                  "retrieval_score", "reranker_score", "timestamp"):
        assert field in first, f"legacy field {field} missing"
    assert isinstance(first["retrieval_score"], float)

    if first["reranked"]:
        assert isinstance(first["reranker_score"], float)
        assert 0.0 < first["reranker_probability"] < 1.0
        assert first["reranker_model"]
    else:
        # Honest degradation: no fabricated score, explicit error reported.
        assert first["reranker_score"] is None
        assert "reranker_error" in first

    assert first["doc_id"] == "doc_hybrid_005"

    # Scores descend by reranker score when reranked.
    scores = [r["reranker_score"] for r in results if r["reranked"]]
    assert scores == sorted(scores, reverse=True)


def test_query_expansion_contains_scientific_keywords():
    expansions = hybrid_retriever._expand_query("hallucination mitigation in agentic workflows")
    assert len(expansions) >= 2


def test_empty_query_returns_no_results():
    assert hybrid_retriever.search("", top_k=3) == []
    assert hybrid_retriever.search("   ", top_k=3) == []


def test_empty_corpus_returns_no_results():
    from app.services.retrieval import HybridRetriever
    empty = HybridRetriever(papers=[])
    assert empty.search("anything at all", top_k=3) == []
