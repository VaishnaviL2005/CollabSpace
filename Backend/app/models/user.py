from sqlalchemy import Column, BigInteger, Enum, String, TIMESTAMP, Text
from sqlalchemy.sql import func
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(Text, nullable=True)
    bio = Column(String(200), nullable=True)
    status = Column(Enum("online", "offline", "away", name="user_status"), nullable=True, default="offline")
    created_at = Column(TIMESTAMP, server_default=func.now())
    last_seen = Column(TIMESTAMP, nullable=True)
