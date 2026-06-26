from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.job_comment import JobComment
    from app.models.maintenance_schedule import MaintenanceSchedule
    from app.models.user import User

APPROVAL_STATUSES = ("Waiting Approval", "Approved", "Refused by Customer", "Cancelled")
SYNC_STATUSES = ("Unsynced", "In-Progress", "Completed", "Bypassed")


class JobInstance(Base):
    __tablename__ = "job_instances"
    __table_args__ = (
        CheckConstraint(
            "target_month_year ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'",
            name="ck_job_instances_month_year_format",
        ),
        CheckConstraint(
            f"approval_status IN {APPROVAL_STATUSES}",
            name="ck_job_instances_approval_status",
        ),
        CheckConstraint(
            f"sync_status IN {SYNC_STATUSES}",
            name="ck_job_instances_sync_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("maintenance_schedules.id", ondelete="CASCADE"))
    target_month_year: Mapped[str] = mapped_column(String(7), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(30), default="Waiting Approval")
    refusal_reason: Mapped[str | None] = mapped_column(Text)
    sync_status: Mapped[str] = mapped_column(String(20), default="Unsynced")
    servicem8_job_uuid: Mapped[str | None] = mapped_column(String(255), index=True)
    servicem8_job_number: Mapped[int | None] = mapped_column(Integer)
    assettracker_wo_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    customer_po_link: Mapped[str | None] = mapped_column(String(500))
    actual_labor_hours: Mapped[float | None] = mapped_column(Numeric(5, 2))
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    schedule: Mapped["MaintenanceSchedule"] = relationship(back_populates="job_instances")
    approved_by: Mapped["User | None"] = relationship(back_populates="approved_jobs")
    comments: Mapped[list["JobComment"]] = relationship(back_populates="job_instance", cascade="all, delete-orphan")
