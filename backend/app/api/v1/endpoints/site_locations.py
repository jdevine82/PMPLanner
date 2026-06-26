from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin, require_staff
from app.crud import site_location as crud
from app.schemas.site_location import SiteLocationCreate, SiteLocationOut, SiteLocationUpdate

router = APIRouter()


@router.get("", response_model=list[SiteLocationOut])
def list_site_locations(site_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if site_id:
        return crud.get_by_site(db, site_id)
    from sqlalchemy import select
    from app.models.site_location import SiteLocation
    return db.execute(select(SiteLocation).order_by(SiteLocation.name)).scalars().all()


@router.post("", response_model=SiteLocationOut, status_code=201)
def create_site_location(data: SiteLocationCreate, db: Session = Depends(get_db), _=Depends(require_staff)):
    return crud.create(db, data)


@router.get("/{location_id}", response_model=SiteLocationOut)
def get_site_location(location_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, location_id)
    if not obj:
        raise HTTPException(404, "Location not found")
    return obj


@router.patch("/{location_id}", response_model=SiteLocationOut)
def update_site_location(location_id: int, data: SiteLocationUpdate, db: Session = Depends(get_db), _=Depends(require_staff)):
    obj = crud.get(db, location_id)
    if not obj:
        raise HTTPException(404, "Location not found")
    return crud.update(db, obj, data)


@router.delete("/{location_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_site_location(location_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, location_id)
    if not obj:
        raise HTTPException(404, "Location not found")
    crud.delete(db, obj)
