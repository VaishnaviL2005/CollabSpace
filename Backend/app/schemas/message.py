from pydantic import BaseModel,Field
from datetime import datetime

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    chat_id: int
    content: str = Field(..., min_length=1, max_length=5000)
