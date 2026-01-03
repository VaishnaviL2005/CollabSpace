from fastapi import FastAPI
from app.db.session import engine
from app.db.base import Base
from app.routes.auth import router as auth_router
from app.routes.user import router as user_router
from app.routes.chat import router as chat_router
from app.routes.message import router as message_router
from app.routes.ws import router as ws_router

# # IMPORTANT: import ALL models
# from app.models.user import User
# from app.models.chat import Chat
# # from app.models.group_chat import GroupChat
# from app.models.chat_member import ChatMember
# from app.models.message import Message
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="CollabSpace Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://127.0.0.1:5500"] etc.
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Authorization, Content-Type, etc.
)

@app.get("/")
def root():
    return {"status": "running"}


app.include_router(auth_router)
app.include_router(user_router)
app.include_router(chat_router)
app.include_router(message_router)
app.include_router(ws_router)