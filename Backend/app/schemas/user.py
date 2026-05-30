from pydantic import BaseModel
from typing import Optional

class UserSearchResponse(BaseModel):
    id: int
    username: str

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