from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.site import Site


class SiteLocation(Base):
    __tablename__ = "site_locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("site_locations.id", ondelete="SET NULL"), nullable=True, default=None)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    site: Mapped["Site"] = relationship(back_populates="locations")
    assets: Mapped[list["Asset"]] = relationship(back_populates="location")
    children: Mapped[list["SiteLocation"]] = relationship("SiteLocation", back_populates="parent", foreign_keys="SiteLocation.parent_id")
    parent: Mapped[Optional["SiteLocation"]] = relationship("SiteLocation", back_populates="children", remote_side="SiteLocation.id", foreign_keys="SiteLocation.parent_id")
