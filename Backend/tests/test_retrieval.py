import pytest
from app.services.retrieval import hybrid_retriever

def test_hybrid_retrieval_returns_relevant_results():
    query = "How does hybrid BM25 and dense retrieval improve RAG citation accuracy?"
    results = hybrid_retriever.search(query=query, top_k=3)
    
    assert len(results) > 0
    assert "passage_text" in results[0]
    assert "retrieval_score" in results[0]
    assert "reranker_score" in results[0]
    assert results[0]["reranker_score"] > 0.0

def test_query_expansion_contains_scientific_keywords():
    expansions = hybrid_retriever._expand_query("hallucination mitigation in agentic workflows")
    assert len(expansions) >= 2
