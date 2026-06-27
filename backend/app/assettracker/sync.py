"""
Dispatch approved jobs to AssetTracker and pull back completed work orders.
"""
import logging
from datetime import date

from sqlalchemy.orm import Session

from app.assettracker import client as at
from app.models.app_setting import AppSetting
from app.models.asset import Asset
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_template import ServiceTemplate
from app.models.site import Site

logger = logging.getLogger(__name__)

AT_DONE_STATUSES = {"completed", "closed"}


def _get_default_asset_id(db: Session) -> int:
    setting = db.query(AppSetting).first()
    if not setting or not setting.assettracker_default_asset_id:
        raise ValueError(
            "AssetTracker default asset ID is not configured. "
            "Set it in Settings → AssetTracker Integration."
        )
    return setting.assettracker_default_asset_id


def _build_wo_payload(job: JobInstance, db: Session, default_asset_id: int) -> dict:
    schedule = db.get(MaintenanceSchedule, job.schedule_id)
    asset = db.get(Asset, schedule.asset_id)
    site = db.get(Site, asset.site_id)
    template = db.get(ServiceTemplate, schedule.service_id)

    title = f"PM: {template.title} — {asset.asset_name}" if template else f"PM: {asset.asset_name}"

    lines = [f"Asset: {asset.asset_name}"]
    if site:
        lines.append(f"Site: {site.site_name}")
    if template and template.parsed_document_text:
        lines.append(f"\n{template.parsed_document_text}")
    if schedule.permanent_custom_instructions:
        lines.append(f"\nInstructions: {schedule.permanent_custom_instructions}")
    lines.append(f"\nEstimated hours: {schedule.estimated_labor_hours}")
    lines.append(f"PMPlanner job ID: {job.id} | Month: {job.target_month_year}")

    # Schedule to first day of target month
    year, month = job.target_month_year.split("-")
    scheduled_date = date(int(year), int(month), 1).isoformat()

    return {
        "asset_id": default_asset_id,
        "title": title[:255],
        "description": "\n".join(lines),
        "priority": "medium",
        "status": "open",
        "date_scheduled": scheduled_date,
        "estimated_cost": 0.0,
        "notes": f"Created by PMPlanner | Job ID: {job.id}",
    }


async def dispatch_approved_jobs(db: Session) -> dict:
    """
    For every Approved + Unsynced job with no assettracker_wo_id, create a Work Order
    in AssetTracker. Updates assettracker_wo_id on success.
    """
    setting = db.query(AppSetting).first()
    if not setting or not setting.assettracker_enabled:
        return {"dispatched": 0, "failed": 0, "skipped": 0, "message": "AssetTracker integration is disabled"}

    jobs = (
        db.query(JobInstance)
        .filter(
            JobInstance.approval_status == "Approved",
            JobInstance.sync_status == "Unsynced",
            JobInstance.assettracker_wo_id.is_(None),
        )
        .all()
    )

    dispatched = 0
    failed = 0
    skipped = 0

    try:
        default_asset_id = _get_default_asset_id(db)
    except ValueError as e:
        return {"dispatched": 0, "failed": 0, "skipped": len(jobs), "message": str(e)}

    for job in jobs:
        try:
            payload = _build_wo_payload(job, db, default_asset_id)
            wo = await at.create_work_order(db, payload)
            job.assettracker_wo_id = wo["id"]
            job.sync_status = "In-Progress"
            db.commit()
            dispatched += 1
            logger.info("Dispatched job %d to AssetTracker WO %s", job.id, wo.get("work_order_number"))
        except Exception as exc:
            logger.error("Failed to dispatch job %d to AssetTracker: %s", job.id, exc)
            failed += 1

    return {"dispatched": dispatched, "failed": failed, "skipped": skipped}


async def pull_completed_from_assettracker(db: Session) -> dict:
    """
    For all jobs with an assettracker_wo_id and sync_status In-Progress,
    check the AssetTracker WO status. Mark Completed when the WO is done.
    """
    setting = db.query(AppSetting).first()
    if not setting or not setting.assettracker_enabled:
        return {"updated": 0, "failed": 0, "message": "AssetTracker integration is disabled"}

    jobs = (
        db.query(JobInstance)
        .filter(
            JobInstance.assettracker_wo_id.isnot(None),
            JobInstance.sync_status == "In-Progress",
        )
        .all()
    )

    updated = 0
    failed = 0

    for job in jobs:
        try:
            wo = await at.get_work_order(db, job.assettracker_wo_id)
            if wo is None:
                logger.warning("AssetTracker WO %d not found for job %d", job.assettracker_wo_id, job.id)
                continue

            status = (wo.get("status") or "").lower()
            if status in AT_DONE_STATUSES:
                job.sync_status = "Completed"
                if wo.get("actual_cost") is not None:
                    pass  # actual cost not tracked on PMPlanner job, but could be added later
                db.commit()
                updated += 1
                logger.info("Job %d marked Completed from AssetTracker WO %d", job.id, job.assettracker_wo_id)
        except Exception as exc:
            logger.error("Failed to pull status for job %d (AT WO %d): %s", job.id, job.assettracker_wo_id, exc)
            failed += 1

    return {"updated": updated, "failed": failed}
