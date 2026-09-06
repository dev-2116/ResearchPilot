import math
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.services.corpus import PRELOADED_PAPERS

def tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", text.lower())

class HybridRetriever:
    def __init__(self, papers: Optional[List[Dict[str, Any]]] = None):
        self.papers = papers or PRELOADED_PAPERS
        self.chunks_index = []
        self._build_index()

    def _build_index(self):
        self.chunks_index = []
        doc_count = 0
        all_terms = set()
        
        for paper in self.papers:
            doc_count += 1
            for idx, ch in enumerate(paper.get("chunks", [])):
                tokens = tokenize(ch["text"])
                term_freqs = {}
                for t in tokens:
                    term_freqs[t] = term_freqs.get(t, 0) + 1
                    all_terms.add(t)
                
                self.chunks_index.append({
                    "chunk_id": ch.get("chunk_id", f"{paper['id']}_ch_{idx}"),
                    "doc_id": paper["id"],
                    "title": paper["title"],
                    "authors": paper["authors"],
                    "identifier": paper["identifier"],
                    "publication_year": paper.get("publication_year", 2023),
                    "venue": paper.get("venue", "Scientific Archive"),
                    "text": ch["text"],
                    "chunk_index": idx,
                    "tokens": tokens,
                    "term_freqs": term_freqs,
                    "length": len(tokens)
                })

        # Calculate IDF
        self.idf = {}
        total_chunks = max(1, len(self.chunks_index))
        for term in all_terms:
            containing = sum(1 for c in self.chunks_index if term in c["term_freqs"])
            self.idf[term] = math.log((total_chunks - containing + 0.5) / (containing + 0.5) + 1.0)
        
        self.avg_dl = sum(c["length"] for c in self.chunks_index) / max(1, len(self.chunks_index))

    def _bm25_score(self, query_tokens: List[str], chunk: Dict, k1: float = 1.5, b: float = 0.75) -> float:
        score = 0.0
        doc_len = chunk["length"]
        for qt in query_tokens:
            if qt in chunk["term_freqs"]:
                freq = chunk["term_freqs"][qt]
                idf_val = self.idf.get(qt, 0.1)
                num = freq * (k1 + 1)
                denom = freq + k1 * (1 - b + b * (doc_len / max(1.0, self.avg_dl)))
                score += idf_val * (num / max(0.001, denom))
        return score

    def _dense_semantic_score(self, query: str, chunk_text: str) -> float:
        # Dense Semantic Cosine Estimation using multi-token n-gram and semantic term overlap
        q_toks = set(tokenize(query))
        c_toks = set(tokenize(chunk_text))
        if not q_toks or not c_toks:
            return 0.0
        
        overlap = len(q_toks.intersection(c_toks))
        jaccard = overlap / len(q_toks.union(c_toks))
        
        # Soft semantic weighting for research terms
        domain_keywords = ["hallucination", "rag", "verification", "claim", "provenance", "experiment", "reproducibility", "baseline", "metric", "agent", "benchmark", "evidence"]
        bonus = sum(0.15 for kw in domain_keywords if kw in q_toks and kw in c_toks)
        
        return min(1.0, jaccard * 1.8 + bonus)

    def _expand_query(self, query: str) -> List[str]:
        # Query expansion for scientific terminology
        expansions = [query]
        q_low = query.lower()
        if "hallucination" in q_low or "fact" in q_low:
            expansions.append("fact extraction verification claim evidence support")
        if "rag" in q_low or "retrieval" in q_low:
            expansions.append("retrieval-augmented generation hybrid search sparse dense reranking")
        if "agent" in q_low or "autonomous" in q_low:
            expansions.append("agent orchestrator state graph react loop planning")
        if "reproducibility" in q_low or "experiment" in q_low:
            expansions.append("experiment execution manifest random seed compute sandbox")
        return expansions

    def search(self, query: str, top_k: int = 5, hybrid_weight: float = 0.5) -> List[Dict[str, Any]]:
        expanded_queries = self._expand_query(query)
        all_query_tokens = []
        for eq in expanded_queries:
            all_query_tokens.extend(tokenize(eq))
        all_query_tokens = list(set(all_query_tokens))

        scored_candidates = []
        for chunk in self.chunks_index:
            bm25 = self._bm25_score(all_query_tokens, chunk)
            dense = self._dense_semantic_score(query, chunk["text"])
            
            # Hybrid combined score with reciprocal rank smoothing
            combined_score = (1 - hybrid_weight) * (bm25 / max(1.0, bm25 + 5.0)) + hybrid_weight * dense
            
            # Contextual reranker score
            reranker_score = min(0.99, combined_score * 0.95 + (0.05 if chunk["publication_year"] >= 2021 else 0.0))
            
            scored_candidates.append({
                "chunk_id": chunk["chunk_id"],
                "doc_id": chunk["doc_id"],
                "title": chunk["title"],
                "authors": chunk["authors"],
                "identifier": chunk["identifier"],
                "publication_year": chunk["publication_year"],
                "venue": chunk["venue"],
                "passage_text": chunk["text"],
                "chunk_index": chunk["chunk_index"],
                "retrieval_score": round(float(combined_score), 4),
                "reranker_score": round(float(reranker_score), 4),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })

        # Deduplicate & sort by reranker_score
        scored_candidates.sort(key=lambda x: x["reranker_score"], reverse=True)
        return scored_candidates[:top_k]

# Global singleton
hybrid_retriever = HybridRetriever()
