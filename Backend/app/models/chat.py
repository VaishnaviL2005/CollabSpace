from sqlalchemy import Column, BigInteger, Enum, Index, TIMESTAMP, String, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base

class Chat(Base):
    __tablename__ = "chats"

    id = Column(BigInteger, primary_key=True, index=True)
    type = Column(Enum("direct", "group", name="chat_type"), nullable=False)

    # 🔹 Group-only fields
    name = Column(String(100), nullable=True)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        Index("idx_chats_type", "type"),
    )

