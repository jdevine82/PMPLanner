from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_admin
from app.crud import user as crud
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return crud.get_all(db)


@router.get("/{user_id}", response_model=UserOut, dependencies=[Depends(require_admin)])
def get_user(user_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, user_id)
    if not obj:
        raise HTTPException(404, "User not found")
    return obj


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.user_role != "Admin" and current_user.id != user_id:
        raise HTTPException(403, "Cannot modify another user's account")
    obj = crud.get(db, user_id)
    if not obj:
        raise HTTPException(404, "User not found")
    return crud.update(db, obj, data)


@router.delete("/{user_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, user_id)
    if not obj:
        raise HTTPException(404, "User not found")
    crud.delete(db, obj)
