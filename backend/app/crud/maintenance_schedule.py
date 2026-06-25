from sqlalchemy.orm import Session

from app.models.maintenance_schedule import MaintenanceSchedule
from app.schemas.maintenance_schedule import MaintenanceScheduleCreate, MaintenanceScheduleUpdate


def get(db: Session, schedule_id: int) -> MaintenanceSchedule | None:
    return db.get(MaintenanceSchedule, schedule_id)


def get_by_asset(db: Session, asset_id: int) -> list[MaintenanceSchedule]:
    return db.query(MaintenanceSchedule).filter(MaintenanceSchedule.asset_id == asset_id).all()


def create(db: Session, data: MaintenanceScheduleCreate) -> MaintenanceSchedule:
    obj = MaintenanceSchedule(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, schedule: MaintenanceSchedule, data: MaintenanceScheduleUpdate) -> MaintenanceSchedule:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(schedule, field, value)
    db.commit()
    db.refresh(schedule)
    return schedule


def delete(db: Session, schedule: MaintenanceSchedule) -> None:
    db.delete(schedule)
    db.commit()
