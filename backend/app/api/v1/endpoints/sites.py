from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin, require_staff
from app.crud import site as crud
from app.schemas.site import SiteCreate, SiteOut, SiteUpdate

router = APIRouter()


@router.get("", response_model=list[SiteOut])
def list_sites(customer_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if customer_id:
        return crud.get_by_customer(db, customer_id)
    from sqlalchemy import select
    from app.models.site import Site
    return db.execute(select(Site)).scalars().all()


@router.post("", response_model=SiteOut, status_code=201)
def create_site(data: SiteCreate, db: Session = Depends(get_db), _=Depends(require_staff)):
    return crud.create(db, data)


@router.get("/{site_id}", response_model=SiteOut)
def get_site(site_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, site_id)
    if not obj:
        raise HTTPException(404, "Site not found")
    return obj


@router.patch("/{site_id}", response_model=SiteOut)
def update_site(site_id: int, data: SiteUpdate, db: Session = Depends(get_db), _=Depends(require_staff)):
    obj = crud.get(db, site_id)
    if not obj:
        raise HTTPException(404, "Site not found")
    return crud.update(db, obj, data)


@router.delete("/{site_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_site(site_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, site_id)
    if not obj:
        raise HTTPException(404, "Site not found")
    crud.delete(db, obj)
