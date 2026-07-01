"""
Research corpus crawler — fetches papers from ArXiv and repos from GitHub
relevant to the 3 target domains. Stored in Qdrant for semantic RAG.

ArXiv: cs.DC (distributed), cs.PF (performance), q-fin.CP (quant)
GitHub: trending repos in hpc, quant, distributed-systems topics
"""
from __future__ import annotations
import hashlib
import re
import httpx
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from sentence_transformers import SentenceTransformer

from app.config import settings

COLLECTION = "research_corpus"
EMBED_MODEL = "all-MiniLM-L6-v2"
VECTOR_SIZE = 384

ARXIV_CATEGORIES = ["cs.DC", "cs.PF", "q-fin.CP", "cs.DS"]
ARXIV_MAX_PER_CAT = 20

GITHUB_TOPICS = ["hpc", "distributed-systems", "quantitative-finance", "high-frequency-trading", "parallel-computing"]
GITHUB_MAX_PER_TOPIC = 20


def _get_or_create_collection(client: QdrantClient) -> None:
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


def _point_id(text: str) -> int:
    return int(hashlib.md5(text.encode()).hexdigest()[:8], 16)


def _crawl_arxiv(qdrant: QdrantClient, encoder: SentenceTransformer) -> int:
    upserted = 0
    for cat in ARXIV_CATEGORIES:
        url = f"https://export.arxiv.org/api/query?search_query=cat:{cat}&sortBy=submittedDate&sortOrder=descending&max_results={ARXIV_MAX_PER_CAT}"
        try:
            resp = httpx.get(url, timeout=20)
            resp.raise_for_status()
        except Exception as e:
            print(f"[research crawler] ArXiv {cat} failed: {e}")
            continue

        entries = re.findall(r"<entry>(.*?)</entry>", resp.text, re.DOTALL)
        for entry in entries:
            title_m = re.search(r"<title>(.*?)</title>", entry, re.DOTALL)
            summary_m = re.search(r"<summary>(.*?)</summary>", entry, re.DOTALL)
            link_m = re.search(r'href="(https://arxiv\.org/abs/[^"]+)"', entry)
            if not title_m:
                continue
            title = title_m.group(1).strip().replace("\n", " ")
            summary = summary_m.group(1).strip().replace("\n", " ") if summary_m else ""
            link = link_m.group(1) if link_m else ""
            text = f"{title}. {summary[:300]}"
            vector = encoder.encode(text).tolist()
            qdrant.upsert(
                collection_name=COLLECTION,
                points=[PointStruct(
                    id=_point_id(link or title),
                    vector=vector,
                    payload={"type": "arxiv", "category": cat, "title": title, "url": link, "summary": summary[:500]},
                )],
            )
            upserted += 1
    return upserted


def _crawl_github(qdrant: QdrantClient, encoder: SentenceTransformer) -> int:
    upserted = 0
    for topic in GITHUB_TOPICS:
        url = f"https://api.github.com/search/repositories?q=topic:{topic}&sort=stars&order=desc&per_page={GITHUB_MAX_PER_TOPIC}"
        try:
            resp = httpx.get(url, timeout=15, headers={"Accept": "application/vnd.github.v3+json"})
            resp.raise_for_status()
        except Exception as e:
            print(f"[research crawler] GitHub topic={topic} failed: {e}")
            continue

        for repo in resp.json().get("items", []):
            name = repo.get("full_name", "")
            desc = repo.get("description") or ""
            stars = repo.get("stargazers_count", 0)
            html_url = repo.get("html_url", "")
            text = f"{name}: {desc} (stars: {stars})"
            vector = encoder.encode(text).tolist()
            qdrant.upsert(
                collection_name=COLLECTION,
                points=[PointStruct(
                    id=_point_id(html_url),
                    vector=vector,
                    payload={"type": "github", "topic": topic, "name": name, "url": html_url, "description": desc, "stars": stars},
                )],
            )
            upserted += 1
    return upserted


def crawl_research() -> dict[str, int]:
    qdrant = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    _get_or_create_collection(qdrant)
    encoder = SentenceTransformer(EMBED_MODEL)

    arxiv_n = _crawl_arxiv(qdrant, encoder)
    github_n = _crawl_github(qdrant, encoder)
    return {"arxiv": arxiv_n, "github": github_n}


def search_research(query: str, limit: int = 10) -> list[dict]:
    qdrant = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    encoder = SentenceTransformer(EMBED_MODEL)
    vector = encoder.encode(query).tolist()
    results = qdrant.search(collection_name=COLLECTION, query_vector=vector, limit=limit)
    return [{"score": r.score, **r.payload} for r in results]


if __name__ == "__main__":
    counts = crawl_research()
    print(f"Upserted: {counts}")
