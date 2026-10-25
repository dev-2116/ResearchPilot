import asyncio
import pytest
from app.services.paper_fetcher import (
    SemanticScholarFetcher,
    OpenAlexFetcher,
    CrossrefFetcher,
    paper_aggregator
)


@pytest.mark.anyio
async def test_openalex_fetcher():
    papers = await OpenAlexFetcher.search("sparse dense retrieval", limit=2)
    assert isinstance(papers, list)
    if papers:
        p = papers[0]
        assert "title" in p
        assert p["source"] == "OpenAlex"
        assert "chunks" not in p or isinstance(p.get("chunks", []), list)


@pytest.mark.anyio
async def test_crossref_fetcher():
    papers = await CrossrefFetcher.search("language models verification", limit=2)
    assert isinstance(papers, list)
    if papers:
        p = papers[0]
        assert "title" in p
        assert p["source"] == "Crossref"


@pytest.mark.anyio
async def test_multi_source_aggregator():
    res = await paper_aggregator.search("retrieval augmented generation", limit_per_source=2)
    assert "query" in res
    assert "total_found" in res
    assert "papers" in res
    assert isinstance(res["papers"], list)
    assert res["total_found"] > 0
    # verify chunks are generated
    first_paper = res["papers"][0]
    assert "chunks" in first_paper
    assert len(first_paper["chunks"]) > 0


if __name__ == "__main__":
    async def main():
        res = await paper_aggregator.search("retrieval augmented generation", limit_per_source=2)
        print(f"Total found: {res['total_found']}")
        print(f"Sources queried: {res['sources_queried']}")
        print(f"Source counts: {res['source_counts']}")
        for p in res["papers"][:3]:
            print(f"[{p['source']}] {p['title'][:60]} ({p['publication_year']}) - Citations: {p['citation_count']} - Chunks: {len(p['chunks'])}")
    asyncio.run(main())
