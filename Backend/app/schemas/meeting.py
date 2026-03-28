from pydantic import BaseModel

class StartMeetingRequest(BaseModel):
    chat_id: int

class MeetingResponse(BaseModel):
    meeting_id: int
    chat_id: int
    status: str
