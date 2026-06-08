from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserSearchResponse
from app.core.auth import get_current_user
from app.routes.presence_ws import manager as presence_manager

router = APIRouter(prefix="/users", tags=["Users"])

@router.get(
    "/search",
    response_model=list[UserSearchResponse]
)
async def search_users(
    query: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(User)
        .where(
            User.username.ilike(f"%{query}%"),
            User.id != current_user.id
        )
        .limit(10)
    )
    users = result.scalars().all()

    return [
        {
            "id": user.id,
            "username": user.username,
            "avatar": user.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={user.username}",
            "status": "online" if presence_manager.is_online(user.id) else "offline",
        }
        for user in users
    ]

from app.schemas.user import UserSearchResponse, UserProfileResponse, UserUpdate

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "avatar": current_user.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}",
        "status": "online" if presence_manager.is_online(current_user.id) else "offline",
        "bio": current_user.bio or ""
    }

@router.put("/me", response_model=UserProfileResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_update.avatar is not None:
        current_user.avatar_url = user_update.avatar
    if user_update.bio is not None:
        current_user.bio = user_update.bio
    if user_update.status is not None:
        current_user.status = user_update.status
        
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "avatar": current_user.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}",
        "status": "online" if presence_manager.is_online(current_user.id) else "offline",
        "bio": current_user.bio or ""
    }
