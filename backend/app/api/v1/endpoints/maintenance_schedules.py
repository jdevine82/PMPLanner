from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin
from app.crud import maintenance_schedule as crud
from app.schemas.maintenance_schedule import MaintenanceScheduleCreate, MaintenanceScheduleOut, MaintenanceScheduleUpdate

router = APIRouter()


@router.get("", response_model=list[MaintenanceScheduleOut])
def list_schedules(asset_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if asset_id:
        return crud.get_by_asset(db, asset_id)
    from sqlalchemy import select
    from app.models.maintenance_schedule import MaintenanceSchedule
    return db.execute(select(MaintenanceSchedule)).scalars().all()


@router.post("", response_model=MaintenanceScheduleOut, status_code=201)
def create_schedule(data: MaintenanceScheduleCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return crud.create(db, data)


@router.get("/{schedule_id}", response_model=MaintenanceScheduleOut)
def get_schedule(schedule_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    return obj


@router.patch("/{schedule_id}", response_model=MaintenanceScheduleOut)
def update_schedule(
    schedule_id: int, data: MaintenanceScheduleUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    return crud.update(db, obj, data)


@router.delete("/{schedule_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    crud.delete(db, obj)
