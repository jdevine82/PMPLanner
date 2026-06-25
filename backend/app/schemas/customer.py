from pydantic import BaseModel, ConfigDict


class CustomerCreate(BaseModel):
    company_name: str
    primary_contact: str | None = None
    phone: str | None = None
    email: str | None = None


class CustomerUpdate(BaseModel):
    company_name: str | None = None
    primary_contact: str | None = None
    phone: str | None = None
    email: str | None = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    primary_contact: str | None
    phone: str | None
    email: str | None
