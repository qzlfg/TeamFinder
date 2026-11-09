from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid7

from sqlmodel import (
    Column,
    DateTime,
    Field,
    Index,
    Relationship,
    SQLModel,
    UniqueConstraint,
    func,
    text,
)

from src.common.enums import EventType, ParticipantStatus

if TYPE_CHECKING:
    from modules.users.models import User


class Event(SQLModel, table=True):
    __tablename__ = "events"
    __table_args__ = (
        Index(
            "uq_active_event_title",
            func.lower(text("title")),
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )

    id: UUID = Field(
        default_factory=uuid7, primary_key=True, index=True, nullable=False
    )
    title: str = Field(max_length=255, nullable=False, index=True)
    description: str = Field(nullable=False)
    event_type: EventType = Field(nullable=False, index=True)

    min_team_size: int = Field(default=1, ge=1)
    max_team_size: int = Field(default=5, ge=1)
    creator_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)

    registration_deadline: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        ),
        default_factory=lambda: datetime.now(UTC),
    )

    creator_of_event: User = Relationship(back_populates="created_events")


class EventParticipant(SQLModel, table=True):
    __tablename__ = "event_participants"
    __table_args__ = (
        UniqueConstraint("event_id", "participant_id", name="uq_event_participant"),
    )

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True, nullable=False)
    event_id: UUID = Field(foreign_key="events.id", index=True, nullable=False)
    participant_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)
    status: ParticipantStatus = Field(default=ParticipantStatus.SEARCHING, nullable=False)
    desired_role: str | None = Field(default=None, max_length=100)