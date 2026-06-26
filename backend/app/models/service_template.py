from typing import TYPE_CHECKING, Any

from sqlalchemy import Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.maintenance_schedule import MaintenanceSchedule


class ServiceTemplate(Base):
    __tablename__ = "service_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    parsed_document_text: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(500))
    interval_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    historical_average_labor_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00)
    job_description: Mapped[str | None] = mapped_column(Text)
    work_completed: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[list[Any] | None] = mapped_column(JSON)
    job_badges: Mapped[list[Any] | None] = mapped_column(JSON)

    schedules: Mapped[list["MaintenanceSchedule"]] = relationship(back_populates="service")
