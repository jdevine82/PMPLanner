from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    username: str
    password: str
    user_role: Literal["Admin", "Staff"] = "Staff"


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    user_role: Literal["Admin", "Staff"] | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    user_role: str
    created_at: datetime
