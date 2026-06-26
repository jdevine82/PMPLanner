from calendar import month_name
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.customer import Customer
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_template import ServiceTemplate
from app.models.site import Site


def build_call_sheet(db: Session, month_year: str) -> dict[str, Any]:
    year, month = int(month_year[:4]), int(month_year[5:])
    month_label = f"{month_name[month]} {year}"

    jobs = db.query(JobInstance).filter(JobInstance.target_month_year == month_year).all()
    if not jobs:
        return {
            "month_label": month_label,
            "generated_date": date.today().isoformat(),
            "total_jobs": 0,
            "total_hours": 0.0,
            "customers": [],
        }

    schedule_ids = list({j.schedule_id for j in jobs})
    schedules = db.query(MaintenanceSchedule).filter(MaintenanceSchedule.id.in_(schedule_ids)).all()
    schedule_map = {s.id: s for s in schedules}

    asset_ids = list({s.asset_id for s in schedules})
    assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
    asset_map = {a.id: a for a in assets}

    site_ids = list({a.site_id for a in assets})
    sites = db.query(Site).filter(Site.id.in_(site_ids)).all()
    site_map = {s.id: s for s in sites}

    customer_ids = list({s.customer_id for s in sites})
    customers = db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
    customer_map = {c.id: c for c in customers}

    template_ids = list({s.service_id for s in schedules})
    templates = db.query(ServiceTemplate).filter(ServiceTemplate.id.in_(template_ids)).all()
    template_map = {t.id: t for t in templates}

    # Group jobs by customer
    groups: dict[int, dict] = {}
    for job in jobs:
        schedule = schedule_map.get(job.schedule_id)
        if not schedule:
            continue
        asset = asset_map.get(schedule.asset_id)
        if not asset:
            continue
        site = site_map.get(asset.site_id)
        if not site:
            continue
        customer = customer_map.get(site.customer_id)
        if not customer:
            continue
        template = template_map.get(schedule.service_id)

        cid = customer.id
        if cid not in groups:
            groups[cid] = {
                "company_name": customer.company_name,
                "primary_contact": customer.primary_contact,
                "phone": customer.phone,
                "email": customer.email,
                "jobs": [],
                "total_hours": 0.0,
            }
        hours = float(schedule.estimated_labor_hours)
        groups[cid]["jobs"].append({
            "site_name": site.site_name,
            "asset_name": asset.asset_name,
            "service_title": template.title if template else "—",
            "estimated_hours": hours,
            "approval_status": job.approval_status,
        })
        groups[cid]["total_hours"] += hours

    for g in groups.values():
        g["job_count"] = len(g["jobs"])
        g["jobs"].sort(key=lambda j: (j["site_name"], j["asset_name"]))

    sorted_groups = sorted(groups.values(), key=lambda g: g["company_name"])
    total_hours = sum(g["total_hours"] for g in sorted_groups)

    return {
        "month_label": month_label,
        "generated_date": date.today().isoformat(),
        "total_jobs": len(jobs),
        "total_hours": total_hours,
        "customers": sorted_groups,
    }
