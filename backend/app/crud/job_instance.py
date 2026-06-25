from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session

from app.models.job_comment import JobComment
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.schemas.job_instance import JobInstanceUpdate, MonthInitResult


def get(db: Session, instance_id: int) -> JobInstance | None:
    return db.get(JobInstance, instance_id)


def get_by_month(db: Session, target_month_year: str) -> list[JobInstance]:
    return db.query(JobInstance).filter(JobInstance.target_month_year == target_month_year).all()


def get_unsynced_approved(db: Session) -> list[JobInstance]:
    return (
        db.query(JobInstance)
        .filter(JobInstance.approval_status == "Approved", JobInstance.sync_status == "Unsynced")
        .all()
    )


def update(db: Session, instance: JobInstance, data: JobInstanceUpdate, acting_user_id: int) -> JobInstance:
    updates = data.model_dump(exclude_unset=True)

    if "approval_status" in updates and updates["approval_status"] == "Approved":
        updates["approved_by_user_id"] = acting_user_id

    if updates.get("approval_status") == "Refused by Customer" and updates.get("refusal_reason"):
        system_comment = JobComment(
            job_instance_id=instance.id,
            user_id=acting_user_id,
            comment_text=f"REFUSED: {updates['refusal_reason']}",
            is_system_generated=True,
        )
        db.add(system_comment)

    for field, value in updates.items():
        setattr(instance, field, value)

    db.commit()
    db.refresh(instance)
    return instance


def delete(db: Session, instance: JobInstance) -> None:
    db.delete(instance)
    db.commit()


def initialize_month(db: Session, target_month_year: str) -> MonthInitResult:
    year, month = map(int, target_month_year.split("-"))
    month_start = date(year, month, 1)
    month_end = date(year, month, monthrange(year, month)[1])

    schedules = (
        db.query(MaintenanceSchedule)
        .filter(
            MaintenanceSchedule.date_next_due >= month_start,
            MaintenanceSchedule.date_next_due <= month_end,
        )
        .all()
    )

    created = 0
    already_existed = 0

    for schedule in schedules:
        existing = (
            db.query(JobInstance)
            .filter(
                JobInstance.schedule_id == schedule.id,
                JobInstance.target_month_year == target_month_year,
            )
            .first()
        )
        if existing:
            already_existed += 1
        else:
            db.add(JobInstance(schedule_id=schedule.id, target_month_year=target_month_year))
            created += 1

    db.commit()
    return MonthInitResult(target_month_year=target_month_year, created_count=created, already_existed=already_existed)


def check_month_has_jobs(db: Session, target_month_year: str) -> bool:
    return (
        db.query(JobInstance).filter(JobInstance.target_month_year == target_month_year).first() is not None
    )
