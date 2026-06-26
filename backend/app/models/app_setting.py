from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    servicem8_api_key: Mapped[str] = mapped_column(String(255), nullable=False)
    file_storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    generation_buffer_days: Mapped[int] = mapped_column(Integer, default=14)
    monthly_capacity_hours: Mapped[int] = mapped_column(Integer, default=0)
    business_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_successful_sync_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
