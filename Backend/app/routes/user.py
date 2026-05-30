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

from app.schemas.user import UserSearchResponse, UserProfileResponse, UserUpdate

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "avatar": current_user.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}",
        "status": current_user.status or "offline",
        "bio": current_user.bio or ""
    }

@router.put("/me", response_model=UserProfileResponse)
def update_current_user_profile(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_update.avatar is not None:
        current_user.avatar_url = user_update.avatar
    if user_update.bio is not None:
        current_user.bio = user_update.bio
    if user_update.status is not None:
        current_user.status = user_update.status
        
    db.commit()
    db.refresh(current_user)
    
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "avatar": current_user.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}",
        "status": current_user.status or "offline",
        "bio": current_user.bio or ""
    }
