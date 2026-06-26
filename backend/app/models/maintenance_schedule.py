from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.job_instance import JobInstance
    from app.models.service_template import ServiceTemplate


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    service_id: Mapped[int] = mapped_column(ForeignKey("service_templates.id", ondelete="RESTRICT"))
    estimated_labor_hours: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    frequency_months: Mapped[int] = mapped_column(Integer, nullable=False)
    date_last_done: Mapped[date | None] = mapped_column(Date)
    date_next_due: Mapped[date] = mapped_column(Date, nullable=False)
    permanent_custom_instructions: Mapped[str | None] = mapped_column(Text)
    sm8_group_tag: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    asset: Mapped["Asset"] = relationship(back_populates="schedules")
    service: Mapped["ServiceTemplate"] = relationship(back_populates="schedules")
    job_instances: Mapped[list["JobInstance"]] = relationship(back_populates="schedule", cascade="all, delete-orphan")
