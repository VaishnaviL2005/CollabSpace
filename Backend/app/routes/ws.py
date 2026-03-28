from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from typing import Dict, List
from app.models.message import Message
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.chat_member import ChatMember
from app.models.user import User
import json
from app.core.redis import redis_client

router = APIRouter()

# -------------------------------
# Connection Manager
# -------------------------------
import time
import asyncio

class ConnectionManager:
    def __init__(self):
        # Maps websocket to metadata: {"chat_id": int, "last_pong": float}
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, chat_id: int, websocket: WebSocket):
        self.active_connections[websocket] = {"chat_id": chat_id, "last_pong": time.time()}

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    def update_pong(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections[websocket]["last_pong"] = time.time()

    async def send_local(self, chat_id: int, message: dict):
        # Create list copy to allow modifying real dict safely if failures happen
        for ws, data in list(self.active_connections.items()):
            if data["chat_id"] == chat_id:
                try:
                    await ws.send_json(message)
                except Exception:
                    self.disconnect(ws)

    async def heartbeat(self):
        while True:
            await asyncio.sleep(30)
            now = time.time()
            stale_sockets = []
            for ws, data in list(self.active_connections.items()):
                if now - data["last_pong"] > 65:
                    stale_sockets.append(ws)
                else:
                    try:
                        await ws.send_json({"type": "ping"})
                    except Exception:
                        stale_sockets.append(ws)
            
            for ws in stale_sockets:
                try:
                    await ws.close(code=1008)
                except Exception:
                    pass
                self.disconnect(ws)

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

        # Notify join
        join_payload = {
            "type": "presence",
            "chat_id": chat_id,
            "user_id": user.id,
            "username": user.username,
            "status": "online"
        }
        await redis_client.publish(f"chat:{chat_id}", json.dumps(join_payload))

        # Listen for messages
        while True:
            text = await websocket.receive_text()

            try:
                data = json.loads(text)
                event_type = data.get("type", "message")
            except json.JSONDecodeError:
                # Fallback to plain text for backwards compatibility
                data = {"content": text}
                event_type = "message"

            if event_type == "pong":
                manager.update_pong(websocket)

            elif event_type == "typing":
                typing_payload = {
                    "type": "typing",
                    "chat_id": chat_id,
                    "user_id": user.id,
                    "username": user.username
                }
                await redis_client.publish(f"chat:{chat_id}", json.dumps(typing_payload))

            elif event_type == "read_receipt":
                message_id = data.get("message_id")
                if message_id:
                    membership.last_read_message_id = message_id
                    db.commit()
                    read_payload = {
                        "type": "read_receipt",
                        "chat_id": chat_id,
                        "user_id": user.id,
                        "username": user.username,
                        "message_id": message_id
                    }
                    await redis_client.publish(f"chat:{chat_id}", json.dumps(read_payload))

            else:
                # Standard message
                content = data.get("content", text)
                file_url = data.get("file_url")
                msg_type = "file" if file_url else "text"
                
                message = Message(
                    chat_id=chat_id,
                    sender_id=user.id,
                    content=content,
                    message_type=msg_type,
                    file_url=file_url
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                msg_payload = {
                    "type": "message",
                    "chat_id": chat_id,
                    "id": message.id,
                    "user_id": user.id,
                    "username": user.username,
                    "message": message.content,
                    "message_type": message.message_type,
                    "file_url": message.file_url,
                    "created_at": message.created_at.isoformat()
                }
                await redis_client.publish(f"chat:{chat_id}", json.dumps(msg_payload))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        leave_payload = {
            "type": "presence",
            "chat_id": chat_id,
            "user_id": user.id,
            "username": user.username,
            "status": "offline"
        }
        await redis_client.publish(f"chat:{chat_id}", json.dumps(leave_payload))

    finally:
        manager.disconnect(websocket)
        db.close()
