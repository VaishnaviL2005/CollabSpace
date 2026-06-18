from sqlalchemy import Column, BigInteger, Text, Enum, TIMESTAMP, ForeignKey, Index, CheckConstraint
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
    message_type = Column(Enum("text", "file", name="message_type"), nullable=False, default="text")
    file_url = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "message_type != 'file' OR file_url IS NOT NULL",
            name="ck_messages_file_has_url",
        ),
        Index("idx_chat_created", "chat_id", "created_at"),
        Index("idx_chat_id", "chat_id", "id"),
    )
