from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
# from sqlalchemy import and_
from sqlalchemy.sql import func

from app.db.session import get_db
from app.models.meeting import Meeting
from app.models.chat_member import ChatMember
from app.schemas.meeting import StartMeetingRequest, MeetingResponse
from app.core.auth import get_current_user
from app.models.user import User
from app.models.chat import Chat

router = APIRouter(prefix="/meetings", tags=["Meetings"])

@router.post("/start", status_code=201)
def start_meeting(
    data: StartMeetingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Ensure user is part of chat
    member = db.query(ChatMember).filter(
        ChatMember.chat_id == data.chat_id,
        ChatMember.user_id == current_user.id
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")

    # ✅ FETCH CHAT EARLY (FIX)
    chat = db.query(Chat).filter(Chat.id == data.chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # 2. Check if active meeting already exists
    existing = db.query(Meeting).filter(
        Meeting.chat_id == data.chat_id,
        Meeting.status == "active"
    ).first()

    if existing:
        if not existing.room_name:
            existing.room_name = f"{chat.name}-meeting-{existing.id}"
            db.commit()
            db.refresh(existing)

        return {
            "meeting_id": existing.id,
            "room_name": existing.room_name,
            "status": existing.status
        }

    # 3. Create new meeting
    meeting = Meeting(
        chat_id=data.chat_id,
        created_by=current_user.id,
        status="active"
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # 4. Set room_name
    meeting.room_name = f"{chat.name}-meeting-{meeting.id}"
    db.commit()

    return {
        "meeting_id": meeting.id,
        "room_name": meeting.room_name,
        "status": meeting.status
    }



@router.post("/{meeting_id}/join", response_model=MeetingResponse)
def join_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.status == "active"
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not active")

    # ensure user belongs to the chat
    member = db.query(ChatMember).filter(
        ChatMember.chat_id == meeting.chat_id,
        ChatMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")

    return MeetingResponse(
        meeting_id=meeting.id,
        chat_id=meeting.chat_id,
        status=meeting.status
    )


@router.post("/{meeting_id}/end")
def end_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only creator can end meeting")

    meeting.status = "ended"
    meeting.ended_at = func.now()
    db.commit()

    return {"message": "Meeting ended"}

@router.get("/{meeting_id}/join-info")
def get_meeting_join_info(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.status == "active"
    ).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not active")

    # Ensure user is part of chat
    member = db.query(ChatMember).filter(
        ChatMember.chat_id == meeting.chat_id,
        ChatMember.user_id == current_user.id
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "room_name": meeting.room_name,
        "display_name": current_user.username
    }
