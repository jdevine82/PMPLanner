"""
Assembles all data required for a customer report.
Returns a plain dict that is passed to both the PDF/Excel generators
and the JSON preview endpoint.
"""
from calendar import monthrange
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.customer import Customer
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_template import ServiceTemplate
from app.models.site import Site


def build_report(db: Session, customer_id: int, forecast_months: int = 12) -> dict[str, Any]:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    sites = db.query(Site).filter(Site.customer_id == customer_id).all()
    site_ids = [s.id for s in sites]

    assets = db.query(Asset).filter(Asset.site_id.in_(site_ids)).all()
    asset_ids = [a.id for a in assets]
    asset_map = {a.id: a for a in assets}
    site_map  = {s.id: s for s in sites}

    schedules = db.query(MaintenanceSchedule).filter(MaintenanceSchedule.asset_id.in_(asset_ids)).all()
    schedule_ids = [s.id for s in schedules]
    schedule_map = {s.id: s for s in schedules}

    template_ids = list({s.service_id for s in schedules})
    templates = db.query(ServiceTemplate).filter(ServiceTemplate.id.in_(template_ids)).all()
    template_map = {t.id: t for t in templates}

    # Completed and refused job history
    history_jobs = (
        db.query(JobInstance)
        .filter(
            JobInstance.schedule_id.in_(schedule_ids),
            JobInstance.approval_status.in_(["Approved", "Refused by Customer"]),
        )
        .order_by(JobInstance.target_month_year.desc())
        .all()
    )

    return {
        "customer":         _customer_dict(customer),
        "generated_date":   date.today().isoformat(),
        "forecast_months":  forecast_months,
        "asset_inventory":  _build_inventory(assets, asset_map, site_map),
        "scheduling":       _build_scheduling(schedules, asset_map, template_map),
        "history":          _build_history(history_jobs, schedule_map, asset_map, template_map),
        "forecast":         _build_forecast(schedules, asset_map, template_map, forecast_months),
    }


# ── section builders ─────────────────────────────────────────────────────────

def _customer_dict(c: Customer) -> dict:
    return {"id": c.id, "company_name": c.company_name, "primary_contact": c.primary_contact, "phone": c.phone, "email": c.email}


def _build_inventory(assets: list[Asset], asset_map: dict, site_map: dict) -> list[dict]:
    rows = []
    for a in assets:
        site = site_map.get(a.site_id)
        rows.append({
            "asset_name":   a.asset_name,
            "serial_number": a.serial_number or "—",
            "model_number":  a.model_number or "—",
            "location":      site.site_name if site else "—",
        })
    return rows


def _build_scheduling(schedules: list[MaintenanceSchedule], asset_map: dict, template_map: dict) -> list[dict]:
    rows = []
    for s in schedules:
        asset    = asset_map.get(s.asset_id)
        template = template_map.get(s.service_id)
        rows.append({
            "asset_name":        asset.asset_name if asset else "—",
            "service_title":     template.title if template else "—",
            "frequency":         f"Every {s.frequency_months} month(s)",
            "estimated_hours":   float(s.estimated_labor_hours),
            "date_next_due":     s.date_next_due.isoformat() if s.date_next_due else "—",
            "date_last_done":    s.date_last_done.isoformat() if s.date_last_done else "Never",
        })
    return rows


def _build_history(jobs: list[JobInstance], schedule_map: dict, asset_map: dict, template_map: dict) -> list[dict]:
    rows = []
    for j in jobs:
        schedule = schedule_map.get(j.schedule_id)
        asset    = asset_map.get(schedule.asset_id) if schedule else None
        template = template_map.get(schedule.service_id) if schedule else None
        rows.append({
            "month":           j.target_month_year,
            "asset_name":      asset.asset_name if asset else "—",
            "service_title":   template.title if template else "—",
            "status":          j.approval_status,
            "actual_hours":    float(j.actual_labor_hours) if j.actual_labor_hours else None,
            "refusal_reason":  j.refusal_reason,
            "sync_status":     j.sync_status,
        })
    return rows


def _build_forecast(
    schedules: list[MaintenanceSchedule],
    asset_map: dict,
    template_map: dict,
    forecast_months: int,
) -> list[dict]:
    today    = date.today()
    cutoff_m = today.month + forecast_months
    cutoff_y = today.year + (cutoff_m - 1) // 12
    cutoff_m = (cutoff_m - 1) % 12 + 1
    cutoff   = date(cutoff_y, cutoff_m, monthrange(cutoff_y, cutoff_m)[1])

    rows = []
    for s in schedules:
        if not s.date_next_due:
            continue
        asset    = asset_map.get(s.asset_id)
        template = template_map.get(s.service_id)

        current = s.date_next_due
        while current <= cutoff:
            if current >= today:
                rows.append({
                    "due_date":       current.isoformat(),
                    "asset_name":     asset.asset_name if asset else "—",
                    "service_title":  template.title if template else "—",
                    "estimated_hours": float(s.estimated_labor_hours),
                })
            # advance by frequency
            m = current.month + s.frequency_months
            y = current.year + (m - 1) // 12
            m = (m - 1) % 12 + 1
            current = date(y, m, min(current.day, monthrange(y, m)[1]))

    rows.sort(key=lambda r: r["due_date"])
    return rows
