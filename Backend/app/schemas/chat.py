from pydantic import BaseModel, Field
from typing import List

class DirectChatListItem(BaseModel):
    chat_id: int
    user_id: int
    username: str

class DirectChatCreate(BaseModel):
    user_id: int

class GroupChatCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    member_ids: List[int]

class GroupChatResponse(BaseModel):
    chat_id: int
    name: str

class GroupChatListItem(BaseModel):
    chat_id: int
    name: str
    member_count: int
    created_by: int

    class Config:
        from_attributes = True

class GroupChatSearchItem(BaseModel):
    chat_id: int
    name: str

    class Config:
        from_attributes = True

class AddGroupMember(BaseModel):
    user_id: int

