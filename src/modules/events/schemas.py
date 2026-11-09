from datetime import UTC, datetime
from uuid import UUID

from pydantic import Field, model_validator
from sqlmodel import SQLModel

from src.common.enums import EventType, ParticipantStatus
from src.modules.users.schemas import UserPublicRead


class EventBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    event_type: EventType
    min_team_size: int = Field(default=1, ge=1)
    max_team_size: int = Field(default=5, ge=1)
    registration_deadline: datetime | None = None


class EventCreate(EventBase):
    @model_validator(mode="after")
    def validate_team_sizes_and_deadline(self) -> EventCreate:
        if self.min_team_size > self.max_team_size:
            raise ValueError("Минимальный размер команды не может превышать максимальный")
        if self.registration_deadline and self.registration_deadline <= datetime.now(UTC):
            raise ValueError("Дедлайн регистрации должен быть в будущем")
        return self


class EventUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    event_type: EventType | None = None
    min_team_size: int | None = Field(default=None, ge=1)
    max_team_size: int | None = Field(default=None, ge=1)
    registration_deadline: datetime | None = None
    is_active: bool | None = None


class EventRead(EventBase):
    id: UUID
    creator_id: UUID
    is_active: bool
    created_at: datetime


class EventParticipantCreate(SQLModel):
    """Схема регистрации соло-участника. Статус проставляется автоматически."""
    desired_role: str | None = Field(default=None, max_length=100)


class EventParticipantUpdate(SQLModel):
    """Обновление роли или отмена поиска самим студентом."""
    desired_role: str | None = Field(default=None, max_length=100)


class EventParticipantRead(SQLModel):
    """Базовое отображение статуса участия."""
    id: UUID
    event_id: UUID
    participant_id: UUID
    status: ParticipantStatus
    desired_role: str | None


class EventParticipantDetailRead(EventParticipantRead):
    """Расширенная карточка одиночки для витрины поиска команд (с профилем)."""
    participant: UserPublicRead | None = None