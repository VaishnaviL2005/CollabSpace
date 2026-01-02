from pydantic import BaseModel

class UserSearchResponse(BaseModel):
    id: int
    username: str