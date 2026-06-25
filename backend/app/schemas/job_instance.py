from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

ApprovalStatus = Literal["Waiting Approval", "Approved", "Refused by Customer", "Cancelled"]
SyncStatus = Literal["Unsynced", "In-Progress", "Completed", "Bypassed"]


class JobInstanceUpdate(BaseModel):
    approval_status: ApprovalStatus | None = None
    refusal_reason: str | None = None
    sync_status: SyncStatus | None = None
    customer_po_link: str | None = None
    actual_labor_hours: float | None = None
    approved_by_user_id: int | None = None


class JobInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    schedule_id: int
    target_month_year: str
    approval_status: str
    refusal_reason: str | None
    sync_status: str
    servicem8_job_uuid: str | None
    customer_po_link: str | None
    actual_labor_hours: float | None
    approved_by_user_id: int | None
    created_at: datetime


class MonthInitResult(BaseModel):
    target_month_year: str
    created_count: int
    already_existed: int
