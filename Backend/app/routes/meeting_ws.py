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
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, meeting_id: int, websocket: WebSocket):
        self.active_connections.setdefault(meeting_id, []).append(websocket)

    def disconnect(self, meeting_id: int, websocket: WebSocket):
        self.active_connections[meeting_id].remove(websocket)
        if not self.active_connections[meeting_id]:
            del self.active_connections[meeting_id]

    async def broadcast(self, meeting_id: int, message: dict):
        for ws in self.active_connections.get(meeting_id, []):
            await ws.send_json(message)

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

        # 🔌 Register connection
        await manager.connect(meeting_id, websocket)

        # Notify join
        await manager.broadcast(meeting_id, {
            "type": "system",
            "message": f"{user.username} joined meeting"
        })

        # 🔁 Relay signaling messages
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)

            payload["from"] = user.username
            await manager.broadcast(meeting_id, payload)

    except WebSocketDisconnect:
        manager.disconnect(meeting_id, websocket)
        await manager.broadcast(meeting_id, {
            "type": "system",
            "message": f"{user.username} left meeting"
        })

    finally:
        db.close()

