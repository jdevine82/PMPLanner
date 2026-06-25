"""
Dispatch approved jobs to ServiceM8 and pull back completed labor hours.
Runs as a FastAPI BackgroundTask so the HTTP response returns immediately.
"""
import logging
from typing import Callable

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.site import Site
from app.servicem8 import client as sm8

logger = logging.getLogger(__name__)


async def dispatch_approved_jobs(db: Session, notify: Callable[[str], None] | None = None) -> dict:
    """
    For every Approved + Unsynced job, create a Work Order in ServiceM8.
    Returns a summary dict with counts.
    """
    jobs = (
        db.query(JobInstance)
        .filter(JobInstance.approval_status == "Approved", JobInstance.sync_status == "Unsynced")
        .all()
    )

    synced = 0
    failed = 0

    for job in jobs:
        try:
            schedule = db.get(MaintenanceSchedule, job.schedule_id)
            asset    = db.get(Asset, schedule.asset_id)
            site     = db.get(Site, asset.site_id)

            if not site.servicem8_client_uuid:
                logger.warning("Job %d skipped — site %d has no ServiceM8 UUID", job.id, site.id)
                continue

            description_lines = [
                f"Preventative Maintenance: {asset.asset_name}",
                f"Service: {schedule.service_id}",
                f"Estimated hours: {schedule.estimated_labor_hours}",
            ]
            if schedule.permanent_custom_instructions:
                description_lines.append(f"\nInstructions: {schedule.permanent_custom_instructions}")

            payload = {
                "status": "Work Order",
                "company_uuid": site.servicem8_client_uuid,
                "job_address": site.site_address,
                "description": "\n".join(description_lines),
            }

            sm8_uuid = await sm8.create_job(db, payload)

            job.servicem8_job_uuid = sm8_uuid
            job.sync_status = "In-Progress"
            db.commit()
            synced += 1

        except Exception as exc:
            logger.error("Failed to dispatch job %d: %s", job.id, exc)
            failed += 1

    return {"dispatched": synced, "failed": failed, "skipped": len(jobs) - synced - failed}


async def consolidate_labor_hours(db: Session) -> dict:
    """
    For all In-Progress jobs with a servicem8_job_uuid, fetch JobActivity from SM8,
    sum the hours, mark as Completed, and update template averages.
    """
    from app.crud import service_template as crud_template

    jobs = (
        db.query(JobInstance)
        .filter(
            JobInstance.sync_status == "In-Progress",
            JobInstance.servicem8_job_uuid.isnot(None),
        )
        .all()
    )

    updated = 0
    failed = 0

    for job in jobs:
        try:
            activities = await sm8.fetch_job_activities(db, job.servicem8_job_uuid)

            # ServiceM8 JobActivity uses `total_duration_seconds` field
            total_seconds = sum(
                float(a.get("total_duration_seconds", 0) or 0) for a in activities
            )
            total_hours = round(total_seconds / 3600, 2)

            if total_hours > 0:
                job.actual_labor_hours = total_hours
                job.sync_status = "Completed"

                # Update schedule date_last_done
                schedule = db.get(MaintenanceSchedule, job.schedule_id)
                if schedule:
                    from datetime import date
                    schedule.date_last_done = date.today()
                    _advance_next_due(schedule)

                    # Recalculate template average hours
                    template = crud_template.get(db, schedule.service_id)
                    if template:
                        crud_template.recalculate_average_hours(db, template)

                db.commit()
                updated += 1

        except Exception as exc:
            logger.error("Labor consolidation failed for job %d: %s", job.id, exc)
            failed += 1

    return {"updated": updated, "failed": failed}


def _advance_next_due(schedule: MaintenanceSchedule) -> None:
    """Advance date_next_due by frequency_months from today."""
    from calendar import monthrange
    from datetime import date

    today = date.today()
    m = today.month + schedule.frequency_months
    y = today.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    last_day = monthrange(y, m)[1]
    schedule.date_next_due = date(y, m, min(today.day, last_day))
