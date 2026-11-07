from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid7

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Relationship, SQLModel

from src.common.enums import UserRole

if TYPE_CHECKING:
    from src.modules.events.models import Event



class User(SQLModel, table=True):
    __tablename__ = "users"
    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True, nullable=False)
    email: str = Field(max_length=255, index=True, unique=True, nullable=False)
    password_hash: str = Field(max_length=255, nullable=False)

    first_name: str = Field(max_length=100, nullable=False)
    last_name: str = Field(max_length=100, nullable=False)
    role: UserRole = Field(default=UserRole.MEMBER, nullable=False)

    faculty: str | None = Field(default=None, max_length=255)
    course: int | None = Field(default=None)
    group_name: str | None = Field(default=None, max_length=50)

    bio: str | None = Field(default=None)
    github_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)

    telegram_username: str | None = Field(default=None, max_length=32)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, server_default=func.now()), default_factory=lambda: datetime.now(UTC))

    created_events: list[Event] = Relationship(back_populates="creator_of_event")
