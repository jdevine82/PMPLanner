from calendar import monthrange
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.models.job_comment import JobComment
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.schemas.job_instance import JobInstanceUpdate, MonthInitResult


def _add_months(d: date, months: int) -> date:
    m = d.month + months
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    return date(y, m, min(d.day, monthrange(y, m)[1]))


def _projects_to_month(date_next_due: date, frequency_months: int, month_start: date, month_end: date) -> bool:
    """Return True if date_next_due, stepped forward by any number of frequency cycles, lands in [month_start, month_end]."""
    d = date_next_due
    if d > month_end:
        return False
    if month_start <= d <= month_end:
        return True
    # d is before month_start — project forward by the minimum number of cycles needed
    diff = (month_start.year - d.year) * 12 + (month_start.month - d.month)
    n = (diff + frequency_months - 1) // frequency_months
    projected = _add_months(d, n * frequency_months)
    return month_start <= projected <= month_end


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
    is_future_month = month_start > date.today()

    # Fetch all schedules that could possibly land in this month:
    # those whose date_next_due is not yet beyond this month's end.
    candidates = (
        db.query(MaintenanceSchedule)
        .filter(MaintenanceSchedule.date_next_due <= month_end)
        .all()
    )

    # Keep only those that project (via their frequency cycle) into the target month.
    # This handles future months where date_next_due hasn't been advanced yet.
    schedules = [
        s for s in candidates
        if _projects_to_month(s.date_next_due, s.frequency_months, month_start, month_end)
    ]

    # Group schedules for skip logic:
    # - Schedules with a link_group are grouped cross-asset by (link_group, site_id) so that
    #   the same group name at different sites does not interfere.
    # - All other schedules are grouped per-asset (existing behaviour).
    # Within each group, only the longest-interval service runs; shorter ones are skipped.
    relevant_asset_ids = {s.asset_id for s in schedules}
    from app.models.asset import Asset as AssetModel
    asset_site_map: dict[int, int] = (
        dict(
            db.query(AssetModel.id, AssetModel.site_id)
            .filter(AssetModel.id.in_(relevant_asset_ids))
            .all()
        )
        if relevant_asset_ids
        else {}
    )

    by_link_group: dict[tuple[str, int], list[MaintenanceSchedule]] = defaultdict(list)
    by_asset: dict[int, list[MaintenanceSchedule]] = defaultdict(list)
    for s in schedules:
        if s.link_group:
            site_id = asset_site_map.get(s.asset_id, 0)
            by_link_group[(s.link_group, site_id)].append(s)
        else:
            by_asset[s.asset_id].append(s)

    all_groups = list(by_link_group.values()) + list(by_asset.values())

    created = 0
    already_existed = 0

    for asset_schedules in all_groups:
        max_interval = max(s.frequency_months for s in asset_schedules)

        for schedule in asset_schedules:
            if schedule.frequency_months < max_interval:
                # Shorter-interval service superseded this month — advance without creating a job.
                # Only mutate date_next_due for current/past months; future months are just projections.
                if not is_future_month:
                    schedule.date_next_due = _add_months(schedule.date_next_due, schedule.frequency_months)
                continue

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


def get_prior_incomplete_job_map(
    db: Session, schedule_ids: list[int], target_month_year: str
) -> dict[int, tuple[str, str, str]]:
    """Return {schedule_id: (month, approval_status, sync_status)} for the most recent
    incomplete job (not Completed / Refused / Cancelled) prior to target_month_year."""
    if not schedule_ids:
        return {}
    rows = (
        db.query(
            JobInstance.schedule_id,
            JobInstance.target_month_year,
            JobInstance.approval_status,
            JobInstance.sync_status,
        )
        .filter(
            JobInstance.schedule_id.in_(schedule_ids),
            JobInstance.target_month_year < target_month_year,
            JobInstance.sync_status != "Completed",
            JobInstance.approval_status.notin_(["Refused by Customer", "Cancelled"]),
        )
        .order_by(JobInstance.target_month_year.desc())
        .all()
    )
    result: dict[int, tuple[str, str, str]] = {}
    for schedule_id, month, approval_status, sync_status in rows:
        if schedule_id not in result:
            result[schedule_id] = (month, approval_status, sync_status)
    return result


def check_month_has_jobs(db: Session, target_month_year: str) -> bool:
    return (
        db.query(JobInstance).filter(JobInstance.target_month_year == target_month_year).first() is not None
    )
