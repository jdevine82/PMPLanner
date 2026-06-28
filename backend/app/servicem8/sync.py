"""
Dispatch approved jobs to ServiceM8 and pull back completed labor hours.
Runs as a FastAPI BackgroundTask so the HTTP response returns immediately.
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import Callable

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.customer import Customer
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_template import ServiceTemplate
from app.models.site import Site
from app.models.site_location import SiteLocation
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


def _resolve_sm8_uuid(db: Session, site: Site) -> str | None:
    """Return the effective SM8 company UUID for a site: prefer site-level, fall back to customer-level."""
    if site.servicem8_client_uuid:
        return site.servicem8_client_uuid
    customer = db.get(Customer, site.customer_id)
    return customer.servicem8_uuid if customer else None


def _fmt_month_year(month_year: str) -> str:
    """Convert 'YYYY-MM' to 'Month YYYY', e.g. '2026-06' → 'June 2026'."""
    from datetime import date
    try:
        y, m = int(month_year[:4]), int(month_year[5:7])
        return date(y, m, 1).strftime("%B %Y")
    except (ValueError, IndexError):
        return month_year


def _build_description(
    template: "ServiceTemplate | None",
    site: Site,
    asset_names: list[str],
    sublocation_names: list[str],
    frequency_months: int,
    total_hours: float,
    service_month_year: str,
    custom_instructions: list[str],
) -> str:
    """Build the formatted SM8 job description."""
    lines: list[str] = []

    # Line 1: service month/year
    lines.append(_fmt_month_year(service_month_year))

    # Line 2: service name + interval
    service_title = template.title if template else "Service"
    lines.append(f"{service_title} – {frequency_months} Monthly")

    # Line 3: sub-locations when available (more meaningful than repeated asset names), else asset names
    lines.append(", ".join(sublocation_names) if sublocation_names else ", ".join(asset_names))

    # Line 4: site name
    lines.append(site.site_name)

    # Line 5: estimated hours
    lines.append(f"Estimated hours: {total_hours}")

    # Attachment hyperlinks
    if template and template.attachments:
        for att in template.attachments:
            if not isinstance(att, dict):
                continue
            url = att.get("url", "").strip()
            if not url:
                continue
            label = att.get("label", "").strip()
            lines.append(f"{label}: {url}" if label else url)

    # Custom instructions (per asset or global)
    for note in custom_instructions:
        lines.append(note)

    # Service checklist / instructions
    if template and template.parsed_document_text:
        lines.append(template.parsed_document_text)

    return "\n".join(lines)


async def _dispatch_single(db: Session, job: JobInstance) -> tuple[str, int | None]:
    """Create one SM8 Work Order for a single job instance. Returns (SM8 UUID, job number)."""
    schedule   = db.get(MaintenanceSchedule, job.schedule_id)
    asset      = db.get(Asset, schedule.asset_id)
    site       = db.get(Site, asset.site_id)
    template   = db.get(ServiceTemplate, schedule.service_id)
    sm8_uuid   = _resolve_sm8_uuid(db, site)

    if not sm8_uuid:
        raise ValueError(f"Site {site.id} has no ServiceM8 UUID")

    sublocation_names: list[str] = []
    if asset.location_id:
        loc = db.get(SiteLocation, asset.location_id)
        if loc:
            sublocation_names = [loc.name]

    custom_instructions: list[str] = []
    if schedule.permanent_custom_instructions:
        custom_instructions = [schedule.permanent_custom_instructions]

    description = _build_description(
        template=template,
        site=site,
        asset_names=[asset.asset_name],
        sublocation_names=sublocation_names,
        frequency_months=schedule.frequency_months,
        total_hours=float(schedule.estimated_labor_hours),
        service_month_year=job.target_month_year,
        custom_instructions=custom_instructions,
    )
    logger.info("Dispatching job %d — description:\n%s", job.id, description)

    payload = {
        "status": "Work Order",
        "company_uuid": sm8_uuid,
        "job_address": site.site_address,
        "description": description,
        "job_description": description,
        "work_done_description": (template.work_completed or "") if template else "",
        "badges": json.dumps(_badge_uuids(template)),
    }
    return await sm8.create_job(db, payload)


async def _dispatch_group(db: Session, group_jobs: list[JobInstance]) -> tuple[str, int | None]:
    """Create one SM8 Work Order for a group of job instances. Returns (SM8 UUID, job number)."""
    first_job      = group_jobs[0]
    first_schedule = db.get(MaintenanceSchedule, first_job.schedule_id)
    first_asset    = db.get(Asset, first_schedule.asset_id)
    site           = db.get(Site, first_asset.site_id)
    template       = db.get(ServiceTemplate, first_schedule.service_id)
    sm8_uuid       = _resolve_sm8_uuid(db, site)

    if not sm8_uuid:
        raise ValueError(f"Site {site.id} has no ServiceM8 UUID")

    # Collect all asset names, unique sublocations, total hours, and per-asset instructions
    asset_names: list[str] = []
    seen_subloc: set[int] = set()
    sublocation_names: list[str] = []
    total_hours = 0.0
    frequency_months = first_schedule.frequency_months
    custom_instructions: list[str] = []

    for job in group_jobs:
        sched = db.get(MaintenanceSchedule, job.schedule_id)
        asset = db.get(Asset, sched.asset_id)
        asset_names.append(asset.asset_name)
        total_hours += float(sched.estimated_labor_hours)
        if asset.location_id and asset.location_id not in seen_subloc:
            loc = db.get(SiteLocation, asset.location_id)
            if loc:
                sublocation_names.append(loc.name)
                seen_subloc.add(asset.location_id)
        if sched.permanent_custom_instructions:
            custom_instructions.append(f"{asset.asset_name}: {sched.permanent_custom_instructions}")

    description = _build_description(
        template=template,
        site=site,
        asset_names=asset_names,
        sublocation_names=sublocation_names,
        frequency_months=frequency_months,
        total_hours=round(total_hours, 2),
        service_month_year=first_job.target_month_year,
        custom_instructions=custom_instructions,
    )

    payload = {
        "status": "Work Order",
        "company_uuid": sm8_uuid,
        "job_address": site.site_address,
        "description": description,
        "job_description": description,
        "work_done_description": (template.work_completed or "") if template else "",
        "badges": json.dumps(_badge_uuids(template)),
    }
    return await sm8.create_job(db, payload)


async def dispatch_approved_jobs(
    db: Session,
    notify: Callable[[str], None] | None = None,
    job_ids: list[int] | None = None,
) -> dict:
    """
    For every Approved + Unsynced job, create a Work Order in ServiceM8.
    Jobs sharing an sm8_group_tag at the same site + month are combined into one SM8 job.
    Returns a summary dict with counts.
    """
    q = db.query(JobInstance).filter(
        JobInstance.approval_status == "Approved", JobInstance.sync_status == "Unsynced"
    )
    if job_ids is not None:
        q = q.filter(JobInstance.id.in_(job_ids))
    jobs = q.all()

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
            if not _resolve_sm8_uuid(db, site):
                logger.warning("Job %d skipped — site %d has no ServiceM8 UUID", job.id, site.id)
                skipped += 1
                continue
            sm8_uuid, job_number = await _dispatch_single(db, job)
            job.servicem8_job_uuid = sm8_uuid
            job.servicem8_job_number = job_number
            job.sync_status = "In-Progress"
            db.commit()
            synced += 1
        except Exception as exc:
            logger.error("Failed to dispatch job %d: %s", job.id, exc)
            failed += 1

    # Dispatch grouped jobs — one SM8 job per group
    for group_key, group_jobs in grouped.items():
        try:
            sm8_uuid, job_number = await _dispatch_group(db, group_jobs)
            for job in group_jobs:
                job.servicem8_job_uuid = sm8_uuid
                job.servicem8_job_number = job_number
                job.sync_status = "In-Progress"
            db.commit()
            synced += len(group_jobs)
        except Exception as exc:
            logger.error("Failed to dispatch group %s: %s", group_key, exc)
            failed += len(group_jobs)

    return {"dispatched": synced, "failed": failed, "skipped": skipped}


def _activity_seconds(activity: dict) -> float:
    """Return the duration in seconds for a job activity.

    Prefers total_duration_seconds when present and non-zero; falls back to
    computing the delta from start_date/end_date for accounts that don't use
    check-in/check-out (where total_duration_seconds is null or missing)."""
    secs = activity.get("total_duration_seconds")
    if secs:
        try:
            return float(secs)
        except (TypeError, ValueError):
            pass
    start = activity.get("start_date") or ""
    end = activity.get("end_date") or ""
    if start and end:
        from datetime import datetime
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                delta = datetime.strptime(end, fmt) - datetime.strptime(start, fmt)
                return max(0.0, delta.total_seconds())
            except ValueError:
                continue
    return 0.0


async def consolidate_labor_hours(db: Session) -> dict:
    """
    For all In-Progress jobs with a servicem8_job_uuid, fetch JobActivity from SM8 and
    update actual_labor_hours. Only marks Completed when SM8 reports a done status;
    if hours exist but the job is still open, sync_status stays In-Progress (UI shows
    "Job in Progress"). Grouped jobs sharing an SM8 UUID are fetched once; hours are
    split evenly.
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

    SM8_DONE_STATUSES = {"Completed", "Unsuccessful"}

    for sm8_uuid, uuid_jobs in by_uuid.items():
        try:
            sm8_job, activities = await asyncio.gather(
                sm8.fetch_job(db, sm8_uuid),
                sm8.fetch_job_activities(db, sm8_uuid),
            )

            sm8_status = (sm8_job or {}).get("status", "")
            is_done_in_sm8 = sm8_status in SM8_DONE_STATUSES

            active_activities = [a for a in activities if str(a.get("active", "1")) != "0"]
            total_seconds = sum(_activity_seconds(a) for a in active_activities)
            total_hours = round(total_seconds / 3600, 2)

            logger.info(
                "SM8 job %s: status=%r, activities=%d (active=%d), total_hours=%.2f",
                sm8_uuid, sm8_status, len(activities), len(active_activities), total_hours,
            )

            if is_done_in_sm8 or total_hours > 0:
                per_job_hours = round(total_hours / len(uuid_jobs), 2) if total_hours > 0 else None
                current_group_size = len(uuid_jobs)
                template_ids_to_recalc: set[int] = set()
                for job in uuid_jobs:
                    if per_job_hours is not None:
                        job.actual_labor_hours = per_job_hours
                    job.group_size = current_group_size
                    if is_done_in_sm8:
                        job.sync_status = "Completed"
                        schedule = db.get(MaintenanceSchedule, job.schedule_id)
                        if schedule:
                            from datetime import date
                            schedule.date_last_done = date.today()
                            _advance_next_due(schedule)
                            template_ids_to_recalc.add(schedule.service_id)
                    # else: hours > 0 but not finished — keep sync_status 'In-Progress';
                    # UI shows this as "Job in Progress" via actual_labor_hours > 0

                db.commit()
                updated += len(uuid_jobs)

                for tid in template_ids_to_recalc:
                    template = crud_template.get(db, tid)
                    if template:
                        crud_template.recalculate_average_hours(db, template)

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
