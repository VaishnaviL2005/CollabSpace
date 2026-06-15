from fastapi import APIRouter, Depends
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.db.session import get_db
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.user import User
from app.schemas.chat import DirectChatListItem
from app.core.auth import get_current_user, get_current_user_ws
from app.schemas.chat import DirectChatCreate
from sqlalchemy import func, select, and_
from sqlalchemy.exc import IntegrityError
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

def build_direct_key(user_id_a: int, user_id_b: int) -> str:
    first_id, second_id = sorted([int(user_id_a), int(user_id_b)])
    return f"{first_id}:{second_id}"

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
    db: AsyncSession,
):
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    result = await db.execute(select(ChatMember).where(ChatMember.chat_id == chat_id))
    members = result.scalars().all()

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

async def find_direct_chat_by_members(
    db: AsyncSession,
    first_user_id: int,
    second_user_id: int,
) -> Chat | None:
    first_membership = aliased(ChatMember)
    second_membership = aliased(ChatMember)
    result = await db.execute(
        select(Chat)
        .join(first_membership, and_(
            first_membership.chat_id == Chat.id,
            first_membership.user_id == first_user_id,
        ))
        .join(second_membership, and_(
            second_membership.chat_id == Chat.id,
            second_membership.user_id == second_user_id,
        ))
        .where(Chat.type == "direct")
        .order_by(Chat.id.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()

@router.get(
    "/direct",
    response_model=list[DirectChatListItem]
)
async def get_direct_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Get all direct chats user is part of
    result = await db.execute(
        select(Chat)
        .join(ChatMember)
        .where(
            Chat.type == "direct",
            ChatMember.user_id == current_user.id
        )
    )
    chats = result.scalars().all()

    items = []

    for chat in chats:
        # 2. Find the other member in this chat
        member_result = await db.execute(
            select(User)
            .join(ChatMember, User.id == ChatMember.user_id)
            .where(
                ChatMember.chat_id == chat.id,
                User.id != current_user.id
            )
        )
        other_member = member_result.scalar_one_or_none()

        if other_member:
            items.append(
                DirectChatListItem(
                    chat_id=chat.id,
                    user_id=other_member.id,
                    username=other_member.username
                )
            )

    return items

@router.post("/direct")
async def add_member_to_dm(
    data: DirectChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Prevent self-DM
    if data.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    # 2. Check target user exists
    result = await db.execute(select(User).where(User.id == data.user_id))
    other_user = result.scalar_one_or_none()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    direct_key = build_direct_key(current_user.id, other_user.id)

    # 3. Check if direct chat already exists between these two users
    result = await db.execute(
        select(Chat).where(Chat.type == "direct", Chat.direct_key == direct_key)
    )
    existing_chat = result.scalar_one_or_none()
    if not existing_chat:
        existing_chat = await find_direct_chat_by_members(db, current_user.id, other_user.id)
        if existing_chat and not existing_chat.direct_key:
            existing_chat.direct_key = direct_key
            try:
                await db.commit()
                await db.refresh(existing_chat)
            except IntegrityError:
                await db.rollback()
                result = await db.execute(
                    select(Chat).where(Chat.type == "direct", Chat.direct_key == direct_key)
                )
                existing_chat = result.scalar_one_or_none()

    if existing_chat:
        await publish_conversation_change([current_user.id, other_user.id])
        return {
            "chat_id": existing_chat.id,
            "message": "Direct chat already exists"
        }

    # 4. Create new direct chat
    chat = Chat(type="direct", direct_key=direct_key)
    db.add(chat)
    try:
        await db.commit()
        await db.refresh(chat)

        # 5. Add both users as members
        db.add_all([
            ChatMember(chat_id=chat.id, user_id=current_user.id),
            ChatMember(chat_id=chat.id, user_id=other_user.id)
        ])
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(Chat).where(Chat.type == "direct", Chat.direct_key == direct_key)
        )
        chat = result.scalar_one()

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1️⃣ Validate members exist
    result = await db.execute(select(User).where(User.id.in_(data.member_ids)))
    members = result.scalars().all()

    if len(members) != len(set(data.member_ids)):
        raise HTTPException(status_code=400, detail="One or more users not found")

    # 2️⃣ Create group chat
    chat = Chat(
        type="group",
        name=data.name,
        created_by=current_user.id
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)

    # 3️⃣ Add creator + members to chat_members
    chat_members = [
        ChatMember(chat_id=chat.id, user_id=current_user.id)
    ] + [
        ChatMember(chat_id=chat.id, user_id=user.id)
        for user in members
        if user.id != current_user.id
    ]

    db.add_all(chat_members)
    await db.commit()
    await publish_conversation_change([member.user_id for member in chat_members])

    return GroupChatResponse(chat_id=chat.id, name=chat.name)

@router.get(
    "/groups",
    response_model=list[GroupChatListItem]
)
async def get_my_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_membership = aliased(ChatMember)
    result = await db.execute(
        select(
            Chat.id.label("chat_id"),
            Chat.name,
            Chat.created_by,
            func.count(ChatMember.user_id).label("member_count")
        )
        .join(ChatMember, Chat.id == ChatMember.chat_id)
        .join(current_membership, Chat.id == current_membership.chat_id)
        .where(
            Chat.type == "group",
            current_membership.user_id == current_user.id
        )
        .group_by(Chat.id)
    )
    return [
        {
            "chat_id": row.chat_id,
            "name": row.name,
            "created_by": row.created_by,
            "member_count": row.member_count,
        }
        for row in result.all()
    ]

@router.get(
    "/groups/search",
    response_model=list[GroupChatSearchItem]
)
async def search_my_groups(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(
            Chat.id.label("chat_id"),
            Chat.name
        )
        .join(ChatMember, Chat.id == ChatMember.chat_id)
        .where(
            Chat.type == "group",
            ChatMember.user_id == current_user.id,
            Chat.name.ilike(f"%{q}%")
        )
    )
    return [
        {
            "chat_id": row.chat_id,
            "name": row.name,
        }
        for row in result.all()
    ]

@router.post(
    "/group/{chat_id}/members",
    status_code=201
)
async def add_member_to_group(
    chat_id: int,
    data: AddGroupMember,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Chat).where(Chat.id == chat_id, Chat.type == "group"))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Group not found")

    result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
    )
    is_member = result.scalar_one_or_none()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a group member")

    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == data.user_id
        )
    )
    already_member = result.scalar_one_or_none()
    if already_member:
        raise HTTPException(status_code=400, detail="User already in group")

    db.add(ChatMember(chat_id=chat_id, user_id=data.user_id))
    await db.commit()

    result = await db.execute(select(ChatMember).where(ChatMember.chat_id == chat_id))
    member_ids = [member.user_id for member in result.scalars().all()]
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
async def get_group_members(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
    )
    is_member = result.scalar_one_or_none()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a group member")

    result = await db.execute(
        select(User)
        .join(ChatMember, User.id == ChatMember.user_id)
        .where(ChatMember.chat_id == chat_id)
    )
    return result.scalars().all()

@router.get(
    "/{chat_id}/livekit-token"
)
async def get_livekit_token(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_ws)
):
    result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id
        )
    )
    is_member = result.scalar_one_or_none()
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await publish_call_event(chat_id, "incoming_call", current_user, db)

@router.post("/{chat_id}/call/end")
async def end_call(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await publish_call_event(chat_id, "call_ended", current_user, db)

@router.post("/{chat_id}/call/decline")
async def decline_call(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await publish_call_event(chat_id, "call_declined", current_user, db)
