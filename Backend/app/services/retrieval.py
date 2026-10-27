"""Hybrid retrieval with cross-encoder reranking and optional calibrated threshold.

Pipeline (the original BM25 + dense + fusion architecture is preserved; the
fusion stage is now a true Reciprocal Rank Fusion and the reranking stage uses
a real cross-encoder instead of a heuristic score):

    User Query
        -> BM25 keyword ranking  +  Dense embedding ranking
        -> Reciprocal Rank Fusion (RRF, k=60)
        -> Candidate selection (configurable cap, per-paper diversity cap)
        -> Cross-encoder reranking (candidates only, never the full corpus)
        -> Optional calibrated relevance threshold (RESEARCHPILOT_MIN_RERANKER_SCORE)
        -> Final ranked results (top_k)

Models are loaded lazily on first use (never at import time), cached per model
name process-wide, and inference is batched. If the embedding model cannot be
loaded the dense stage falls back to the original lexical-overlap scorer and
results are tagged with `embedding_backend: "lexical_fallback"`. If the
cross-encoder cannot be loaded or fails, results are returned ranked by RRF
with `reranked: False` and an explicit `reranker_error` message - scores are
never fabricated.
"""

import asyncio
import hashlib
import logging
import math
import re
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.core.config import settings
from app.services.corpus import PRELOADED_PAPERS

logger = logging.getLogger("researchpilot.retrieval")

# Standard Reciprocal Rank Fusion constant (Cormack et al. 2009).
RRF_K = 60

# Legacy required result fields. Everything below must remain present in every
# result dict returned by search() so existing callers keep working.
LEGACY_RESULT_FIELDS = (
    "chunk_id", "doc_id", "title", "authors", "identifier",
    "publication_year", "venue", "passage_text", "chunk_index",
    "retrieval_score", "reranker_score", "timestamp",
)


class RerankerUnavailableError(RuntimeError):
    """Raised when the cross-encoder model cannot be loaded or inference fails."""


def tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", text.lower())


def _lexical_dense_score(query: str, chunk_text: str) -> float:
    """Original dense-stage heuristic (multi-token overlap + domain weighting).

    Kept as the offline fallback for the dense stage when the embedding model
    is unavailable. This is a lexical approximation, not a neural embedding.
    """
    q_toks = set(tokenize(query))
    c_toks = set(tokenize(chunk_text))
    if not q_toks or not c_toks:
        return 0.0

    overlap = len(q_toks.intersection(c_toks))
    jaccard = overlap / len(q_toks.union(c_toks))

    domain_keywords = [
        "hallucination", "rag", "verification", "claim", "provenance",
        "experiment", "reproducibility", "baseline", "metric", "agent",
        "benchmark", "evidence",
    ]
    bonus = sum(0.15 for kw in domain_keywords if kw in q_toks and kw in c_toks)

    return min(1.0, jaccard * 1.8 + bonus)


def _sigmoid(x: float) -> float:
    """Numerically safe logistic transform.

    Used ONLY as a display transform of raw cross-encoder scores. The result
    is a transformed model score, NOT a calibrated relevance probability.
    """
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


class CrossEncoderReranker:
    """Lazy, thread-safe cross-encoder wrapper shared process-wide.

    The model is loaded on first use, never at import time. One loaded model
    is cached per model name so repeated queries (and the calibration script)
    do not reload weights. Loading or inference failures raise
    RerankerUnavailableError with the underlying cause attached.
    """

    _loaded_models: Dict[str, Any] = {}
    _load_errors: Dict[str, str] = {}
    _lock = threading.Lock()

    def __init__(self, model_name: Optional[str] = None, batch_size: Optional[int] = None):
        self.model_name = model_name or settings.RERANKER_MODEL
        self.batch_size = batch_size or settings.RERANKER_BATCH_SIZE

    def _load(self) -> None:
        """Load the model once per process. Raises RerankerUnavailableError on failure."""
        if self.model_name in CrossEncoderReranker._loaded_models:
            return
        if self.model_name in CrossEncoderReranker._load_errors:
            raise RerankerUnavailableError(CrossEncoderReranker._load_errors[self.model_name])
        with CrossEncoderReranker._lock:
            if self.model_name in CrossEncoderReranker._loaded_models:
                return
            if self.model_name in CrossEncoderReranker._load_errors:
                raise RerankerUnavailableError(CrossEncoderReranker._load_errors[self.model_name])
            try:
                from sentence_transformers import CrossEncoder  # deferred import
                logger.info("Loading cross-encoder reranker model '%s'...", self.model_name)
                model = CrossEncoder(self.model_name, max_length=512)
            except Exception as exc:  # download error, missing dep, bad model name...
                message = (
                    f"Failed to load cross-encoder reranker '{self.model_name}': {exc}. "
                    "Reranking is unavailable; results fall back to RRF ranking. "
                    "Check that sentence-transformers is installed and the model "
                    "name is correct and reachable (HuggingFace download)."
                )
                logger.error("%s", message)
                CrossEncoderReranker._load_errors[self.model_name] = message
                raise RerankerUnavailableError(message) from exc
            CrossEncoderReranker._loaded_models[self.model_name] = model
            logger.info("Cross-encoder reranker '%s' loaded.", self.model_name)

    @property
    def is_available(self) -> bool:
        return self.model_name in CrossEncoderReranker._loaded_models

    def score(self, query: str, passages: List[str]) -> List[float]:
        """Score (query, passage) pairs. Returns RAW model scores (logits).

        The raw score representation is canonical: it is what threshold
        filtering and the calibration workflow both use.
        """
        if not passages:
            return []
        self._load()
        model = CrossEncoderReranker._loaded_models[self.model_name]
        try:
            pairs = [[query, p] for p in passages]
            predictions = model.predict(pairs, batch_size=self.batch_size)
            return [float(s) for s in np.asarray(predictions).reshape(-1)]
        except Exception as exc:
            message = (
                f"Cross-encoder inference failed for model '{self.model_name}': {exc}. "
                "No reranker scores were produced; falling back to RRF ranking."
            )
            logger.error("%s", message)
            raise RerankerUnavailableError(message) from exc


class DenseEmbedder:
    """Lazy sentence-transformer embedder for the dense retrieval stage.

    Embeddings are cached keyed by the SHA-256 of the text, so a cache entry
    can never go stale when the corpus changes: a changed chunk is a different
    text and therefore a different key. Ingesting papers therefore invalidates
    nothing and pre-computes nothing incorrectly - new chunks simply produce
    new cache keys. `clear_caches()` wipes the cache explicitly.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self._model: Any = None
        self._load_attempted = False
        self._load_error: Optional[str] = None
        self._cache: Dict[str, np.ndarray] = {}
        self._lock = threading.Lock()
        self.stats = {"cache_hits": 0, "cache_misses": 0}

    @property
    def backend_name(self) -> str:
        return "minilm" if self._model is not None else "lexical_fallback"

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    def _ensure_model(self) -> bool:
        """Try to load the embedding model once. Returns True if available."""
        if self._model is not None:
            return True
        if self._load_error is not None:
            return False
        with self._lock:
            if self._model is not None:
                return True
            if self._load_error is not None:
                return False
            try:
                from sentence_transformers import SentenceTransformer  # deferred import
                logger.info("Loading dense embedding model '%s'...", self.model_name)
                self._model = SentenceTransformer(self.model_name)
                logger.info("Dense embedding model '%s' loaded.", self.model_name)
                return True
            except Exception as exc:
                self._load_error = (
                    f"Failed to load embedding model '{self.model_name}': {exc}. "
                    "Dense retrieval falls back to the lexical-overlap scorer."
                )
                logger.warning("%s", self._load_error)
                return False

    def _text_key(self, text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """Embed texts with caching. Returns an (n, d) L2-normalized array."""
        keys = [self._text_key(t) for t in texts]
        missing = [i for i, k in enumerate(keys) if k not in self._cache]
        if missing:
            new_texts = [texts[i] for i in missing]
            if self._ensure_model():
                vectors = self._model.encode(
                    new_texts, batch_size=32, convert_to_numpy=True,
                    normalize_embeddings=True, show_progress_bar=False,
                )
                for idx, vec in zip(missing, vectors):
                    self._cache[keys[idx]] = np.asarray(vec, dtype=np.float32)
                self.stats["cache_misses"] += len(missing)
            else:
                # Fallback mode: no vectors stored; callers use lexical scores.
                return np.zeros((len(texts), 1), dtype=np.float32)
        self.stats["cache_hits"] += len(keys) - len(missing)
        if self._model is None:
            return np.zeros((len(texts), 1), dtype=np.float32)
        return np.stack([self._cache[k] for k in keys])

    def dense_scores(self, query: str, chunk_texts: List[str]) -> List[float]:
        """Cosine similarity between the query and each chunk text.

        Uses real embeddings when available; otherwise falls back to the
        original lexical-overlap heuristic so the pipeline still functions
        offline (clearly reported via `embedding_backend`).
        """
        if not chunk_texts:
            return []
        if not self._ensure_model():
            return [_lexical_dense_score(query, t) for t in chunk_texts]
        q_vec = self.embed_texts([query])[0]
        c_vecs = self.embed_texts(chunk_texts)
        if c_vecs.shape[1] == 1:  # pragma: no cover - defensive
            return [_lexical_dense_score(query, t) for t in chunk_texts]
        return [float(np.dot(q_vec, c_vec)) for c_vec in c_vecs]

    def clear_caches(self) -> None:
        with self._lock:
            self._cache.clear()
            self.stats = {"cache_hits": 0, "cache_misses": 0}


class HybridRetriever:
    def __init__(self, papers: Optional[List[Dict[str, Any]]] = None):
        # Copy on init: each retriever owns its corpus. Aliasing the module
        # constant would let live-fallback ingestion in one instance (e.g. the
        # global singleton) mutate the shared PRELOADED_PAPERS list and leak
        # papers into every other instance. `papers=[]` constructs a genuinely
        # empty index; only None falls back to the preloaded corpus.
        self.papers = list(papers) if papers is not None else list(PRELOADED_PAPERS)
        self.chunks_index: List[Dict[str, Any]] = []
        self._reranker = CrossEncoderReranker()
        self._embedder = DenseEmbedder()
        self._build_index()

    # ── Index construction ───────────────────────────────────────────────

    def _build_index(self):
        self.chunks_index = []
        doc_count = 0
        all_terms = set()

        for paper in self.papers:
            doc_count += 1
            for idx, ch in enumerate(paper.get("chunks", [])):
                tokens = tokenize(ch["text"])
                term_freqs: Dict[str, int] = {}
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
        self.idf: Dict[str, float] = {}
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

    # ── RRF fusion ───────────────────────────────────────────────────────

    @staticmethod
    def _ranked_ids(scores: List[float], chunk_ids: List[str]) -> List[str]:
        """Return chunk_ids ordered by descending score (stable, deterministic)."""
        order = sorted(range(len(scores)), key=lambda i: (-scores[i], chunk_ids[i]))
        return [chunk_ids[i] for i in order]

    @staticmethod
    def _rrf_fuse(
        bm25_ranking: List[str],
        dense_ranking: List[str],
        hybrid_weight: float = 0.5,
        k: int = RRF_K,
    ) -> Dict[str, float]:
        """Weighted Reciprocal Rank Fusion over the two rankings.

        rrf(d) = (1 - w) * 1/(k + rank_bm25(d)) + w * 1/(k + rank_dense(d))

        With the default hybrid_weight=0.5 this is exactly standard RRF.
        Documents absent from a ranking receive no contribution from it.
        """
        w = min(1.0, max(0.0, hybrid_weight))
        fused: Dict[str, float] = {}
        for rank, cid in enumerate(bm25_ranking, start=1):
            fused[cid] = fused.get(cid, 0.0) + (1.0 - w) / (k + rank)
        for rank, cid in enumerate(dense_ranking, start=1):
            fused[cid] = fused.get(cid, 0.0) + w / (k + rank)
        return fused

    # ── Reranking helpers ────────────────────────────────────────────────

    @staticmethod
    def _apply_per_paper_cap(candidates: List[Dict[str, Any]], cap: Optional[int]) -> List[Dict[str, Any]]:
        """Greedily keep candidates in order while enforcing a per-paper chunk cap."""
        if not cap or cap < 1:
            return list(candidates)
        kept: List[Dict[str, Any]] = []
        per_doc: Dict[str, int] = {}
        for cand in candidates:
            doc_id = cand["doc_id"]
            if per_doc.get(doc_id, 0) >= cap:
                continue
            per_doc[doc_id] = per_doc.get(doc_id, 0) + 1
            kept.append(cand)
        return kept

    def _rerank_candidates(
        self, query: str, candidates: List[Dict[str, Any]]
    ) -> Tuple[List[Optional[float]], Optional[str]]:
        """Score candidates with the cross-encoder.

        Returns (scores, error). On success scores are raw logits aligned with
        candidates; on failure every score is None and error describes what
        went wrong. Scores are never fabricated.
        """
        try:
            logits = self._reranker.score(query, [c["text"] for c in candidates])
            return [float(s) for s in logits], None
        except RerankerUnavailableError as exc:
            return [None] * len(candidates), str(exc)
        except Exception as exc:  # unexpected inference failure - be explicit
            message = f"Unexpected reranker failure: {exc}"
            logger.exception("Unexpected reranker failure")
            return [None] * len(candidates), message

    # ── Public API ───────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        top_k: int = 5,
        hybrid_weight: float = 0.5,
        *,
        rerank: Optional[bool] = None,
        min_score: Optional[float] = None,
        rerank_candidates: Optional[int] = None,
        max_per_paper: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Hybrid retrieval with RRF fusion, cross-encoder reranking, and an
        optional calibrated relevance threshold.

        Backward-compatible signature: `query`, `top_k`, `hybrid_weight` keep
        their original meaning (hybrid_weight now weights the two rankings in
        the RRF fusion; 0.5 = standard RRF). New behaviour is controlled by
        keyword-only arguments and environment configuration:

        - rerank: None -> follow RESEARCHPILOT_RERANKER_ENABLED; False disables
          reranking for this call (results ranked by RRF only); True forces an
          attempt.
        - min_score: None -> follow RESEARCHPILOT_MIN_RERANKER_SCORE (which is
          itself unset by default, i.e. no threshold filtering). When a
          threshold is active, only candidates whose RAW reranker score is
          >= min_score are returned, before the top_k slice. The threshold is
          applied ONLY to genuinely reranked results: degraded fallback
          results (RRF-ordered) are never filtered against a reranker-score
          threshold because RRF scores are not comparable to model logits.
        - rerank_candidates: candidate-set size (default RESEARCHPILOT_RERANKER_CANDIDATES).
        - max_per_paper: per-paper chunk cap (default RESEARCHPILOT_RERANKER_MAX_PER_PAPER).

        Empty/whitespace queries return []: with no query terms there are no
        BM25 or dense rankings to fuse, and returning arbitrary documents
        would be misleading.

        Result fields: all legacy fields (chunk_id, doc_id, title, authors,
        identifier, publication_year, venue, passage_text, chunk_index,
        retrieval_score, reranker_score, timestamp) remain. `retrieval_score`
        now carries the fused RRF score and `reranker_score` the raw
        cross-encoder logit (None when reranking is unavailable). Additional
        fields: bm25_rank, dense_rank, rrf_rank, reranker_probability
        (sigmoid-transformed score for DISPLAY ONLY - not a calibrated
        relevance probability), reranked, reranker_model, embedding_backend,
        and reranker_error (present only when a reranking attempt failed).
        """
        if not query or not query.strip():
            return []
        if not self.chunks_index:
            return []

        # Stage 1-2: BM25 and dense rankings over the corpus (never reranked at
        # this stage; the reranker only ever sees the fused candidate set).
        expanded_queries = self._expand_query(query)
        all_query_tokens: List[str] = []
        for eq in expanded_queries:
            all_query_tokens.extend(tokenize(eq))
        all_query_tokens = list(set(all_query_tokens))

        chunk_ids = [c["chunk_id"] for c in self.chunks_index]
        bm25_scores = [self._bm25_score(all_query_tokens, c) for c in self.chunks_index]
        dense_scores = self._embedder.dense_scores(
            query, [c["text"] for c in self.chunks_index]
        )

        bm25_ranking = self._ranked_ids(bm25_scores, chunk_ids)
        dense_ranking = self._ranked_ids(dense_scores, chunk_ids)

        # Stage 3: Reciprocal Rank Fusion.
        fused = self._rrf_fuse(bm25_ranking, dense_ranking, hybrid_weight=hybrid_weight)
        bm25_rank = {cid: r for r, cid in enumerate(bm25_ranking, start=1)}
        dense_rank = {cid: r for r, cid in enumerate(dense_ranking, start=1)}
        fused_ranking = sorted(fused, key=lambda cid: (-fused[cid], cid))

        # Stage 4: candidate selection (broad set, per-paper diversity cap).
        n_candidates = rerank_candidates if rerank_candidates is not None else settings.RERANKER_CANDIDATES
        cap = max_per_paper if max_per_paper is not None else settings.RERANKER_MAX_PER_PAPER
        doc_by_chunk = {c["chunk_id"]: c["doc_id"] for c in self.chunks_index}
        candidate_ids = self._apply_per_paper_cap(
            [{"chunk_id": cid, "doc_id": doc_by_chunk[cid]} for cid in fused_ranking], cap
        )[: max(0, n_candidates)]
        candidate_id_set = {c["chunk_id"] for c in candidate_ids}

        by_id = {c["chunk_id"]: c for c in self.chunks_index}
        candidates = [by_id[cid] for cid in fused_ranking if cid in candidate_id_set]

        # Stage 5: cross-encoder reranking of the candidate set only.
        do_rerank = settings.RERANKER_ENABLED if rerank is None else bool(rerank)
        reranker_scores: List[Optional[float]] = [None] * len(candidates)
        reranker_error: Optional[str] = None
        reranked = False
        if do_rerank and candidates:
            reranker_scores, reranker_error = self._rerank_candidates(
                query, candidates
            )
            reranked = all(s is not None for s in reranker_scores) and len(candidates) > 0
            if reranked:
                reranker_error = None

        # Stage 6: ordering. Reranked -> descending raw reranker score; degraded
        # -> RRF order (explicitly flagged, never dressed up as reranker output).
        timestamp = datetime.utcnow().isoformat() + "Z"
        results: List[Dict[str, Any]] = []
        for pos, (cand, rs) in enumerate(zip(candidates, reranker_scores)):
            cid = cand["chunk_id"]
            item = {
                "chunk_id": cid,
                "doc_id": cand["doc_id"],
                "title": cand["title"],
                "authors": cand["authors"],
                "identifier": cand["identifier"],
                "publication_year": cand["publication_year"],
                "venue": cand["venue"],
                "passage_text": cand["text"],
                "chunk_index": cand["chunk_index"],
                "retrieval_score": round(float(fused[cid]), 6),
                "reranker_score": (round(float(rs), 4) if rs is not None else None),
                "bm25_rank": bm25_rank.get(cid),
                "dense_rank": dense_rank.get(cid),
                "rrf_rank": pos + 1,
                "reranker_probability": (round(_sigmoid(float(rs)), 6) if rs is not None else None),
                "reranked": reranked,
                "reranker_model": (self._reranker.model_name if reranked else None),
                "embedding_backend": self._embedder.backend_name,
                "timestamp": timestamp,
            }
            if reranker_error is not None:
                item["reranker_error"] = reranker_error
            results.append(item)

        if reranked:
            results.sort(key=lambda r: (-(r["reranker_score"] or 0.0), r["rrf_rank"]))
            for i, r in enumerate(results, start=1):
                r["rrf_rank"] = i  # now the post-rerank rank of the candidate
        else:
            if do_rerank and reranker_error:
                logger.warning("Reranking degraded to RRF ordering: %s", reranker_error)

        # Stage 7: calibrated relevance threshold (only on genuine reranker scores).
        threshold = min_score if min_score is not None else settings.MIN_RERANKER_SCORE
        if threshold is not None and reranked:
            before = len(results)
            results = [r for r in results if r["reranker_score"] is not None
                       and r["reranker_score"] >= threshold]
            filtered = before - len(results)
            if filtered:
                logger.info(
                    "Relevance threshold %.4f filtered %d of %d candidates",
                    threshold, filtered, before,
                )

        # Stage 8: final top_k slice (top_k counts only threshold-passing results).
        return results[:top_k]

    async def search_with_live_fallback(
        self,
        query: str,
        top_k: int = 5,
        fetch_external: bool = True,
        max_external_per_source: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Retrieves passages using local BM25 + dense index.
        If fetch_external is True, concurrently queries Semantic Scholar, OpenAlex,
        and Crossref, dynamically ingesting latest papers into the retrieval index.
        Model inference runs in a worker thread so the event loop stays responsive.
        """
        if fetch_external:
            try:
                from app.services.paper_fetcher import paper_aggregator
                external_res = await paper_aggregator.search(query=query, limit_per_source=max_external_per_source)
                fetched_papers = external_res.get("papers", [])
                if fetched_papers:
                    self.ingest_papers(fetched_papers)
            except Exception:
                # Retain robustness if external APIs fail
                pass

        return await asyncio.to_thread(self.search, query=query, top_k=top_k)

    def ingest_papers(self, new_papers: List[Dict[str, Any]]) -> int:
        """Ingests external papers into the active retriever index.

        The embedding cache is keyed by text hash, so ingested chunks are
        embedded on first use and existing embeddings stay valid; no stale
        vectors can be served after the corpus changes.
        """
        existing_ids = {p.get("id") for p in self.papers}
        existing_titles = {p.get("title", "").strip().lower() for p in self.papers}

        ingested_count = 0
        for p in new_papers:
            p_id = p.get("id")
            p_title = p.get("title", "").strip().lower()
            if p_id in existing_ids or p_title in existing_titles:
                continue

            # Ensure chunks exist
            if not p.get("chunks"):
                from app.services.paper_fetcher import split_into_chunks
                body = p.get("abstract") or f"{p.get('title')}. {p.get('venue')}, {p.get('publication_year')}."
                p["chunks"] = [
                    {"chunk_id": f"{p_id}_ch_{c_idx}", "text": c_text, "chunk_index": c_idx}
                    for c_idx, c_text in enumerate(split_into_chunks(body))
                ]

            self.papers.append(p)
            existing_ids.add(p_id)
            existing_titles.add(p_title)
            ingested_count += 1

        if ingested_count > 0:
            self._build_index()

        return ingested_count

    def get_all_papers(self) -> List[Dict[str, Any]]:
        return list(self.papers)

    # ── Diagnostics & maintenance ────────────────────────────────────────

    def reranker_status(self) -> Dict[str, Any]:
        """Diagnostic info about model availability (safe to expose via APIs)."""
        return {
            "reranker_model": self._reranker.model_name,
            "reranker_enabled": settings.RERANKER_ENABLED,
            "reranker_loaded": self._reranker.is_available,
            "embedding_model": self._embedder.model_name,
            "embedding_backend": self._embedder.backend_name,
            "embedding_load_error": self._embedder.load_error,
            "threshold": settings.MIN_RERANKER_SCORE,
            "embedding_cache_entries": len(self._embedder._cache),
        }

    def clear_caches(self) -> None:
        """Explicitly invalidate cached embeddings (e.g. after bulk corpus swaps)."""
        self._embedder.clear_caches()


# Global singleton
hybrid_retriever = HybridRetriever()
