from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.maintenance_schedule import MaintenanceSchedule
    from app.models.site import Site
    from app.models.site_location import SiteLocation


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    location_id: Mapped[int | None] = mapped_column(ForeignKey("site_locations.id", ondelete="SET NULL"), nullable=True)
    servicem8_asset_uuid: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(100))
    model_number: Mapped[str | None] = mapped_column(String(100))
    is_catch_all: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    site: Mapped["Site"] = relationship(back_populates="assets")
    location: Mapped["SiteLocation | None"] = relationship(back_populates="assets")
    schedules: Mapped[list["MaintenanceSchedule"]] = relationship(back_populates="asset", cascade="all, delete-orphan")

    @property
    def location_name(self) -> "str | None":
        return self.location.name if self.location else None
