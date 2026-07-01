"""
Job postings crawler — scrapes company career pages and LinkedIn for openings
matching the 3 target roles. Stores raw listings in Qdrant for semantic search.

Trigger: run periodically (e.g., daily via cron or Railway cron job).
"""
from __future__ import annotations
import hashlib
import httpx
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
from sentence_transformers import SentenceTransformer

from app.config import settings

COLLECTION = "job_postings"
EMBED_MODEL = "all-MiniLM-L6-v2"
VECTOR_SIZE = 384

TARGET_ROLES = [
    "software engineer",
    "hpc engineer",
    "quantitative developer",
    "quant developer",
]

# Minimal set of target company career RSS/JSON feeds (extend as needed)
FEEDS: list[dict] = [
    # Google
    {"company": "Google", "url": "https://careers.google.com/api/jobs/jobs.json?q=software+engineer&location=United+States"},
]


def _get_or_create_collection(client: QdrantClient) -> None:
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


def _doc_id(company: str, title: str, url: str) -> str:
    return hashlib.md5(f"{company}{title}{url}".encode()).hexdigest()


def crawl_jobs() -> int:
    """Fetch job listings and upsert into Qdrant. Returns number of new points."""
    qdrant = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    _get_or_create_collection(qdrant)

    encoder = SentenceTransformer(EMBED_MODEL)
    upserted = 0

    for feed in FEEDS:
        try:
            resp = httpx.get(feed["url"], timeout=15, follow_redirects=True)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[jobs crawler] {feed['company']} failed: {e}")
            continue

        jobs = data.get("jobs", data.get("results", []))
        for job in jobs[:50]:  # cap per feed
            title = job.get("title", "")
            location = job.get("locations", [{}])[0].get("display", "") if isinstance(job.get("locations"), list) else job.get("location", "")
            apply_url = job.get("apply_url", job.get("url", ""))
            text = f"{feed['company']} | {title} | {location}"

            vector = encoder.encode(text).tolist()
            doc_id = _doc_id(feed["company"], title, apply_url)
            # use first 8 hex chars → deterministic int-like id via hash
            point_id = int(doc_id[:8], 16)

            qdrant.upsert(
                collection_name=COLLECTION,
                points=[
                    PointStruct(
                        id=point_id,
                        vector=vector,
                        payload={
                            "company": feed["company"],
                            "title": title,
                            "location": location,
                            "url": apply_url,
                            "raw": text,
                        },
                    )
                ],
            )
            upserted += 1

    return upserted


def search_jobs(query: str, limit: int = 10) -> list[dict]:
    qdrant = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    encoder = SentenceTransformer(EMBED_MODEL)
    vector = encoder.encode(query).tolist()
    results = qdrant.search(collection_name=COLLECTION, query_vector=vector, limit=limit)
    return [{"score": r.score, **r.payload} for r in results]


if __name__ == "__main__":
    n = crawl_jobs()
    print(f"Upserted {n} job postings")
