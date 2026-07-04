from datetime import date, datetime
from sqlalchemy import JSON, Boolean, Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DSAProblem(Base):
    __tablename__ = "dsa_problems"

    id: Mapped[int] = mapped_column(primary_key=True)
    leetcode_id: Mapped[int] = mapped_column(Integer, unique=True)
    title: Mapped[str] = mapped_column(String(500))
    slug: Mapped[str] = mapped_column(String(500))
    difficulty: Mapped[str] = mapped_column(String(10))  # Easy | Medium | Hard
    topics: Mapped[list] = mapped_column(JSON, default=list)
    leetcode_url: Mapped[str] = mapped_column(String(500))

    # User progress
    solved: Mapped[bool] = mapped_column(Boolean, default=False)
    solved_date: Mapped[date | None] = mapped_column(Date)
    time_taken_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(String(2000))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )
