from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
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
async def start_meeting(
    data: StartMeetingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Ensure user is part of chat
    result = await db.execute(select(ChatMember).where(
        ChatMember.chat_id == data.chat_id,
        ChatMember.user_id == current_user.id
    ))
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")

    # ✅ FETCH CHAT EARLY (FIX)
    result = await db.execute(select(Chat).where(Chat.id == data.chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # 2. Check if active meeting already exists
    result = await db.execute(select(Meeting).where(
        Meeting.chat_id == data.chat_id,
        Meeting.status == "active"
    ))
    existing = result.scalar_one_or_none()

    if existing:
        if not existing.room_name:
            existing.room_name = f"{chat.name}-meeting-{existing.id}"
            await db.commit()
            await db.refresh(existing)

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
    await db.commit()
    await db.refresh(meeting)

    # 4. Set room_name
    meeting.room_name = f"{chat.name}-meeting-{meeting.id}"
    await db.commit()

    return {
        "meeting_id": meeting.id,
        "room_name": meeting.room_name,
        "status": meeting.status
    }



@router.post("/{meeting_id}/join", response_model=MeetingResponse)
async def join_meeting(
    meeting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Meeting).where(
        Meeting.id == meeting_id,
        Meeting.status == "active"
    ))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not active")

    # ensure user belongs to the chat
    result = await db.execute(select(ChatMember).where(
        ChatMember.chat_id == meeting.chat_id,
        ChatMember.user_id == current_user.id
    ))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")

    return MeetingResponse(
        meeting_id=meeting.id,
        chat_id=meeting.chat_id,
        status=meeting.status
    )


@router.post("/{meeting_id}/end")
async def end_meeting(
    meeting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only creator can end meeting")

    meeting.status = "ended"
    meeting.ended_at = func.now()
    await db.commit()

    return {"message": "Meeting ended"}

@router.get("/{meeting_id}/join-info")
async def get_meeting_join_info(
    meeting_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Meeting).where(
        Meeting.id == meeting_id,
        Meeting.status == "active"
    ))
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not active")

    # Ensure user is part of chat
    result = await db.execute(select(ChatMember).where(
        ChatMember.chat_id == meeting.chat_id,
        ChatMember.user_id == current_user.id
    ))
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "room_name": meeting.room_name,
        "display_name": current_user.username
    }
