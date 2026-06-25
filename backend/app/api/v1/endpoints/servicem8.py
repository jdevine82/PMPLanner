from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.servicem8 import client as sm8
from app.servicem8.sync import dispatch_approved_jobs, consolidate_labor_hours

router = APIRouter()


@router.get("/search-companies")
async def search_companies(term: str = Query(..., min_length=2), db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        results = await sm8.search_companies(db, term)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"ServiceM8 error: {e}")
    return [{"uuid": c.get("uuid"), "name": c.get("name"), "phone": c.get("phone"), "email": c.get("email")} for c in results]


@router.get("/company-assets/{company_uuid}")
async def company_assets(company_uuid: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        results = await sm8.fetch_assets_for_company(db, company_uuid)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"ServiceM8 error: {e}")
    return [
        {
            "uuid":        a.get("uuid"),
            "name":        a.get("name"),
            "serial":      a.get("serial_number"),
            "model":       a.get("asset_type"),
        }
        for a in results
    ]


@router.post("/dispatch")
async def dispatch_jobs(background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Kick off background dispatch of all Approved+Unsynced jobs to ServiceM8."""
    background_tasks.add_task(dispatch_approved_jobs, db)
    return {"message": "Dispatch started in background. Refresh job statuses shortly."}


@router.post("/dispatch/sync")
async def dispatch_jobs_sync(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Synchronous dispatch — waits for completion and returns a summary."""
    try:
        result = await dispatch_approved_jobs(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return result


@router.post("/consolidate-hours")
async def consolidate_hours(background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Pull completed job activity hours back from ServiceM8."""
    background_tasks.add_task(consolidate_labor_hours, db)
    return {"message": "Labor consolidation started in background."}


@router.post("/consolidate-hours/sync")
async def consolidate_hours_sync(db: Session = Depends(get_db), _=Depends(get_current_user)):
    result = await consolidate_labor_hours(db)
    return result
