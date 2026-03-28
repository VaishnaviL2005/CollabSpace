from sqlalchemy import Column, BigInteger, Enum, TIMESTAMP, ForeignKey, String
from sqlalchemy.sql import func

from app.db.base import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(BigInteger, primary_key=True, index=True)

    chat_id = Column(
        BigInteger,
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False
    )

    created_by = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    status = Column(
        Enum("active", "ended", name="meeting_status"),
        nullable=False,
        default="active"
    )

    room_name = Column(String(255), nullable=False, unique=True)

    started_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        nullable=False
    )

    ended_at = Column(TIMESTAMP, nullable=True)
