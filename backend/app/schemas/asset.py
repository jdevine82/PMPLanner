from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AssetCreate(BaseModel):
    site_id: int
    location_id: int | None = None
    servicem8_asset_uuid: str | None = None
    asset_name: str
    serial_number: str | None = None
    model_number: str | None = None
    is_catch_all: bool = False
    doc_url: str | None = None


class AssetUpdate(BaseModel):
    location_id: int | None = None
    asset_name: str | None = None
    serial_number: str | None = None
    model_number: str | None = None
    is_catch_all: bool | None = None
    doc_url: str | None = None


class AssetTransfer(BaseModel):
    target_site_id: int
    target_location_id: int | None = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: int
    location_id: int | None
    location_name: str | None
    servicem8_asset_uuid: str | None
    asset_name: str
    serial_number: str | None
    model_number: str | None
    is_catch_all: bool
    doc_url: str | None
    created_at: datetime
