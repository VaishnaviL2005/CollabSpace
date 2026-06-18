from sqlalchemy import Column, BigInteger, Enum, Index, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class ChatMember(Base):
    __tablename__ = "chat_members"

    id = Column(BigInteger, primary_key=True)
    chat_id = Column(
        BigInteger,
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    role = Column(Enum("admin", "member", name="member_role"), nullable=True)
    last_read_message_id = Column(
        BigInteger, 
        ForeignKey("messages.id", ondelete="SET NULL"), 
        nullable=True
    )
    joined_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("chat_id", "user_id", name="unique_chat_member"),
        Index("idx_chat_members_user", "user_id"),
        Index("idx_chat_members_chat", "chat_id"),
    )
