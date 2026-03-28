from sqlalchemy import Column, BigInteger, Text, Enum, TIMESTAMP, ForeignKey, Index
from sqlalchemy.sql import func
from app.db.base import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True)
    chat_id = Column(
        BigInteger,
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False
    )
    sender_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False
    )
    content = Column(Text, nullable=False)
    message_type = Column(Text, default="text")
    file_url = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        Index("idx_chat_created", "chat_id", "created_at"),
        Index("idx_chat_id", "chat_id", "id"),
    )
