from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.db.session import get_db
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.user import User
from app.schemas.chat import DirectChatListItem
from app.core.auth import get_current_user
from app.schemas.chat import DirectChatCreate
from sqlalchemy import func

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.get(
    "/direct",
    response_model=list[DirectChatListItem]
)
def get_direct_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Get all direct chats user is part of
    chats = (
        db.query(Chat)
        .join(ChatMember)
        .filter(
            Chat.type == "direct",
            ChatMember.user_id == current_user.id
        )
        .all()
    )

    result = []

    for chat in chats:
        # 2. Find the other member in this chat
        other_member = (
            db.query(User)
            .join(ChatMember)
            .filter(
                ChatMember.chat_id == chat.id,
                User.id != current_user.id
            )
            .first()
        )

        if other_member:
            result.append(
                DirectChatListItem(
                    chat_id=chat.id,
                    user_id=other_member.id,
                    username=other_member.username
                )
            )

    return result

@router.post("/direct")
def add_member_to_dm(
    data: DirectChatCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Prevent self-DM
    if data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    # 2. Check target user exists
    other_user = db.query(User).filter(User.id == data.user_id).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 3. Check if direct chat already exists
    existing_chat = (
        db.query(Chat)
        .join(ChatMember)
        .filter(
            Chat.type == "direct",
            ChatMember.user_id.in_([current_user.id, other_user.id])
        )
        .group_by(Chat.id)
        .having(func.count(Chat.id) == 2)
        .first()
    )

    if existing_chat:
        return {
            "chat_id": existing_chat.id,
            "message": "Direct chat already exists"
        }

    # 4. Create new direct chat
    chat = Chat(type="direct")
    db.add(chat)
    db.commit()
    db.refresh(chat)

    # 5. Add both users as members
    db.add_all([
        ChatMember(chat_id=chat.id, user_id=current_user.id),
        ChatMember(chat_id=chat.id, user_id=other_user.id)
    ])
    db.commit()

    return {
        "chat_id": chat.id,
        "message": "Direct chat created successfully"
    }
