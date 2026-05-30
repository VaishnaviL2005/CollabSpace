from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session
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

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    def update_pong(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections[websocket]["last_pong"] = time.time()

    async def broadcast_local(self, message: dict):
        for ws in list(self.active_connections.keys()):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws)

manager = PresenceManager()

@router.websocket("/ws/presence")
async def presence_ws(
    websocket: WebSocket,
    token: str = Query(...)
):
    await websocket.accept()
    db: Session = SessionLocal()

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

        # Update DB Last Seen
        user.status = "online"
        db.commit()

        # Register Connection
        await manager.connect(user.id, websocket)

        # Send current online users to this new connection
        online_users = db.query(User).filter(User.status != "offline").all()
        for ou in online_users:
            await websocket.send_json({
                "type": "global_presence",
                "user_id": str(ou.id),
                "status": ou.status
            })

        # Notify network about THIS user coming online
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
        user.status = "offline"
        db.commit()
        manager.disconnect(websocket)
        presence_payload = {
            "type": "global_presence",
            "user_id": str(user.id),
            "status": "offline"
        }
        await redis_client.publish("global_presence", json.dumps(presence_payload))

    finally:
        db.close()
