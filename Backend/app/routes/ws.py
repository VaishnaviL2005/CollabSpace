from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from typing import Dict, List
from app.models.message import Message
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.chat_member import ChatMember
from app.models.user import User

router = APIRouter()

# -------------------------------
# Connection Manager
# -------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, chat_id: int, websocket: WebSocket):
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)

    def disconnect(self, chat_id: int, websocket: WebSocket):
        self.active_connections[chat_id].remove(websocket)
        if not self.active_connections[chat_id]:
            del self.active_connections[chat_id]

    async def broadcast(self, chat_id: int, message: dict):
        for connection in self.active_connections.get(chat_id, []):
            await connection.send_json(message)


manager = ConnectionManager()

# -------------------------------
# WebSocket Endpoint
# -------------------------------
@router.websocket("/ws/chat/{chat_id}")
async def chat_ws(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...)
):
    await websocket.accept()
    db: Session = SessionLocal()

    try:
        # Decode JWT
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008)
            return

        # Fetch user
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            await websocket.close(code=1008)
            return

        # Verify chat membership
        membership = (
            db.query(ChatMember)
            .filter(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == user.id
            )
            .first()
        )

        if not membership:
            await websocket.close(code=1008)
            return

        # Register connection
        await manager.connect(chat_id, websocket)

        # Notify join (optional)
        await manager.broadcast(chat_id, {
            "username": "system",
            "message": f"{user.username} joined the chat"
        })

        # Listen for messages
        while True:
            text = await websocket.receive_text()

            # 1. Save message to DB
            message = Message(
                chat_id=chat_id,
                sender_id=user.id,
                content=text
            )
            db.add(message)
            db.commit()
            db.refresh(message)

            # 2. Broadcast message
            await manager.broadcast(chat_id, {
                "id": message.id,
                "username": user.username,
                "message": message.content,
                "created_at": message.created_at.isoformat()
            })

    except WebSocketDisconnect:
        manager.disconnect(chat_id, websocket)
        await manager.broadcast(chat_id, {
            "username": "system",
            "message": f"{user.username} left the chat"
        })

    finally:
        db.close()
