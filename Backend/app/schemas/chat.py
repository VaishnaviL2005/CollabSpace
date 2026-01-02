from pydantic import BaseModel

class DirectChatListItem(BaseModel):
    chat_id: int
    user_id: int
    username: str

class DirectChatCreate(BaseModel):
    user_id: int
