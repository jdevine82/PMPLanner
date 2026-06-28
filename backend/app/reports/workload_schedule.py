from calendar import month_abbr, monthrange
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.customer import Customer
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_template import ServiceTemplate
from app.models.site import Site


def build_workload_schedule(db: Session, forecast_months: int = 12) -> dict[str, Any]:
    today = date.today()

    month_tuples: list[tuple[int, int]] = []
    for i in range(forecast_months):
        m = today.month + i
        y = today.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        month_tuples.append((y, m))

    month_strs = [f"{y}-{m:02d}" for y, m in month_tuples]

    month_labels = []
    for i, (y, m) in enumerate(month_tuples):
        show_year = (i == 0 or y != month_tuples[i - 1][0])
        month_labels.append({"abbr": month_abbr[m], "year": str(y) if show_year else ""})

    last_y, last_m = month_tuples[-1]
    cutoff = date(last_y, last_m, monthrange(last_y, last_m)[1])

    schedules = db.query(MaintenanceSchedule).all()
    empty_result = {
        "generated_date": today.isoformat(),
        "forecast_months": forecast_months,
        "month_labels": month_labels,
        "rows": [],
        "totals": [0.0] * forecast_months,
        "grand_total_hours": 0.0,
        "total_tasks": 0,
    }
    if not schedules:
        return empty_result

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

    month_str_set = set(month_strs)
    month_idx_map = {ms: i for i, ms in enumerate(month_strs)}

    rows = []
    totals = [0.0] * forecast_months

    for s in schedules:
        if not s.date_next_due or s.frequency_months <= 0:
            continue
        asset = asset_map.get(s.asset_id)
        if not asset:
            continue
        site = site_map.get(asset.site_id)
        if not site:
            continue
        customer = customer_map.get(site.customer_id)
        if not customer:
            continue
        template = template_map.get(s.service_id)

        hours = float(s.estimated_labor_hours)
        month_hours: list[float | None] = [None] * forecast_months

        current = s.date_next_due
        while current <= cutoff:
            ms = f"{current.year}-{current.month:02d}"
            if ms in month_str_set:
                idx = month_idx_map[ms]
                month_hours[idx] = hours
                totals[idx] += hours

            m = current.month + s.frequency_months
            y = current.year + (m - 1) // 12
            m = (m - 1) % 12 + 1
            current = date(y, m, min(current.day, monthrange(y, m)[1]))

        if any(h is not None for h in month_hours):
            rows.append({
                "customer_name": customer.company_name,
                "customer_id": customer.id,
                "task_name": template.title if template else "—",
                "frequency": s.frequency_months,
                "estimated_hours": hours,
                "month_hours": month_hours,
            })

    rows.sort(key=lambda r: (r["customer_name"].lower(), r["task_name"].lower()))

    return {
        "generated_date": today.isoformat(),
        "forecast_months": forecast_months,
        "month_labels": month_labels,
        "rows": rows,
        "totals": totals,
        "grand_total_hours": sum(totals),
        "total_tasks": len(rows),
    }
