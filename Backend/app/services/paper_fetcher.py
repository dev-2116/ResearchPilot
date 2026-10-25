"""
Academic Literature Fetcher & Aggregator
Integrates:
  1. Semantic Scholar API (S2 Graph)
  2. OpenAlex API
  3. Crossref API
Provides normalized academic metadata, abstract reconstruction, deduplication,
and chunking for the ResearchPilot RAG and verification pipeline.
"""
import asyncio
import html
import re
import uuid
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings

USER_AGENT = "ResearchPilot/1.0 (https://github.com/dev-2116/ResearchPilot; mailto:dev@researchpilot.io)"
REQUEST_TIMEOUT = 8.0  # seconds per external API


def clean_text(raw: Optional[str]) -> str:
    """Strip XML/HTML tags, decode entities, and normalize unicode punctuation."""
    if not raw:
        return ""
    # Strip JATS or HTML tags
    cleaned = re.sub(r"<[^>]+>", " ", raw)
    cleaned = html.unescape(cleaned)
    # Normalize unicode hyphens/dashes and quotes
    cleaned = cleaned.replace("\u2010", "-").replace("\u2011", "-").replace("\u2012", "-").replace("\u2013", "-").replace("\u2014", "-")
    cleaned = cleaned.replace("\u2018", "'").replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"\s+", " ", cleaned).strip()


def reconstruct_openalex_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> str:
    """Reconstruct full text abstract from OpenAlex's abstract_inverted_index."""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    words_by_pos = {}
    for word, positions in inverted_index.items():
        for pos in positions:
            words_by_pos[pos] = word
    if not words_by_pos:
        return ""
    sorted_positions = sorted(words_by_pos.keys())
    return " ".join(words_by_pos[p] for p in sorted_positions)


def normalize_title(title: str) -> str:
    """Normalize paper title for fuzzy deduplication."""
    return re.sub(r"[^\w\s]", "", title.lower()).strip()


def split_into_chunks(text: str, chunk_size_words: int = 140, overlap: int = 30) -> List[str]:
    """Break text into overlapping sentence-aware chunks for indexing and RAG."""
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current_words: List[str] = []

    for sentence in sentences:
        words = sentence.split()
        if not words:
            continue
        if len(current_words) + len(words) > chunk_size_words and current_words:
            chunks.append(" ".join(current_words))
            # retain overlap words
            current_words = current_words[-overlap:] + words
        else:
            current_words.extend(words)

    if current_words:
        chunks.append(" ".join(current_words))

    return chunks if chunks else [text]


class SemanticScholarFetcher:
    """Fetches papers from the Semantic Scholar Academic Graph API."""

    BASE_URL = "https://api.semanticscholar.org/graph/v1/paper/search"

    @classmethod
    async def search(cls, query: str, limit: int = 5, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        headers = {"User-Agent": USER_AGENT}
        key = api_key or getattr(settings, "SEMANTIC_SCHOLAR_API_KEY", "") or ""
        if key:
            headers["x-api-key"] = key

        params = {
            "query": query,
            "limit": limit,
            "fields": "paperId,title,abstract,authors,year,venue,citationCount,externalIds,url,openAccessPdf"
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT, headers=headers) as client:
                resp = await client.get(cls.BASE_URL, params=params)
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    papers = []
                    for item in data:
                        title = item.get("title")
                        if not title:
                            continue
                        paper_id = item.get("paperId", uuid.uuid4().hex[:12])
                        authors = ", ".join(a.get("name", "") for a in item.get("authors", []) if a.get("name"))
                        ext_ids = item.get("externalIds") or {}
                        doi = ext_ids.get("DOI") or ext_ids.get("ArXiv") or ""
                        identifier = f"DOI:{doi}" if doi and not doi.startswith("10.") else (doi or f"S2:{paper_id[:10]}")
                        pdf_url = (item.get("openAccessPdf") or {}).get("url") or item.get("url") or ""
                        abstract = clean_text(item.get("abstract") or "")

                        papers.append({
                            "id": f"s2_{paper_id[:12]}",
                            "title": clean_text(title),
                            "authors": authors or "Unknown Authors",
                            "publication_year": item.get("year") or 2023,
                            "venue": item.get("venue") or "Semantic Scholar Archive",
                            "abstract": abstract,
                            "identifier": identifier,
                            "url": pdf_url,
                            "citation_count": item.get("citationCount") or 0,
                            "source": "Semantic Scholar",
                            "source_id": paper_id
                        })
                    return papers
                elif resp.status_code == 429:
                    # Gracefully handle rate limit
                    return []
                return []
        except Exception:
            return []


class OpenAlexFetcher:
    """Fetches papers from the OpenAlex open catalog (no API key required)."""

    BASE_URL = "https://api.openalex.org/works"

    @classmethod
    async def search(cls, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        headers = {"User-Agent": USER_AGENT}
        params = {
            "search": query,
            "per-page": limit,
            "sort": "relevance_score:desc"
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT, headers=headers) as client:
                resp = await client.get(cls.BASE_URL, params=params)
                if resp.status_code == 200:
                    data = resp.json().get("results", [])
                    papers = []
                    for item in data:
                        title = item.get("title") or item.get("display_name")
                        if not title:
                            continue
                        work_id = (item.get("id") or "").replace("https://openalex.org/", "") or uuid.uuid4().hex[:10]
                        authorships = item.get("authorships") or []
                        author_names = []
                        for a in authorships:
                            author_obj = a.get("author") or {}
                            if author_obj.get("display_name"):
                                author_names.append(author_obj["display_name"])
                        authors = ", ".join(author_names[:5])
                        if len(author_names) > 5:
                            authors += " et al."

                        # Extract abstract from inverted index
                        raw_abstract = reconstruct_openalex_abstract(item.get("abstract_inverted_index"))
                        abstract = clean_text(raw_abstract)

                        # Primary location (venue / URL)
                        loc = item.get("primary_location") or {}
                        src = loc.get("source") or {}
                        venue = src.get("display_name") or "OpenAlex Index"
                        pdf_url = loc.get("pdf_url") or loc.get("landing_page_url") or item.get("doi") or ""

                        doi = item.get("doi") or ""
                        identifier = doi.replace("https://doi.org/", "DOI:") if doi else f"OpenAlex:{work_id}"

                        papers.append({
                            "id": f"oa_{work_id[:12]}",
                            "title": clean_text(title),
                            "authors": authors or "Unknown Authors",
                            "publication_year": item.get("publication_year") or 2023,
                            "venue": venue,
                            "abstract": abstract,
                            "identifier": identifier,
                            "url": pdf_url,
                            "citation_count": item.get("cited_by_count") or 0,
                            "source": "OpenAlex",
                            "source_id": work_id
                        })
                    return papers
                return []
        except Exception:
            return []


class CrossrefFetcher:
    """Fetches papers and DOI metadata from Crossref."""

    BASE_URL = "https://api.crossref.org/works"

    @classmethod
    async def search(cls, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        headers = {"User-Agent": USER_AGENT}
        params = {
            "query.bibliographic": query,
            "rows": limit,
            "sort": "relevance"
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT, headers=headers) as client:
                resp = await client.get(cls.BASE_URL, params=params)
                if resp.status_code == 200:
                    items = resp.json().get("message", {}).get("items", [])
                    papers = []
                    for item in items:
                        titles = item.get("title") or []
                        title = titles[0] if titles else None
                        if not title:
                            continue

                        # Authors
                        author_list = item.get("author") or []
                        author_names = []
                        for a in author_list:
                            given = a.get("given", "").strip()
                            family = a.get("family", "").strip()
                            name = f"{given} {family}".strip()
                            if name:
                                author_names.append(name)
                        authors = ", ".join(author_names[:5])
                        if len(author_names) > 5:
                            authors += " et al."

                        # Year
                        year = None
                        for year_key in ["published-print", "published-online", "issued", "created"]:
                            parts = (item.get(year_key) or {}).get("date-parts", [[]])[0]
                            if parts:
                                year = parts[0]
                                break

                        # Venue
                        containers = item.get("container-title") or []
                        venue = containers[0] if containers else (item.get("publisher") or "Crossref Publisher")

                        doi = item.get("DOI") or ""
                        identifier = f"DOI:{doi}" if doi else f"Crossref:{uuid.uuid4().hex[:8]}"
                        url = item.get("URL") or (f"https://doi.org/{doi}" if doi else "")
                        abstract = clean_text(item.get("abstract") or "")

                        papers.append({
                            "id": f"cr_{uuid.uuid4().hex[:8]}",
                            "title": clean_text(title),
                            "authors": authors or "Unknown Authors",
                            "publication_year": year or 2023,
                            "venue": venue,
                            "abstract": abstract,
                            "identifier": identifier,
                            "url": url,
                            "citation_count": item.get("is-referenced-by-count") or 0,
                            "source": "Crossref",
                            "source_id": doi or identifier
                        })
                    return papers
                return []
        except Exception:
            return []


class MultiSourcePaperAggregator:
    """
    Coordinates simultaneous queries to Semantic Scholar, OpenAlex, and Crossref,
    deduplicating and normalizing results into high-quality research candidates.
    """

    @classmethod
    async def search(
        cls,
        query: str,
        sources: Optional[List[str]] = None,
        limit_per_source: int = 5
    ) -> Dict[str, Any]:
        target_sources = [s.lower() for s in (sources or ["semanticscholar", "openalex", "crossref"])]

        tasks = []
        source_names = []

        if "semanticscholar" in target_sources or "semantic_scholar" in target_sources or "s2" in target_sources:
            tasks.append(SemanticScholarFetcher.search(query, limit=limit_per_source))
            source_names.append("Semantic Scholar")

        if "openalex" in target_sources or "oa" in target_sources:
            tasks.append(OpenAlexFetcher.search(query, limit=limit_per_source))
            source_names.append("OpenAlex")

        if "crossref" in target_sources or "cr" in target_sources:
            tasks.append(CrossrefFetcher.search(query, limit=limit_per_source))
            source_names.append("Crossref")

        results = await asyncio.gather(*tasks, return_exceptions=True)

        combined_papers: List[Dict[str, Any]] = []
        source_counts: Dict[str, int] = {}

        for idx, res in enumerate(results):
            s_name = source_names[idx]
            if isinstance(res, list):
                source_counts[s_name] = len(res)
                combined_papers.extend(res)
            else:
                source_counts[s_name] = 0

        # Fuzzy deduplication by normalized title
        seen_titles = set()
        deduped_papers = []

        for paper in combined_papers:
            norm_t = normalize_title(paper["title"])
            if len(norm_t) < 5 or norm_t in seen_titles:
                continue
            seen_titles.add(norm_t)

            # Generate chunks for downstream RAG indexing
            body_text = paper["abstract"] if paper["abstract"] else f"{paper['title']}. {paper['venue']}, {paper['publication_year']}."
            raw_chunks = split_into_chunks(body_text)
            chunks = []
            for c_idx, c_text in enumerate(raw_chunks):
                chunks.append({
                    "chunk_id": f"{paper['id']}_ch_{c_idx}",
                    "text": c_text,
                    "chunk_index": c_idx
                })
            paper["chunks"] = chunks
            deduped_papers.append(paper)

        # Sort: Papers with abstracts and higher citations first
        deduped_papers.sort(
            key=lambda p: (
                1 if len(p.get("abstract", "")) > 60 else 0,
                p.get("citation_count", 0),
                p.get("publication_year", 2000)
            ),
            reverse=True
        )

        return {
            "query": query,
            "total_found": len(deduped_papers),
            "sources_queried": source_names,
            "source_counts": source_counts,
            "papers": deduped_papers
        }


paper_aggregator = MultiSourcePaperAggregator()
