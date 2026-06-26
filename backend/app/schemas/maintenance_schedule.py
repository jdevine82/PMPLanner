from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class MaintenanceScheduleCreate(BaseModel):
    asset_id: int
    service_id: int
    estimated_labor_hours: float
    frequency_months: int
    date_last_done: date | None = None
    date_next_due: date
    permanent_custom_instructions: str | None = None
    sm8_group_tag: str | None = None


class MaintenanceScheduleUpdate(BaseModel):
    service_id: int | None = None
    estimated_labor_hours: float | None = None
    frequency_months: int | None = None
    date_last_done: date | None = None
    date_next_due: date | None = None
    date_anchor_next_due: date | None = None
    permanent_custom_instructions: str | None = None
    sm8_group_tag: str | None = None


class MaintenanceScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    service_id: int
    estimated_labor_hours: float
    frequency_months: int
    date_last_done: date | None
    date_next_due: date
    date_anchor_next_due: date | None
    permanent_custom_instructions: str | None
    sm8_group_tag: str | None
    created_at: datetime
