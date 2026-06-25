from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_admin
from app.core.security import create_access_token
from app.crud import user as crud_user
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserOut

router = APIRouter()


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud_user.authenticate(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    return Token(access_token=create_access_token(user.id, user.user_role))


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=UserOut, dependencies=[Depends(require_admin)])
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    if crud_user.get_by_username(db, data.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    return crud_user.create(db, data)
