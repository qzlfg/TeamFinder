from datetime import UTC, datetime
from uuid import UUID, uuid7

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True, nullable=False)
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False, ondelete="CASCADE")

    title: str = Field(max_length=255, nullable=False)
    message: str = Field(max_length=1000, nullable=False)
    action_url: str | None = Field(default=None, max_length=500)
    is_read: bool = Field(default=False, index=True, nullable=False)

    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        ),
        default_factory=lambda: datetime.now(UTC),
    )