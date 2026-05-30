from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from typing import Dict, List
import json

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.chat_member import ChatMember
from app.models.user import User

router = APIRouter()

class MeetingConnectionManager:
    def __init__(self):
        # meeting_id -> { user_id: { "ws": WebSocket, "info": dict } }
        self.active_connections: Dict[int, Dict[int, dict]] = {}

    async def connect(self, meeting_id: int, user_id: int, websocket: WebSocket, info: dict):
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = {}
        self.active_connections[meeting_id][user_id] = {
            "ws": websocket,
            "info": info
        }

    def disconnect(self, meeting_id: int, user_id: int):
        if meeting_id in self.active_connections and user_id in self.active_connections[meeting_id]:
            del self.active_connections[meeting_id][user_id]
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]

    async def send_personal_message(self, meeting_id: int, user_id: int, message: dict):
        room = self.active_connections.get(meeting_id, {})
        target = room.get(user_id)
        if target:
            try:
                await target["ws"].send_json(message)
            except Exception:
                pass

    async def broadcast(self, meeting_id: int, message: dict, exclude_user: int = None):
        room = self.active_connections.get(meeting_id, {})
        for uid, conn in room.items():
            if exclude_user and uid == exclude_user:
                continue
            try:
                await conn["ws"].send_json(message)
            except Exception:
                pass
                
    def get_users(self, meeting_id: int) -> list:
        room = self.active_connections.get(meeting_id, {})
        return [data["info"] for uid, data in room.items()]

manager = MeetingConnectionManager()

@router.websocket("/ws/meet/{meeting_id}")
async def meeting_ws(
    websocket: WebSocket,
    meeting_id: int,
    token: str = Query(...)
):
    await websocket.accept()
    db: Session = SessionLocal()

    try:
        # 🔐 Authenticate user
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008)
            return

        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            await websocket.close(code=1008)
            return

        # 📌 Validate meeting
        meeting = db.query(Meeting).filter(
            Meeting.id == meeting_id,
            Meeting.status == "active"
        ).first()
        if not meeting:
            await websocket.close(code=1008)
            return

        # 📌 Validate chat membership
        member = db.query(ChatMember).filter(
            ChatMember.chat_id == meeting.chat_id,
            ChatMember.user_id == user.id
        ).first()
        if not member:
            await websocket.close(code=1008)
            return

        # Prepare peer info
        user_info = {
            "id": str(user.id),
            "name": user.username,
            "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user.username}",
            "isMuted": False,
            "isVideoOn": True,
            "isSpeaking": False,
            "isHost": getattr(meeting, 'host_id', None) == user.id
        }

        # 🔌 Send existing peers to new joinee
        existing_users = manager.get_users(meeting_id)
        await websocket.send_json({
            "type": "all_users",
            "users": existing_users
        })

        # Register connection
        await manager.connect(meeting_id, user.id, websocket, user_info)

        # Notify others
        await manager.broadcast(meeting_id, {
            "type": "user_joined",
            "user": user_info
        }, exclude_user=user.id)

        # 🔁 Relay RTCPeerConnection Signals
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)

            target_id = payload.get("target")
            if target_id:
                # Route specific WebRTC payload (offer, answer, candidate)
                payload["sender_id"] = str(user.id)
                await manager.send_personal_message(meeting_id, int(target_id), payload)
            else:
                # Group broadcast (chat, muting status)
                payload["sender_id"] = str(user.id)
                await manager.broadcast(meeting_id, payload, exclude_user=user.id)

    except WebSocketDisconnect:
        manager.disconnect(meeting_id, user.id)
        await manager.broadcast(meeting_id, {
            "type": "user_left",
            "user_id": str(user.id)
        })

    finally:
        db.close()

