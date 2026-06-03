from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, aliased
from fastapi import HTTPException, status
from app.db.session import get_db
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.user import User
from app.schemas.chat import DirectChatListItem
from app.core.auth import get_current_user
from app.schemas.chat import DirectChatCreate
from sqlalchemy import func
import json
from app.core.redis import redis_client
from app.schemas.chat import GroupChatCreate, GroupChatResponse , GroupChatListItem , GroupChatSearchItem,AddGroupMember 
from app.schemas.user import UserSearchResponse
from app.core.config import settings
import os
from livekit import api
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/chats", tags=["Chats"])

async def publish_conversation_change(user_ids: list[int]):
    await redis_client.publish(
        "conversation_changes",
        json.dumps({
            "type": "conversations_changed",
            "user_ids": [str(user_id) for user_id in set(user_ids)]
        })
    )

async def publish_call_event(
    chat_id: int,
    event_type: str,
    current_user: User,
    db: Session,
):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    members = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id)
        .all()
    )

    is_member = any(member.user_id == current_user.id for member in members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    target_user_ids = [
        str(member.user_id)
        for member in members
        if member.user_id != current_user.id
    ]

    payload = {
        "type": event_type,
        "chat_id": chat_id,
        "chat_name": chat.name,
        "is_group": chat.type == "group",
        "caller_id": str(current_user.id),
        "caller_name": current_user.username,
        "caller_avatar": current_user.avatar_url,
        "target_user_ids": target_user_ids
    }

    await redis_client.publish("global_presence", json.dumps(payload))
    return {"status": event_type, "targets": len(target_user_ids)}

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
async def add_member_to_dm(
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
        await publish_conversation_change([current_user.id, other_user.id])
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
    await publish_conversation_change([current_user.id, other_user.id])

    return {
        "chat_id": chat.id,
        "message": "Direct chat created successfully"
    }

@router.post(
    "/group",
    response_model=GroupChatResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_group_chat(
    data: GroupChatCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1️⃣ Validate members exist
    members = (
        db.query(User)
        .filter(User.id.in_(data.member_ids))
        .all()
    )

    if len(members) != len(set(data.member_ids)):
        raise HTTPException(status_code=400, detail="One or more users not found")

    # 2️⃣ Create group chat
    chat = Chat(
        type="group",
        name=data.name,
        created_by=current_user.id
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)

    # 3️⃣ Add creator + members to chat_members
    chat_members = [
        ChatMember(chat_id=chat.id, user_id=current_user.id)
    ] + [
        ChatMember(chat_id=chat.id, user_id=user.id)
        for user in members
        if user.id != current_user.id
    ]

    db.add_all(chat_members)
    db.commit()
    await publish_conversation_change([member.user_id for member in chat_members])

    return GroupChatResponse(chat_id=chat.id, name=chat.name)

@router.get(
    "/groups",
    response_model=list[GroupChatListItem]
)
def get_my_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_membership = aliased(ChatMember)
    groups = (
        db.query(
            Chat.id.label("chat_id"),
            Chat.name,
            Chat.created_by,
            func.count(ChatMember.user_id).label("member_count")
        )
        .join(ChatMember, Chat.id == ChatMember.chat_id)
        .join(current_membership, Chat.id == current_membership.chat_id)
        .filter(
            Chat.type == "group",
            current_membership.user_id == current_user.id
        )
        .group_by(Chat.id)
        .all()
    )

    return groups

@router.get(
    "/groups/search",
    response_model=list[GroupChatSearchItem]
)
def search_my_groups(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    groups = (
        db.query(
            Chat.id.label("chat_id"),
            Chat.name
        )
        .join(ChatMember, Chat.id == ChatMember.chat_id)
        .filter(
            Chat.type == "group",
            ChatMember.user_id == current_user.id,
            Chat.name.ilike(f"%{q}%")
        )
        .all()
    )

    return groups

@router.post(
    "/group/{chat_id}/members",
    status_code=201
)
async def add_member_to_group(
    chat_id: int,
    data: AddGroupMember,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1️⃣ Ensure chat exists & is group
    chat = (
        db.query(Chat)
        .filter(Chat.id == chat_id, Chat.type == "group")
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Group not found")

    # 2️⃣ Ensure current user is group member
    is_member = (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
        .first()
    )
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a group member")

    # 3️⃣ Ensure target user exists
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 4️⃣ Prevent duplicate add
    already_member = (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == data.user_id
        )
        .first()
    )
    if already_member:
        raise HTTPException(status_code=400, detail="User already in group")

    # 5️⃣ Add user to group
    db.add(ChatMember(chat_id=chat_id, user_id=data.user_id))
    db.commit()
    member_ids = [
        member.user_id
        for member in db.query(ChatMember).filter(ChatMember.chat_id == chat_id).all()
    ]
    await publish_conversation_change(member_ids)

    return {
        "message": "User added to group",
        "user_id": user.id,
        "username": user.username
    }

@router.get(
    "/group/{chat_id}/members",
    response_model=list[UserSearchResponse]
)
def get_group_members(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_member = (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
        .first()
    )
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a group member")

    return (
        db.query(User)
        .join(ChatMember, User.id == ChatMember.user_id)
        .filter(ChatMember.chat_id == chat_id)
        .all()
    )

@router.get(
    "/{chat_id}/livekit-token"
)
async def get_livekit_token(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_member = (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
        .first()
    )
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this chat")

    api_key = settings.LIVEKIT_API_KEY
    api_secret = settings.LIVEKIT_API_SECRET
    livekit_url = settings.LIVEKIT_URL

    if not livekit_url or not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured in backend")

    grant = api.VideoGrants(room_join=True, room=f"chat-{chat_id}")
    
    access_token = api.AccessToken(api_key, api_secret)
    access_token.with_identity(str(current_user.id))
    access_token.with_name(current_user.username)
    access_token.with_grants(grant)

    return {
        "token": access_token.to_jwt(),
        "url": livekit_url
    }

@router.post("/{chat_id}/ring")
async def ring_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await publish_call_event(chat_id, "incoming_call", current_user, db)

@router.post("/{chat_id}/call/end")
async def end_call(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await publish_call_event(chat_id, "call_ended", current_user, db)

@router.post("/{chat_id}/call/decline")
async def decline_call(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await publish_call_event(chat_id, "call_declined", current_user, db)
