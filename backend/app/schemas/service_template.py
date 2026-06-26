from typing import Any

from pydantic import BaseModel, ConfigDict


class ServiceTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    parsed_document_text: str
    original_filename: str | None
    interval_months: int | None
    default_estimated_labor_hours: float | None
    historical_average_labor_hours: float
    job_description: str | None
    work_completed: str | None
    attachments: list[Any] | None
    job_badges: list[Any] | None


class ServiceTemplateUpdate(BaseModel):
    title: str | None = None
    parsed_document_text: str | None = None
    interval_months: int | None = None
    default_estimated_labor_hours: float | None = None
    job_description: str | None = None
    work_completed: str | None = None
    attachments: list[Any] | None = None
    job_badges: list[Any] | None = None


class ServiceTemplateManualCreate(BaseModel):
    title: str
    content: str
    interval_months: int | None = None
    default_estimated_labor_hours: float | None = None
    job_description: str | None = None
    work_completed: str | None = None
    attachments: list[Any] | None = None
    job_badges: list[Any] | None = None
