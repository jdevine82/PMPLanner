from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin, require_staff
from app.crud import asset as crud
from app.models.site import Site
from app.models.site_location import SiteLocation
from app.schemas.asset import AssetCreate, AssetOut, AssetTransfer, AssetUpdate

router = APIRouter()


@router.get("", response_model=list[AssetOut])
def list_assets(site_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if site_id:
        return crud.get_by_site(db, site_id)
    from sqlalchemy import select
    from app.models.asset import Asset
    return db.execute(select(Asset)).scalars().all()


@router.post("", response_model=AssetOut, status_code=201)
def create_asset(data: AssetCreate, db: Session = Depends(get_db), _=Depends(require_staff)):
    return crud.create(db, data)


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, asset_id)
    if not obj:
        raise HTTPException(404, "Asset not found")
    return obj


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, data: AssetUpdate, db: Session = Depends(get_db), _=Depends(require_staff)):
    obj = crud.get(db, asset_id)
    if not obj:
        raise HTTPException(404, "Asset not found")
    return crud.update(db, obj, data)


@router.post("/{asset_id}/transfer", response_model=AssetOut)
def transfer_asset(asset_id: int, data: AssetTransfer, db: Session = Depends(get_db), _=Depends(require_staff)):
    obj = crud.get(db, asset_id)
    if not obj:
        raise HTTPException(404, "Asset not found")
    site = db.get(Site, data.target_site_id)
    if not site:
        raise HTTPException(404, "Target site not found")
    if data.target_location_id is not None:
        loc = db.get(SiteLocation, data.target_location_id)
        if not loc or loc.site_id != data.target_site_id:
            raise HTTPException(400, "Target location does not belong to the target site")
    obj.site_id = data.target_site_id
    obj.location_id = data.target_location_id
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{asset_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, asset_id)
    if not obj:
        raise HTTPException(404, "Asset not found")
    crud.delete(db, obj)
