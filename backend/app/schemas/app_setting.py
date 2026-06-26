from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AppSettingCreate(BaseModel):
    servicem8_api_key: str
    file_storage_path: str
    generation_buffer_days: int = 14
    monthly_capacity_hours: int = 0
    business_name: str | None = None
    logo_filename: str | None = None


class AppSettingUpdate(BaseModel):
    servicem8_api_key: str | None = None
    file_storage_path: str | None = None
    generation_buffer_days: int | None = None
    monthly_capacity_hours: int | None = None
    business_name: str | None = None
    logo_filename: str | None = None


class AppSettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    servicem8_api_key: str
    file_storage_path: str
    generation_buffer_days: int
    monthly_capacity_hours: int
    business_name: str | None
    logo_filename: str | None
    last_successful_sync_timestamp: datetime
