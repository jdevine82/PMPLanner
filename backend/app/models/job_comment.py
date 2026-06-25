from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.job_instance import JobInstance
    from app.models.user import User


class JobComment(Base):
    __tablename__ = "job_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_instance_id: Mapped[int] = mapped_column(ForeignKey("job_instances.id", ondelete="CASCADE"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_system_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job_instance: Mapped["JobInstance"] = relationship(back_populates="comments")
    user: Mapped["User | None"] = relationship(back_populates="comments")
