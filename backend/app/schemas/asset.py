from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AssetCreate(BaseModel):
    site_id: int
    servicem8_asset_uuid: str
    asset_name: str
    serial_number: str | None = None
    model_number: str | None = None


class AssetUpdate(BaseModel):
    asset_name: str | None = None
    serial_number: str | None = None
    model_number: str | None = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: int
    servicem8_asset_uuid: str
    asset_name: str
    serial_number: str | None
    model_number: str | None
    created_at: datetime
