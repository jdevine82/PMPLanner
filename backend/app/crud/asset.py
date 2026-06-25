from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetUpdate


def get(db: Session, asset_id: int) -> Asset | None:
    return db.get(Asset, asset_id)


def get_by_site(db: Session, site_id: int) -> list[Asset]:
    return db.query(Asset).filter(Asset.site_id == site_id).all()


def create(db: Session, data: AssetCreate) -> Asset:
    obj = Asset(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, asset: Asset, data: AssetUpdate) -> Asset:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return asset


def delete(db: Session, asset: Asset) -> None:
    db.delete(asset)
    db.commit()
