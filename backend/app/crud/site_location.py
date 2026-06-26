from sqlalchemy.orm import Session

from app.models.site_location import SiteLocation
from app.schemas.site_location import SiteLocationCreate, SiteLocationUpdate


def get(db: Session, location_id: int) -> SiteLocation | None:
    return db.get(SiteLocation, location_id)


def get_by_site(db: Session, site_id: int) -> list[SiteLocation]:
    return db.query(SiteLocation).filter(SiteLocation.site_id == site_id).order_by(SiteLocation.name).all()


def create(db: Session, data: SiteLocationCreate) -> SiteLocation:
    obj = SiteLocation(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, location: SiteLocation, data: SiteLocationUpdate) -> SiteLocation:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(location, field, value)
    db.commit()
    db.refresh(location)
    return location


def delete(db: Session, location: SiteLocation) -> None:
    db.delete(location)
    db.commit()
