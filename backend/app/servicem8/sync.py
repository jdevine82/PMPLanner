"""
Dispatch approved jobs to ServiceM8 and pull back completed labor hours.
Runs as a FastAPI BackgroundTask so the HTTP response returns immediately.
"""
import json
import logging
from collections import defaultdict
from typing import Callable

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_template import ServiceTemplate
from app.models.site import Site
from app.servicem8 import client as sm8

logger = logging.getLogger(__name__)


def _badge_uuids(template: ServiceTemplate | None) -> list[str]:
    if not template or not template.job_badges:
        return []
    return [
        b.get("uuid") if isinstance(b, dict) else b
        for b in template.job_badges
        if (b.get("uuid") if isinstance(b, dict) else b)
    ]


async def _dispatch_single(db: Session, job: JobInstance) -> str:
    """Create one SM8 Work Order for a single job instance. Returns SM8 UUID."""
    schedule = db.get(MaintenanceSchedule, job.schedule_id)
    asset    = db.get(Asset, schedule.asset_id)
    site     = db.get(Site, asset.site_id)
    template = db.get(ServiceTemplate, schedule.service_id)

    if not site.servicem8_client_uuid:
        raise ValueError(f"Site {site.id} has no ServiceM8 UUID")

    checklist_lines = [
        f"Preventative Maintenance: {asset.asset_name}",
        f"Estimated hours: {schedule.estimated_labor_hours}",
    ]
    if schedule.permanent_custom_instructions:
        checklist_lines.append(f"\nInstructions: {schedule.permanent_custom_instructions}")

    payload = {
        "status": "Work Order",
        "company_uuid": site.servicem8_client_uuid,
        "job_address": site.site_address,
        "description": "\n".join(checklist_lines),
        "job_description": (template.job_description or "") if template else "",
        "work_done_description": (template.work_completed or "") if template else "",
        "badges": json.dumps(_badge_uuids(template)),
    }
    return await sm8.create_job(db, payload)


async def _dispatch_group(db: Session, group_jobs: list[JobInstance]) -> str:
    """Create one SM8 Work Order for a group of job instances. Returns SM8 UUID."""
    first_job = group_jobs[0]
    first_schedule = db.get(MaintenanceSchedule, first_job.schedule_id)
    first_asset    = db.get(Asset, first_schedule.asset_id)
    site           = db.get(Site, first_asset.site_id)
    template       = db.get(ServiceTemplate, first_schedule.service_id)

    if not site.servicem8_client_uuid:
        raise ValueError(f"Site {site.id} has no ServiceM8 UUID")

    # Collect all asset names and total estimated hours across the group
    asset_names = []
    total_hours = 0.0
    notes: list[str] = []
    for job in group_jobs:
        sched  = db.get(MaintenanceSchedule, job.schedule_id)
        asset  = db.get(Asset, sched.asset_id)
        asset_names.append(asset.asset_name)
        total_hours += float(sched.estimated_labor_hours)
        if sched.permanent_custom_instructions:
            notes.append(f"{asset.asset_name}: {sched.permanent_custom_instructions}")

    checklist_lines = [
        f"Preventative Maintenance: {', '.join(asset_names)}",
        f"Estimated hours: {round(total_hours, 2)}",
    ]
    if notes:
        checklist_lines.append("\nInstructions:\n" + "\n".join(notes))

    payload = {
        "status": "Work Order",
        "company_uuid": site.servicem8_client_uuid,
        "job_address": site.site_address,
        "description": "\n".join(checklist_lines),
        "job_description": (template.job_description or "") if template else "",
        "work_done_description": (template.work_completed or "") if template else "",
        "badges": json.dumps(_badge_uuids(template)),
    }
    return await sm8.create_job(db, payload)


async def dispatch_approved_jobs(db: Session, notify: Callable[[str], None] | None = None) -> dict:
    """
    For every Approved + Unsynced job, create a Work Order in ServiceM8.
    Jobs sharing an sm8_group_tag at the same site + month are combined into one SM8 job.
    Returns a summary dict with counts.
    """
    jobs = (
        db.query(JobInstance)
        .filter(JobInstance.approval_status == "Approved", JobInstance.sync_status == "Unsynced")
        .all()
    )

    synced = 0
    failed = 0
    skipped = 0

    # Separate grouped jobs from ungrouped
    # Group key: (site_id, sm8_group_tag, target_month_year)
    grouped: dict[tuple, list[JobInstance]] = defaultdict(list)
    ungrouped: list[JobInstance] = []

    for job in jobs:
        schedule = db.get(MaintenanceSchedule, job.schedule_id)
        if schedule and schedule.sm8_group_tag:
            asset = db.get(Asset, schedule.asset_id)
            site  = db.get(Site, asset.site_id)
            key   = (site.id, schedule.sm8_group_tag, job.target_month_year)
            grouped[key].append(job)
        else:
            ungrouped.append(job)

    # Dispatch ungrouped jobs individually
    for job in ungrouped:
        try:
            schedule = db.get(MaintenanceSchedule, job.schedule_id)
            asset    = db.get(Asset, schedule.asset_id)
            site     = db.get(Site, asset.site_id)
            if not site.servicem8_client_uuid:
                logger.warning("Job %d skipped — site %d has no ServiceM8 UUID", job.id, site.id)
                skipped += 1
                continue
            sm8_uuid = await _dispatch_single(db, job)
            job.servicem8_job_uuid = sm8_uuid
            job.sync_status = "In-Progress"
            db.commit()
            synced += 1
        except Exception as exc:
            logger.error("Failed to dispatch job %d: %s", job.id, exc)
            failed += 1

    # Dispatch grouped jobs — one SM8 job per group
    for group_key, group_jobs in grouped.items():
        try:
            sm8_uuid = await _dispatch_group(db, group_jobs)
            for job in group_jobs:
                job.servicem8_job_uuid = sm8_uuid
                job.sync_status = "In-Progress"
            db.commit()
            synced += len(group_jobs)
        except Exception as exc:
            logger.error("Failed to dispatch group %s: %s", group_key, exc)
            failed += len(group_jobs)

    return {"dispatched": synced, "failed": failed, "skipped": skipped}


async def consolidate_labor_hours(db: Session) -> dict:
    """
    For all In-Progress jobs with a servicem8_job_uuid, fetch JobActivity from SM8,
    sum the hours, mark as Completed, and update template averages.
    Grouped jobs sharing an SM8 UUID are only fetched once; hours are split evenly.
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

    # Group by SM8 UUID so we don't fetch the same job's activities multiple times
    by_uuid: dict[str, list[JobInstance]] = defaultdict(list)
    for job in jobs:
        by_uuid[job.servicem8_job_uuid].append(job)

    updated = 0
    failed = 0

    for sm8_uuid, uuid_jobs in by_uuid.items():
        try:
            activities = await sm8.fetch_job_activities(db, sm8_uuid)
            total_seconds = sum(float(a.get("total_duration_seconds", 0) or 0) for a in activities)
            total_hours = round(total_seconds / 3600, 2)

            if total_hours > 0:
                per_job_hours = round(total_hours / len(uuid_jobs), 2)
                for job in uuid_jobs:
                    job.actual_labor_hours = per_job_hours
                    job.sync_status = "Completed"

                    schedule = db.get(MaintenanceSchedule, job.schedule_id)
                    if schedule:
                        from datetime import date
                        schedule.date_last_done = date.today()
                        _advance_next_due(schedule)
                        template = crud_template.get(db, schedule.service_id)
                        if template:
                            crud_template.recalculate_average_hours(db, template)

                db.commit()
                updated += len(uuid_jobs)

        except Exception as exc:
            logger.error("Labor consolidation failed for SM8 job %s: %s", sm8_uuid, exc)
            failed += len(uuid_jobs)

    return {"updated": updated, "failed": failed}


def _advance_next_due(schedule: MaintenanceSchedule) -> None:
    """Advance date_next_due by frequency_months from today.

    If date_anchor_next_due is set (meaning the job was pulled forward), restore
    the original scheduled date instead of advancing from today, so the subsequent
    cycle stays on the original cadence."""
    from calendar import monthrange
    from datetime import date

    if schedule.date_anchor_next_due is not None:
        schedule.date_next_due = schedule.date_anchor_next_due
        schedule.date_anchor_next_due = None
        return

    today = date.today()
    m = today.month + schedule.frequency_months
    y = today.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    last_day = monthrange(y, m)[1]
    schedule.date_next_due = date(y, m, min(today.day, last_day))
