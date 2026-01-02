from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserSearchResponse
from app.core.auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.get(
    "/search",
    response_model=list[UserSearchResponse]
)
def search_users(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = (
        db.query(User)
        .filter(
            User.username.ilike(f"%{query}%"),
            User.id != current_user.id
        )
        .limit(10)
        .all()
    )

    return users
