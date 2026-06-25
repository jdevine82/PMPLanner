from pydantic import BaseModel, ConfigDict


class ServiceTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    parsed_document_text: str
    original_filename: str | None
    historical_average_labor_hours: float


class ServiceTemplateUpdate(BaseModel):
    title: str | None = None
