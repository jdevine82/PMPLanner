import re
from calendar import month_name

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.reports.builder import build_report
from app.reports.call_sheet import build_call_sheet
from app.reports.excel import generate_excel
from app.reports.pdf import generate_pdf, generate_call_sheet_pdf

router = APIRouter()

MONTH_YEAR_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


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
