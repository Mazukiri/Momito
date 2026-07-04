from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job
from app.crawlers.visa import lookup_h1b

router = APIRouter()

JobStatus = Literal["applied", "oa", "interview", "offer", "rejected", "withdrawn"]
JobSource = Literal["referral", "online", "linkedin", "cold-email", "other"]


class JobCreate(BaseModel):
    company: str
    role: str
    url: str | None = None
    status: JobStatus = "applied"
    applied_date: date | None = None
    deadline: date | None = None
    source: JobSource | None = None
    notes: str | None = None


class JobUpdate(BaseModel):
    status: JobStatus | None = None
    notes: str | None = None
    deadline: date | None = None
    visa_tag: str | None = None
    h1b_count_last_year: int | None = None


def _serialize(j: Job) -> dict:
    return {
        "id": j.id,
        "company": j.company,
        "role": j.role,
        "url": j.url,
        "status": j.status,
        "applied_date": j.applied_date,
        "deadline": j.deadline,
        "visa_tag": j.visa_tag,
        "h1b_count_last_year": j.h1b_count_last_year,
        "source": j.source,
        "notes": j.notes,
        "created_at": j.created_at,
        "updated_at": j.updated_at,
    }


@router.post("/", status_code=201)
def create_job(body: JobCreate, db: Session = Depends(get_db)):
    job = Job(**body.model_dump())
    visa = lookup_h1b(body.company)
    job.visa_tag = visa["visa_tag"]
    job.h1b_count_last_year = visa["h1b_count_last_year"]
    db.add(job)
    db.commit()
    db.refresh(job)
    return _serialize(job)


@router.get("/")
def list_jobs(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Job)
    if status:
        q = q.filter(Job.status == status)
    return [_serialize(j) for j in q.order_by(Job.created_at.desc()).all()]


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _serialize(job)


@router.patch("/{job_id}")
def update_job(job_id: int, body: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return _serialize(job)


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
