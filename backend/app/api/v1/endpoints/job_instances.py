import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin, require_staff
from app.crud import job_instance as crud
from app.schemas.job_instance import JobInstanceOut, JobInstanceUpdate, MonthInitResult

router = APIRouter()

MONTH_YEAR_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("", response_model=list[JobInstanceOut])
def list_job_instances(
    month: str | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    if month:
        if not MONTH_YEAR_RE.match(month):
            raise HTTPException(400, "month must be in YYYY-MM format")
        return crud.get_by_month(db, month)
    from sqlalchemy import select
    from app.models.job_instance import JobInstance
    return db.execute(select(JobInstance)).scalars().all()


@router.post("/initialize/{month}", response_model=MonthInitResult)
def initialize_month(month: str, db: Session = Depends(get_db), _=Depends(require_staff)):
    if not MONTH_YEAR_RE.match(month):
        raise HTTPException(400, "month must be in YYYY-MM format")
    return crud.initialize_month(db, month)


@router.get("/check/{month}")
def check_month(month: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not MONTH_YEAR_RE.match(month):
        raise HTTPException(400, "month must be in YYYY-MM format")
    return {"month": month, "has_jobs": crud.check_month_has_jobs(db, month)}


@router.get("/comment-counts")
def comment_counts(month: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import func
    from app.models.job_comment import JobComment
    from app.models.job_instance import JobInstance
    results = (
        db.query(JobInstance.id, func.count(JobComment.id))
        .outerjoin(JobComment, JobComment.job_instance_id == JobInstance.id)
        .filter(JobInstance.target_month_year == month)
        .group_by(JobInstance.id)
        .all()
    )
    return {job_id: count for job_id, count in results}


@router.get("/{instance_id}", response_model=JobInstanceOut)
def get_job_instance(instance_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, instance_id)
    if not obj:
        raise HTTPException(404, "Job instance not found")
    return obj


@router.patch("/{instance_id}", response_model=JobInstanceOut)
def update_job_instance(
    instance_id: int,
    data: JobInstanceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    obj = crud.get(db, instance_id)
    if not obj:
        raise HTTPException(404, "Job instance not found")

    if data.approval_status == "Refused by Customer" and not data.refusal_reason:
        raise HTTPException(400, "refusal_reason is required when refusing a job")

    return crud.update(db, obj, data, current_user.id)


@router.delete("/{instance_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_job_instance(instance_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, instance_id)
    if not obj:
        raise HTTPException(404, "Job instance not found")
    crud.delete(db, obj)
