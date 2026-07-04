from datetime import date, datetime
from sqlalchemy import JSON, Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(
        String(50), default="applied"
    )  # applied | oa | interview | offer | rejected | withdrawn
    applied_date: Mapped[date | None] = mapped_column(Date)
    deadline: Mapped[date | None] = mapped_column(Date)

    # H1B sponsorship signal from USCIS data
    visa_tag: Mapped[str | None] = mapped_column(String(50))  # sponsored | unknown
    h1b_count_last_year: Mapped[int | None] = mapped_column()

    notes: Mapped[str | None] = mapped_column(Text)
    # referral | online | linkedin | cold-email
    source: Mapped[str | None] = mapped_column(String(100))
    extra: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )
