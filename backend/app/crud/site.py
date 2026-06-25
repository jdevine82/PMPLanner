from sqlalchemy.orm import Session

from app.models.site import Site
from app.schemas.site import SiteCreate, SiteUpdate


def get(db: Session, site_id: int) -> Site | None:
    return db.get(Site, site_id)


def get_by_customer(db: Session, customer_id: int) -> list[Site]:
    return db.query(Site).filter(Site.customer_id == customer_id).all()


def create(db: Session, data: SiteCreate) -> Site:
    obj = Site(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, site: Site, data: SiteUpdate) -> Site:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(site, field, value)
    db.commit()
    db.refresh(site)
    return site


def delete(db: Session, site: Site) -> None:
    db.delete(site)
    db.commit()
