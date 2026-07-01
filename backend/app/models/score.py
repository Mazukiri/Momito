from datetime import datetime
from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"))
    # Either a role template name ("google-l4-swe") or "jd:<hash>"
    target_id: Mapped[str] = mapped_column(String(255))
    target_label: Mapped[str] = mapped_column(String(255))

    # 0.0–1.0 for each category
    skills_match: Mapped[float] = mapped_column(Float)
    project_quality: Mapped[float] = mapped_column(Float)
    experience_depth: Mapped[float] = mapped_column(Float)
    presentation: Mapped[float] = mapped_column(Float)

    # Detailed gap breakdowns per category
    skills_gaps: Mapped[list] = mapped_column(JSON, default=list)
    project_gaps: Mapped[list] = mapped_column(JSON, default=list)
    experience_gaps: Mapped[list] = mapped_column(JSON, default=list)
    presentation_gaps: Mapped[list] = mapped_column(JSON, default=list)

    # LLM-generated human-readable suggestions (generated once, cached)
    suggestions: Mapped[str | None] = mapped_column(Text)

    profile = relationship("Profile")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
