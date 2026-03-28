from fastapi import FastAPI
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes.auth import router as auth_router
from app.routes.user import router as user_router
from app.routes.chat import router as chat_router
from app.routes.message import router as message_router
from app.routes.ws import router as ws_router
from app.core.redis_subscriber import redis_listener
from app.routes.meeting import router as meeting_router
from app.routes.meeting_ws import router as meeting_ws_router

from app.routes.ws import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(redis_listener())
    heartbeat_task = asyncio.create_task(manager.heartbeat())
    
    yield
    
    # Cleanup
    task.cancel()
    heartbeat_task.cancel()

app = FastAPI(
    title="CollabSpace Backend",
    lifespan=lifespan
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "running"}

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(chat_router)
app.include_router(message_router)
app.include_router(ws_router)
app.include_router(meeting_router)
app.include_router(meeting_ws_router)