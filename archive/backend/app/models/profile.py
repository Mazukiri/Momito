from datetime import datetime
from sqlalchemy import JSON, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    github_url: Mapped[str | None] = mapped_column(String(500))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))

    # Parsed from CV PDF — stored as JSON arrays/objects
    skills: Mapped[list] = mapped_column(JSON, default=list)
    # [{"company": str, "role": str, "years": float, "tier": str, "description": str}]
    experience: Mapped[list] = mapped_column(JSON, default=list)
    # [{"degree": str, "institution": str, "country": str, "year": int}]
    education: Mapped[list] = mapped_column(JSON, default=list)
    # [{"name": str, "url": str, "description": str, "type": str, "github_stars": int}]
    projects: Mapped[list] = mapped_column(JSON, default=list)

    raw_cv_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )
