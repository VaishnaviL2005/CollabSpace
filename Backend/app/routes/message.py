from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import json
from pyrate_limiter import Duration, Limiter, Rate  # KEEP THIS

from app.core.redis import redis_client
from app.db.session import get_db
from app.models.message import Message
from app.models.chat_member import ChatMember
from app.schemas.message import MessageResponse, MessageCreate, PaginatedMessageResponse
from app.models.user import User
from app.core.auth import get_current_user
from fastapi_limiter.depends import RateLimiter  # CORRECT IMPORT

router = APIRouter(prefix="/messages", tags=["Messages"])

@router.get("/{chat_id}", response_model=PaginatedMessageResponse)
async def get_messages(
    chat_id: int,
    limit: int = Query(20, ge=1, le=100),
    before_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify user is a member of this chat
    result = await db.execute(
        select(ChatMember)
        .where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    query = select(Message).where(Message.chat_id == chat_id)

    if before_id:
        query = query.where(Message.id < before_id)

    result = await db.execute(
        query
        .order_by(Message.id.desc())
        .limit(limit + 1)
    )
    messages = list(result.scalars().all())

    has_more = len(messages) > limit
    if has_more:
        messages = messages[:-1]

    messages.reverse()
    next_cursor = messages[0].id if messages else None

    return {
        "messages": messages,
        "next_cursor": next_cursor,
        "has_more": has_more
    }

@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.SECOND * 60))))]
)
async def send_message(
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify user is a member of the chat
    result = await db.execute(
        select(ChatMember)
        .where(
            ChatMember.chat_id == data.chat_id,
            ChatMember.user_id == current_user.id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this chat"
        )

    # 2. Create message
    message = Message(
        chat_id=data.chat_id,
        sender_id=current_user.id,
        content=data.content
    )

    db.add(message)
    await db.commit()
    await db.refresh(message)

    await redis_client.publish(
        f"chat:{data.chat_id}",
        json.dumps({
            "type": "message",
            "chat_id": data.chat_id,
            "id": message.id,
            "client_id": data.client_id,
            "user_id": current_user.id,
            "username": current_user.username,
            "message": message.content,
            "message_type": message.message_type,
            "file_url": message.file_url,
            "created_at": message.created_at.isoformat()
        })
    )

    return message
