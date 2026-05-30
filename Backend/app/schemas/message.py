from pydantic import BaseModel,Field
from datetime import datetime

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    content: str
    message_type: str = "text"
    file_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    chat_id: int
    content: str = Field(..., min_length=1, max_length=5000)
    client_id: str | None = None

class PaginatedMessageResponse(BaseModel):
    messages: list[MessageResponse]
    next_cursor: int | None = None
    has_more: bool
