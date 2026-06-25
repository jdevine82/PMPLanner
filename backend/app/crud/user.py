from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_all(db: Session) -> list[User]:
    return db.query(User).all()


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = get_by_username(db, username)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create(db: Session, data: UserCreate) -> User:
    obj = User(username=data.username, password_hash=hash_password(data.password), user_role=data.user_role)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, user: User, data: UserUpdate) -> User:
    updates = data.model_dump(exclude_unset=True)
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    for field, value in updates.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()
