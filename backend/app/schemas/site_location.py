from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SiteLocationCreate(BaseModel):
    site_id: int
    name: str


class SiteLocationUpdate(BaseModel):
    name: str | None = None


class SiteLocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: int
    name: str
    created_at: datetime
