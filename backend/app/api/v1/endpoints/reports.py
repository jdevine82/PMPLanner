import re
from calendar import month_name
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.asset import Asset
from app.models.customer import Customer
from app.models.job_instance import JobInstance
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.service_template import ServiceTemplate
from app.models.site import Site
from app.reports.builder import build_report
from app.reports.call_sheet import build_call_sheet
from app.reports.excel import generate_excel
from app.reports.pdf import generate_pdf, generate_call_sheet_pdf, generate_workload_schedule_pdf
from app.reports.workload_schedule import build_workload_schedule

router = APIRouter()

MONTH_YEAR_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


@router.get("/incomplete-prior")
def get_incomplete_prior_jobs(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    current_month_year = date.today().strftime("%Y-%m")
    rows = (
        db.query(JobInstance, MaintenanceSchedule, Asset, Site, Customer, ServiceTemplate)
        .join(MaintenanceSchedule, JobInstance.schedule_id == MaintenanceSchedule.id)
        .join(Asset, MaintenanceSchedule.asset_id == Asset.id)
        .join(Site, Asset.site_id == Site.id)
        .join(Customer, Site.customer_id == Customer.id)
        .join(ServiceTemplate, MaintenanceSchedule.service_id == ServiceTemplate.id)
        .filter(
            JobInstance.target_month_year < current_month_year,
            JobInstance.sync_status.notin_(["Completed", "Bypassed"]),
            JobInstance.approval_status != "Refused by Customer",
        )
        .order_by(JobInstance.target_month_year.desc(), Customer.company_name, Asset.asset_name)
        .all()
    )

    def combined_status(j: JobInstance) -> str:
        if j.sync_status == "In-Progress":
            return "Job in Progress" if j.actual_labor_hours else "Sent to SM8"
        if j.approval_status == "Waiting Approval":
            return "Pending Approval"
        return "Approved"

    return [
        {
            "month":            j.target_month_year,
            "customer_name":    c.company_name,
            "site_name":        s.site_name,
            "asset_name":       a.asset_name,
            "service_title":    t.title,
            "status":           combined_status(j),
            "estimated_hours":  float(ms.estimated_labor_hours),
        }
        for j, ms, a, s, c, t in rows
    ]


@router.get("/call-sheet/{month_year}/pdf")
def download_call_sheet(
    month_year: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if not MONTH_YEAR_RE.match(month_year):
        raise HTTPException(400, "month_year must be in YYYY-MM format")
    data = build_call_sheet(db, month_year)
    try:
        pdf_bytes = generate_call_sheet_pdf(data)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {e}")
    filename = f"Call_Sheet_{month_year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/workload-schedule/pdf")
def download_workload_schedule(
    forecast_months: int = Query(12, ge=1, le=24),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    data = build_workload_schedule(db, forecast_months)
    try:
        pdf_bytes = generate_workload_schedule_pdf(data)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {e}")
    from datetime import date
    filename = f"Workload_Schedule_{date.today().isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{customer_id}")
def get_report_data(
    customer_id: int,
    forecast_months: int = Query(12, ge=1, le=24),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        return build_report(db, customer_id, forecast_months)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/{customer_id}/pdf")
def download_pdf(
    customer_id: int,
    forecast_months: int = Query(12, ge=1, le=24),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        data = build_report(db, customer_id, forecast_months)
    except ValueError as e:
        raise HTTPException(404, str(e))

    try:
        pdf_bytes = generate_pdf(data)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {e}")

    filename = f"PM_Report_{data['customer']['company_name'].replace(' ', '_')}_{data['generated_date']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{customer_id}/xlsx")
def download_excel(
    customer_id: int,
    forecast_months: int = Query(12, ge=1, le=24),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        data = build_report(db, customer_id, forecast_months)
    except ValueError as e:
        raise HTTPException(404, str(e))

    try:
        xlsx_bytes = generate_excel(data)
    except Exception as e:
        raise HTTPException(500, f"Excel generation failed: {e}")

    filename = f"PM_Report_{data['customer']['company_name'].replace(' ', '_')}_{data['generated_date']}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
