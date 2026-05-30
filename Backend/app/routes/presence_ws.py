from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import Dict
import json
import time
import asyncio

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.core.redis import redis_client

router = APIRouter()

class PresenceManager:
    def __init__(self):
        # Maps websocket to metadata: {"user_id": int, "last_pong": float}
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

manager = PresenceManager()

@router.websocket("/ws/presence")
async def presence_ws(
    websocket: WebSocket,
    token: str = Query(...)
):
    await websocket.accept()
    db: Session = SessionLocal()
    user: User | None = None

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

        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            await websocket.close(code=1008)
            return

        # Register Connection
        was_online = manager.is_online(user.id)
        await manager.connect(user.id, websocket)

        # Update DB status on the first active connection.
        if not was_online:
            user.status = "online"
            db.commit()

        # Send current online users to this new connection
        online_users = db.query(User).filter(User.status != "offline").all()
        for ou in online_users:
            await websocket.send_json({
                "type": "global_presence",
                "user_id": str(ou.id),
                "status": ou.status
            })

        # Notify the network only when the user transitions online.
        if not was_online:
            presence_payload = {
                "type": "global_presence",
                "user_id": str(user.id),
                "status": "online"
            }
            await redis_client.publish("global_presence", json.dumps(presence_payload))

        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
                if data.get("type") == "pong":
                    manager.update_pong(websocket)
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        pass

    finally:
        disconnected_user_id = manager.disconnect(websocket)
        if user and disconnected_user_id and not manager.is_online(user.id):
            user.status = "offline"
            user.last_seen = func.now()
            db.commit()
            presence_payload = {
                "type": "global_presence",
                "user_id": str(user.id),
                "status": "offline"
            }
            await redis_client.publish("global_presence", json.dumps(presence_payload))
        db.close()
