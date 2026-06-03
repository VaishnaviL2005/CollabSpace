from pydantic import BaseModel
from typing import Optional

class UserSearchResponse(BaseModel):
    id: int
    username: str
    avatar: Optional[str] = None
    status: str = "offline"

class UserProfileResponse(BaseModel):
    id: str
    username: str
    avatar: str
    status: str
    bio: Optional[str] = None

class UserUpdate(BaseModel):
    avatar: Optional[str] = None
    bio: Optional[str] = None
    status: Optional[str] = None
