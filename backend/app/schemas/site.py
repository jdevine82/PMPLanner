from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SiteCreate(BaseModel):
    customer_id: int
    site_name: str
    site_address: str | None = None
    servicem8_client_uuid: str | None = None


class SiteUpdate(BaseModel):
    site_name: str | None = None
    site_address: str | None = None
    servicem8_client_uuid: str | None = None


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    site_name: str
    site_address: str | None
    servicem8_client_uuid: str | None
    created_at: datetime
