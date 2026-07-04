from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.profile import Profile
from app.models.score import Score
from app.services import scorer, suggestion
from app.services.scorer import ROLE_TEMPLATES

router = APIRouter()


class ScoreRequest(BaseModel):
    role: str  # must match a key in ROLE_TEMPLATES
    jd_text: str | None = None
    regenerate_suggestions: bool = False


def _extract_jd_skills(jd_text: str) -> list[str]:
    """Naive keyword extraction from JD text — picks capitalised tech words."""
    import re
    tokens = re.findall(r"[A-Z][a-zA-Z+#]{1,20}", jd_text)
    stop = {"The", "We", "You", "Our", "This", "Must", "Will", "And", "For", "With"}
    return list({t for t in tokens if t not in stop})


@router.post("/")
def create_score(req: ScoreRequest, db: Session = Depends(get_db)):
    if req.role not in ROLE_TEMPLATES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown role. Valid: {list(ROLE_TEMPLATES.keys())}",
        )

    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile — upload CV first")

    profile_data = {
        "name": profile.name,
        "email": profile.email,
        "github_url": profile.github_url,
        "skills": profile.skills,
        "experience": profile.experience,
        "projects": profile.projects,
    }

    jd_skills = _extract_jd_skills(req.jd_text) if req.jd_text else None
    result = scorer.compute_score(profile_data, req.role, jd_skills)

    import hashlib
    target_id = req.role if not req.jd_text else f"jd:{hashlib.md5(req.jd_text.encode()).hexdigest()[:8]}"
    target_label = req.role if not req.jd_text else f"{req.role} (custom JD)"

    score_obj = (
        db.query(Score)
        .filter(Score.profile_id == profile.id, Score.target_id == target_id)
        .first()
    )
    if score_obj is None:
        score_obj = Score(profile_id=profile.id, target_id=target_id, target_label=target_label)
        db.add(score_obj)

    score_obj.skills_match = result["skills_match"]
    score_obj.project_quality = result["project_quality"]
    score_obj.experience_depth = result["experience_depth"]
    score_obj.presentation = result["presentation"]
    score_obj.skills_gaps = result["skills_gaps"]
    score_obj.project_gaps = result["project_gaps"]
    score_obj.experience_gaps = result["experience_gaps"]
    score_obj.presentation_gaps = result["presentation_gaps"]

    if score_obj.suggestions is None or req.regenerate_suggestions:
        score_obj.suggestions = suggestion.generate_suggestions(
            role=req.role,
            skills_gaps=result["skills_gaps"],
            project_gaps=result["project_gaps"],
            experience_gaps=result["experience_gaps"],
            presentation_gaps=result["presentation_gaps"],
            scores=result,
        )

    db.commit()
    db.refresh(score_obj)

    return {
        "id": score_obj.id,
        "target_label": score_obj.target_label,
        "overall": result["overall"],
        "skills_match": score_obj.skills_match,
        "project_quality": score_obj.project_quality,
        "experience_depth": score_obj.experience_depth,
        "presentation": score_obj.presentation,
        "skills_gaps": score_obj.skills_gaps,
        "project_gaps": score_obj.project_gaps,
        "experience_gaps": score_obj.experience_gaps,
        "presentation_gaps": score_obj.presentation_gaps,
        "suggestions": score_obj.suggestions,
        "created_at": score_obj.created_at,
    }


@router.get("/")
def list_scores(db: Session = Depends(get_db)):
    scores = db.query(Score).order_by(Score.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "target_label": s.target_label,
            "overall": round((s.skills_match + s.project_quality + s.experience_depth + s.presentation) / 4, 3),
            "skills_match": s.skills_match,
            "project_quality": s.project_quality,
            "experience_depth": s.experience_depth,
            "presentation": s.presentation,
            "created_at": s.created_at,
        }
        for s in scores
    ]


@router.get("/{score_id}")
def get_score(score_id: int, db: Session = Depends(get_db)):
    s = db.query(Score).filter(Score.id == score_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Score not found")
    return {
        "id": s.id,
        "target_label": s.target_label,
        "overall": round((s.skills_match + s.project_quality + s.experience_depth + s.presentation) / 4, 3),
        "skills_match": s.skills_match,
        "project_quality": s.project_quality,
        "experience_depth": s.experience_depth,
        "presentation": s.presentation,
        "skills_gaps": s.skills_gaps,
        "project_gaps": s.project_gaps,
        "experience_gaps": s.experience_gaps,
        "presentation_gaps": s.presentation_gaps,
        "suggestions": s.suggestions,
        "created_at": s.created_at,
    }
