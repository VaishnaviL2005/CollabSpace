from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy import select
from typing import Dict
import asyncio
import json
import time

from app.core.config import settings
from app.core.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.models.chat_member import ChatMember
from app.models.message import Message
from app.models.user import User

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, chat_id: int, websocket: WebSocket):
        self.active_connections[websocket] = {"chat_id": chat_id, "last_pong": time.time()}

    def disconnect(self, websocket: WebSocket):
        self.active_connections.pop(websocket, None)

    def update_pong(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections[websocket]["last_pong"] = time.time()

    async def send_local(self, chat_id: int, message: dict):
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


@router.websocket("/ws/chat/{chat_id}")
async def chat_ws(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...),
):
    await websocket.accept()
    user: User | None = None

    async with AsyncSessionLocal() as db:
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=1008)
                return

            result = await db.execute(select(User).where(User.id == int(user_id)))
            user = result.scalar_one_or_none()
            if not user:
                await websocket.close(code=1008)
                return

            result = await db.execute(
                select(ChatMember).where(
                    ChatMember.chat_id == chat_id,
                    ChatMember.user_id == user.id,
                )
            )
            membership = result.scalar_one_or_none()
            if not membership:
                await websocket.close(code=1008)
                return

            await manager.connect(chat_id, websocket)

            await redis_client.publish(
                f"chat:{chat_id}",
                json.dumps({
                    "type": "presence",
                    "chat_id": chat_id,
                    "user_id": user.id,
                    "username": user.username,
                    "status": "online",
                }),
            )

            while True:
                text = await websocket.receive_text()

                try:
                    data = json.loads(text)
                    event_type = data.get("type", "message")
                except json.JSONDecodeError:
                    data = {"content": text}
                    event_type = "message"

                if event_type == "pong":
                    manager.update_pong(websocket)
                elif event_type == "typing":
                    await redis_client.publish(
                        f"chat:{chat_id}",
                        json.dumps({
                            "type": "typing",
                            "chat_id": chat_id,
                            "user_id": user.id,
                            "username": user.username,
                        }),
                    )
                elif event_type == "read_receipt":
                    message_id = data.get("message_id")
                    if message_id:
                        membership.last_read_message_id = message_id
                        await db.commit()
                        await redis_client.publish(
                            f"chat:{chat_id}",
                            json.dumps({
                                "type": "read_receipt",
                                "chat_id": chat_id,
                                "user_id": user.id,
                                "username": user.username,
                                "message_id": message_id,
                            }),
                        )
                else:
                    file_url = data.get("file_url")
                    message = Message(
                        chat_id=chat_id,
                        sender_id=user.id,
                        content=data.get("content", text),
                        message_type="file" if file_url else "text",
                        file_url=file_url,
                    )
                    db.add(message)
                    await db.commit()
                    await db.refresh(message)

                    await redis_client.publish(
                        f"chat:{chat_id}",
                        json.dumps({
                            "type": "message",
                            "chat_id": chat_id,
                            "id": message.id,
                            "client_id": data.get("client_id"),
                            "user_id": user.id,
                            "username": user.username,
                            "message": message.content,
                            "message_type": message.message_type,
                            "file_url": message.file_url,
                            "created_at": message.created_at.isoformat(),
                        }),
                    )

        except (ExpiredSignatureError, JWTError):
            await websocket.close(code=1008)
        except WebSocketDisconnect:
            if user:
                await redis_client.publish(
                    f"chat:{chat_id}",
                    json.dumps({
                        "type": "presence",
                        "chat_id": chat_id,
                        "user_id": user.id,
                        "username": user.username,
                        "status": "offline",
                    }),
                )
        finally:
            manager.disconnect(websocket)
