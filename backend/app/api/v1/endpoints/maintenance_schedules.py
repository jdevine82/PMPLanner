from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin, require_staff
from app.crud import maintenance_schedule as crud
from app.models.job_instance import JobInstance
from app.schemas.job_instance import JobInstanceOut
from app.schemas.maintenance_schedule import BulkCombineRequest, MaintenanceScheduleCreate, MaintenanceScheduleOut, MaintenanceScheduleUpdate

router = APIRouter()


@router.get("", response_model=list[MaintenanceScheduleOut])
def list_schedules(
    asset_id: int | None = None,
    site_id: int | None = None,
    link_group: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.asset import Asset
    from app.models.maintenance_schedule import MaintenanceSchedule
    if asset_id:
        return crud.get_by_asset(db, asset_id)
    if site_id:
        return db.execute(
            select(MaintenanceSchedule)
            .join(Asset, MaintenanceSchedule.asset_id == Asset.id)
            .where(Asset.site_id == site_id)
        ).scalars().all()
    if link_group:
        return db.execute(
            select(MaintenanceSchedule).where(MaintenanceSchedule.link_group == link_group)
        ).scalars().all()
    return db.execute(select(MaintenanceSchedule)).scalars().all()


@router.post("/bulk-combine", status_code=200)
def bulk_combine_by_site_service(
    data: BulkCombineRequest,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    from sqlalchemy import select
    from app.models.asset import Asset
    from app.models.maintenance_schedule import MaintenanceSchedule
    schedules = db.execute(
        select(MaintenanceSchedule)
        .join(Asset, MaintenanceSchedule.asset_id == Asset.id)
        .where(Asset.site_id == data.site_id)
        .where(MaintenanceSchedule.service_id == data.service_id)
    ).scalars().all()
    tag = f"svc:{data.service_id}" if data.combine else None
    for s in schedules:
        s.sm8_group_tag = tag
    db.commit()
    return {"updated": len(schedules)}


@router.post("", response_model=MaintenanceScheduleOut, status_code=201)
def create_schedule(data: MaintenanceScheduleCreate, db: Session = Depends(get_db), _=Depends(require_staff)):
    return crud.create(db, data)


@router.get("/link-groups", response_model=list[str])
def list_link_groups(
    site_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    from sqlalchemy import distinct
    from app.models.asset import Asset
    from app.models.maintenance_schedule import MaintenanceSchedule
    q = (
        select(distinct(MaintenanceSchedule.link_group))
        .join(Asset, MaintenanceSchedule.asset_id == Asset.id)
        .where(MaintenanceSchedule.link_group.isnot(None))
    )
    if site_id:
        q = q.where(Asset.site_id == site_id)
    return db.execute(q.order_by(MaintenanceSchedule.link_group)).scalars().all()


@router.get("/{schedule_id}", response_model=MaintenanceScheduleOut)
def get_schedule(schedule_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    return obj


@router.patch("/{schedule_id}", response_model=MaintenanceScheduleOut)
def update_schedule(
    schedule_id: int, data: MaintenanceScheduleUpdate, db: Session = Depends(get_db), _=Depends(require_staff)
):
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    return crud.update(db, obj, data)


@router.post("/{schedule_id}/pull-forward", response_model=MaintenanceScheduleOut)
def pull_forward_schedule(schedule_id: int, db: Session = Depends(get_db), _=Depends(require_staff)):
    """Move a schedule's next due date to today, preserving the original date so the
    subsequent cycle remains on the original cadence after the job is completed."""
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    if obj.date_next_due <= date.today():
        raise HTTPException(400, "Service is already due today or overdue")
    update_data = MaintenanceScheduleUpdate(
        date_anchor_next_due=obj.date_next_due,
        date_next_due=date.today(),
    )
    return crud.update(db, obj, update_data)


@router.get("/{schedule_id}/history", response_model=list[JobInstanceOut])
def get_schedule_history(schedule_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    return (
        db.execute(
            select(JobInstance)
            .where(JobInstance.schedule_id == schedule_id)
            .order_by(JobInstance.target_month_year.desc())
        )
        .scalars()
        .all()
    )


@router.delete("/{schedule_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    crud.delete(db, obj)
