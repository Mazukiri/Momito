import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.models.dsa import DSAProblem

router = APIRouter()


class DSAAdd(BaseModel):
    leetcode_url: str  # e.g. https://leetcode.com/problems/two-sum/


class DSASolve(BaseModel):
    solved: bool = True
    solved_date: date | None = None
    time_taken_minutes: int | None = None
    notes: str | None = None


def _slug_from_url(url: str) -> str:
    m = re.search(r"leetcode\.com/problems/([a-z0-9-]+)", url)
    if not m:
        raise ValueError("Invalid LeetCode URL")
    return m.group(1)


def _fetch_problem_meta(slug: str) -> dict:
    """Query LeetCode public GraphQL API for problem metadata."""
    query = """
    query getProblem($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        difficulty
        topicTags { name }
      }
    }
    """
    resp = httpx.post(
        "https://leetcode.com/graphql",
        json={"query": query, "variables": {"titleSlug": slug}},
        headers={"Content-Type": "application/json", "Referer": "https://leetcode.com"},
        timeout=10,
    )
    resp.raise_for_status()
    q = resp.json()["data"]["question"]
    return {
        "leetcode_id": int(q["questionFrontendId"]),
        "title": q["title"],
        "difficulty": q["difficulty"],
        "topics": [t["name"] for t in q["topicTags"]],
    }


def _serialize(p: DSAProblem) -> dict:
    return {
        "id": p.id,
        "leetcode_id": p.leetcode_id,
        "title": p.title,
        "slug": p.slug,
        "difficulty": p.difficulty,
        "topics": p.topics,
        "leetcode_url": p.leetcode_url,
        "solved": p.solved,
        "solved_date": p.solved_date,
        "time_taken_minutes": p.time_taken_minutes,
        "notes": p.notes,
        "created_at": p.created_at,
    }


@router.post("/", status_code=201)
def add_problem(body: DSAAdd, db: Session = Depends(get_db)):
    """Add a LeetCode problem by URL — auto-crawls title, difficulty, topics."""
    try:
        slug = _slug_from_url(body.leetcode_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = db.query(DSAProblem).filter(DSAProblem.slug == slug).first()
    if existing:
        return _serialize(existing)

    try:
        meta = _fetch_problem_meta(slug)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LeetCode API error: {e}")

    problem = DSAProblem(
        leetcode_id=meta["leetcode_id"],
        title=meta["title"],
        slug=slug,
        difficulty=meta["difficulty"],
        topics=meta["topics"],
        leetcode_url=body.leetcode_url,
    )
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return _serialize(problem)


@router.get("/")
def list_problems(difficulty: str | None = None, solved: bool | None = None, db: Session = Depends(get_db)):
    q = db.query(DSAProblem)
    if difficulty:
        q = q.filter(DSAProblem.difficulty == difficulty)
    if solved is not None:
        q = q.filter(DSAProblem.solved == solved)
    return [_serialize(p) for p in q.order_by(DSAProblem.leetcode_id).all()]


@router.patch("/{problem_id}/solve")
def mark_solved(problem_id: int, body: DSASolve, db: Session = Depends(get_db)):
    p = db.query(DSAProblem).filter(DSAProblem.id == problem_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
    p.solved = body.solved
    if body.solved_date:
        p.solved_date = body.solved_date
    if body.time_taken_minutes is not None:
        p.time_taken_minutes = body.time_taken_minutes
    if body.notes is not None:
        p.notes = body.notes
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.get("/stats")
def dsa_stats(db: Session = Depends(get_db)):
    total = db.query(DSAProblem).count()
    solved = db.query(DSAProblem).filter(DSAProblem.solved == True).count()
    by_diff: dict[str, dict] = {}
    for diff in ["Easy", "Medium", "Hard"]:
        t = db.query(DSAProblem).filter(DSAProblem.difficulty == diff).count()
        s = db.query(DSAProblem).filter(DSAProblem.difficulty == diff, DSAProblem.solved == True).count()
        by_diff[diff] = {"total": t, "solved": s}
    return {"total": total, "solved": solved, "unsolved": total - solved, "by_difficulty": by_diff}
