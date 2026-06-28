from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SiteLocationCreate(BaseModel):
    site_id: int
    name: str
    parent_id: int | None = None


class SiteLocationUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None


class SiteLocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: int
    parent_id: int | None
    name: str
    created_at: datetime
