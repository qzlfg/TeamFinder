from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlmodel import Field, Relationship, SQLModel

from src.common.enums import EventType, ParticipantStatus

if TYPE_CHECKING:
    from modules.users.models import User


class Event(SQLModel, table=True):
    __tablename__ = "events"
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    title: str = Field(nullable=False, index=True)
    description: str = Field(nullable=False)
    event_type: EventType = Field(nullable=False, index=True)
    min_team_size: int = Field(default=1)
    max_team_size: int = Field(default=5)
    creator_id: UUID = Field(foreign_key="users.id", index=True)

    registration_deadline: datetime | None = Field(default=None)
    is_active: bool = Field(default=True)

    creator_of_event: User = Relationship(back_populates="events")


class EventParticipants(SQLModel, table=True):
    __tablename__ = "event_participants"
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    event_id: int = Field(foreign_key="events.id", index=True)
    participant_id: UUID = Field(foreign_key="users.id", index=True)
    status: ParticipantStatus = Field(default=ParticipantStatus.SEARCHING, nullable=False)
    desire_role: str | None = Field(default=None)