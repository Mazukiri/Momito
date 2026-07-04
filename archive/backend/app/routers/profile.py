from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.profile import Profile
from app.services import pdf_parser

router = APIRouter()


@router.post("/upload")
def upload_cv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Parse a CV PDF and upsert the single profile record."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")

    pdf_bytes = file.file.read()
    try:
        data = pdf_parser.parse_pdf(pdf_bytes)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=422, detail=str(e))

    profile = db.query(Profile).first()
    if profile is None:
        profile = Profile()
        db.add(profile)

    profile.name = data.get("name", "")
    profile.email = data.get("email")
    profile.github_url = data.get("github_url")
    profile.linkedin_url = data.get("linkedin_url")
    profile.skills = data.get("skills", [])
    profile.experience = data.get("experience", [])
    profile.education = data.get("education", [])
    profile.projects = data.get("projects", [])
    profile.raw_cv_text = data.get("raw_cv_text")

    db.commit()
    db.refresh(profile)
    return {"id": profile.id, "name": profile.name}


@router.get("/")
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile yet — upload your CV first")
    return {
        "id": profile.id,
        "name": profile.name,
        "email": profile.email,
        "github_url": profile.github_url,
        "linkedin_url": profile.linkedin_url,
        "skills": profile.skills,
        "experience": profile.experience,
        "education": profile.education,
        "projects": profile.projects,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }
