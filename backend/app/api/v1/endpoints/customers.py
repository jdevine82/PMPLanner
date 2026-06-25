from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin
from app.crud import customer as crud
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter()


@router.get("", response_model=list[CustomerOut])
def list_customers(
    search: str | None = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if search:
        return crud.search(db, search)
    return crud.get_all(db, skip, limit)


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return crud.create(db, data)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, customer_id)
    if not obj:
        raise HTTPException(404, "Customer not found")
    return obj


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int, data: CustomerUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    obj = crud.get(db, customer_id)
    if not obj:
        raise HTTPException(404, "Customer not found")
    return crud.update(db, obj, data)


@router.delete("/{customer_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, customer_id)
    if not obj:
        raise HTTPException(404, "Customer not found")
    crud.delete(db, obj)
