from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import job_comment as crud
from app.crud import job_instance as crud_instance
from app.schemas.job_comment import JobCommentCreate, JobCommentOut

router = APIRouter()


@router.get("/{job_instance_id}/comments", response_model=list[JobCommentOut])
def list_comments(job_instance_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not crud_instance.get(db, job_instance_id):
        raise HTTPException(404, "Job instance not found")
    return crud.get_by_job(db, job_instance_id)


@router.post("/{job_instance_id}/comments", response_model=JobCommentOut, status_code=201)
def add_comment(
    job_instance_id: int,
    data: JobCommentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not crud_instance.get(db, job_instance_id):
        raise HTTPException(404, "Job instance not found")
    return crud.create(db, job_instance_id, current_user.id, data)
