from sqlalchemy.orm import Session
from sqlalchemy import exists, select

from app.models.asset import Asset
from app.models.customer import Customer
from app.models.maintenance_schedule import MaintenanceSchedule
from app.models.site import Site
from app.schemas.customer import CustomerCreate, CustomerUpdate


def get(db: Session, customer_id: int) -> Customer | None:
    return db.get(Customer, customer_id)


def _has_schedules_subquery():
    """Subquery: true when a customer has at least one maintenance schedule."""
    return exists(
        select(MaintenanceSchedule.id)
        .join(Asset, Asset.id == MaintenanceSchedule.asset_id)
        .join(Site, Site.id == Asset.site_id)
        .where(Site.customer_id == Customer.id)
    )


def get_all(db: Session, skip: int = 0, limit: int = 200, has_schedules: bool = False) -> list[Customer]:
    q = db.query(Customer)
    if has_schedules:
        q = q.filter(_has_schedules_subquery())
    return q.order_by(Customer.company_name).offset(skip).limit(limit).all()


def search(db: Session, query: str, has_schedules: bool = False) -> list[Customer]:
    q = db.query(Customer).filter(Customer.company_name.ilike(f"%{query}%"))
    if has_schedules:
        q = q.filter(_has_schedules_subquery())
    return q.order_by(Customer.company_name).limit(50).all()


def create(db: Session, data: CustomerCreate) -> Customer:
    obj = Customer(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, customer: Customer, data: CustomerUpdate) -> Customer:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


def delete(db: Session, customer: Customer) -> None:
    db.delete(customer)
    db.commit()
