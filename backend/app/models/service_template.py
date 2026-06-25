from typing import TYPE_CHECKING

from sqlalchemy import Numeric, String, Text
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
    historical_average_labor_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00)

    schedules: Mapped[list["MaintenanceSchedule"]] = relationship(back_populates="service")
