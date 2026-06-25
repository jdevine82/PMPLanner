from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


def get(db: Session, customer_id: int) -> Customer | None:
    return db.get(Customer, customer_id)


def get_all(db: Session, skip: int = 0, limit: int = 200) -> list[Customer]:
    return db.query(Customer).offset(skip).limit(limit).all()


def search(db: Session, query: str) -> list[Customer]:
    return db.query(Customer).filter(Customer.company_name.ilike(f"%{query}%")).limit(50).all()


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
