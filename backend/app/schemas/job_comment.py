from datetime import datetime

from pydantic import BaseModel, ConfigDict


class JobCommentCreate(BaseModel):
    comment_text: str


class JobCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_instance_id: int
    user_id: int | None
    comment_text: str
    is_system_generated: bool
    created_at: datetime
