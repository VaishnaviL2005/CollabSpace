from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
import aiofiles
import json
import re
import uuid
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
UPLOAD_DIR = Path("uploads/messages")

def safe_filename(filename: str) -> str:
    name = Path(filename).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", name) or "file"

async def get_chat_membership(db: AsyncSession, chat_id: int, user_id: int):
    result = await db.execute(
        select(ChatMember)
        .where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == user_id
        )
    )
    return result.scalar_one_or_none()

async def publish_message(chat_id: int, message: Message, current_user: User, client_id: str | None):
    await redis_client.publish(
        f"chat:{chat_id}",
        json.dumps({
            "type": "message",
            "chat_id": chat_id,
            "id": message.id,
            "client_id": client_id,
            "user_id": current_user.id,
            "username": current_user.username,
            "message": message.content,
            "message_type": message.message_type,
            "file_url": message.file_url,
            "created_at": message.created_at.isoformat()
        })
    )

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
    membership = await get_chat_membership(db, data.chat_id, current_user.id)

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

    await publish_message(data.chat_id, message, current_user, data.client_id)

    return message

@router.post(
    "/upload",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.SECOND * 60))))]
)
async def upload_message_file(
    chat_id: int = Form(...),
    content: str | None = Form(None),
    client_id: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    membership = await get_chat_membership(db, chat_id, current_user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this chat"
        )

    original_name = safe_filename(file.filename or "file")
    stored_name = f"{uuid.uuid4().hex}_{original_name}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / stored_name

    async with aiofiles.open(file_path, "wb") as out_file:
        while chunk := await file.read(1024 * 1024):
            await out_file.write(chunk)

    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=original_name,
        message_type="file",
        file_url=f"/uploads/messages/{stored_name}"
    )

    db.add(message)
    await db.commit()
    await db.refresh(message)

    await publish_message(chat_id, message, current_user, client_id)

    return message
