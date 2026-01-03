from fastapi import APIRouter, Depends, HTTPException, status,Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.message import Message
from app.models.chat_member import ChatMember
from app.schemas.message import MessageResponse, MessageCreate
from app.models.user import User
from app.core.auth import get_current_user

router = APIRouter(prefix="/messages", tags=["Messages"])

@router.get("/{chat_id}", response_model=list[MessageResponse])
def get_messages(
    chat_id: int,
    limit: int = Query(20, ge=1, le=100),
    before_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # 1. Verify user is a member of this chat
    membership = (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
        .first()
    )

    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    query = (
        db.query(Message)
        .filter(Message.chat_id == chat_id)
    )

    if before_id:
        query = query.filter(Message.id < before_id)

    messages = (
        query
        .order_by(Message.id.desc())
        .limit(limit)
        .all()
    )

    return list(reversed(messages))

@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED
)
def send_message(
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify user is a member of the chat
    membership = (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id == data.chat_id,
            ChatMember.user_id == current_user.id
        )
        .first()
    )

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
    db.commit()
    db.refresh(message)

    return message

