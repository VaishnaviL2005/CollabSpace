from sqlalchemy import Column, BigInteger, Enum, TIMESTAMP
from sqlalchemy.sql import func
from app.db.base import Base

class Chat(Base):
    __tablename__ = "chats"

    id = Column(BigInteger, primary_key=True, index=True)
    type = Column(Enum("direct", "group"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
