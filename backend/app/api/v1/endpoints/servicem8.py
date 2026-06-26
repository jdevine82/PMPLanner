from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_staff
from app.models.customer import Customer
from app.servicem8 import client as sm8
from app.servicem8.sync import dispatch_approved_jobs, consolidate_labor_hours

router = APIRouter()


@router.post("/import-customers")
async def import_customers(db: Session = Depends(get_db), _=Depends(require_staff)):
    """Fetch all active SM8 companies and upsert them as local customers.
    Note: phone/email/contact names require the SM8 API key to have Contacts
    permission enabled (ServiceM8 → Staff → API Keys → edit key → Contacts)."""
    try:
        companies = await sm8.fetch_all_companies(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"ServiceM8 error: {e}")

    created = 0
    updated = 0
    for c in companies:
        uuid = c.get("uuid")
        name = c.get("name") or ""
        if not uuid or not name:
            continue

        phone = c.get("_contact_phone") or None
        email = c.get("_contact_email") or None
        primary_contact = c.get("_contact_name") or None

        existing = db.query(Customer).filter(Customer.servicem8_uuid == uuid).first()
        if existing:
            existing.company_name = name
            if phone:
                existing.phone = phone
            if email:
                existing.email = email
            if primary_contact:
                existing.primary_contact = primary_contact
            updated += 1
        else:
            db.add(Customer(
                company_name=name,
                phone=phone,
                email=email,
                primary_contact=primary_contact,
                servicem8_uuid=uuid,
            ))
            created += 1
    db.commit()
    return {"created": created, "updated": updated}


@router.get("/badges")
async def get_badges(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Fetch all active job badges from ServiceM8."""
    try:
        badges = await sm8.fetch_badges(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"ServiceM8 error: {e}")
    return [{"uuid": b.get("uuid"), "name": b.get("name"), "file_name": b.get("file_name", "")} for b in badges]


@router.get("/search-companies")
async def search_companies(term: str = Query(..., min_length=2), db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        results = await sm8.search_companies(db, term)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"ServiceM8 error: {e}")
    return [{"uuid": c.get("uuid"), "name": c.get("name"), "phone": c.get("phone"), "email": c.get("email")} for c in results]


@router.get("/company/{company_uuid}")
async def get_company(company_uuid: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        c = await sm8.fetch_company(db, company_uuid)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"ServiceM8 error: {e}")
    if not c:
        raise HTTPException(404, "Company not found")
    parts = [c.get("address"), c.get("city"), c.get("state"), c.get("post_code")]
    address = ", ".join(p for p in parts if p)
    return {"uuid": c.get("uuid"), "name": c.get("name"), "address": address}


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
async def dispatch_jobs(background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(require_staff)):
    """Kick off background dispatch of all Approved+Unsynced jobs to ServiceM8."""
    background_tasks.add_task(dispatch_approved_jobs, db)
    return {"message": "Dispatch started in background. Refresh job statuses shortly."}


@router.post("/dispatch/sync")
async def dispatch_jobs_sync(db: Session = Depends(get_db), _=Depends(require_staff)):
    """Synchronous dispatch — waits for completion and returns a summary."""
    try:
        result = await dispatch_approved_jobs(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return result


@router.post("/consolidate-hours")
async def consolidate_hours(background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(require_staff)):
    """Pull completed job activity hours back from ServiceM8."""
    background_tasks.add_task(consolidate_labor_hours, db)
    return {"message": "Labor consolidation started in background."}


@router.post("/consolidate-hours/sync")
async def consolidate_hours_sync(db: Session = Depends(get_db), _=Depends(require_staff)):
    try:
        result = await consolidate_labor_hours(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"ServiceM8 error: {e}")
    return result


