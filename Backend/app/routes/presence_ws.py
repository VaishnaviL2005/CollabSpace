from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy import select
from sqlalchemy.sql import func
from typing import Dict
import asyncio
import json
import time

from app.core.config import settings
from app.core.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.models.user import User

router = APIRouter()


class PresenceManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        self.active_connections[websocket] = {"user_id": user_id, "last_pong": time.time()}

    def disconnect(self, websocket: WebSocket) -> int | None:
        connection = self.active_connections.pop(websocket, None)
        return connection["user_id"] if connection else None

    def is_online(self, user_id: int) -> bool:
        return any(
            connection["user_id"] == user_id
            for connection in self.active_connections.values()
        )

    def online_user_ids(self) -> set[int]:
        return {
            connection["user_id"]
            for connection in self.active_connections.values()
        }

    def update_pong(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections[websocket]["last_pong"] = time.time()

    async def broadcast_local(self, message: dict):
        for ws in list(self.active_connections.keys()):
            try:
                await ws.send_json(message)
            except Exception:
                try:
                    await ws.close(code=1008)
                except Exception:
                    pass
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


manager = PresenceManager()


@router.websocket("/ws/presence")
async def presence_ws(
    websocket: WebSocket,
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

            was_online = manager.is_online(user.id)
            await manager.connect(user.id, websocket)

            result = await db.execute(select(User).where(User.id.in_(manager.online_user_ids())))
            online_users = result.scalars().all()
            for online_user in online_users:
                await websocket.send_json({
                    "type": "global_presence",
                    "user_id": str(online_user.id),
                    "status": "online",
                })

            if not was_online:
                await redis_client.publish(
                    "global_presence",
                    json.dumps({
                        "type": "global_presence",
                        "user_id": str(user.id),
                        "status": "online",
                    }),
                )

            while True:
                text = await websocket.receive_text()
                try:
                    data = json.loads(text)
                    if data.get("type") == "pong":
                        manager.update_pong(websocket)
                except json.JSONDecodeError:
                    pass

        except (ExpiredSignatureError, JWTError):
            await websocket.close(code=1008)
        except WebSocketDisconnect:
            pass
        finally:
            disconnected_user_id = manager.disconnect(websocket)
            if user and disconnected_user_id and not manager.is_online(user.id):
                user.last_seen = func.now()
                await db.commit()
                await redis_client.publish(
                    "global_presence",
                    json.dumps({
                        "type": "global_presence",
                        "user_id": str(user.id),
                        "status": "offline",
                    }),
                )
