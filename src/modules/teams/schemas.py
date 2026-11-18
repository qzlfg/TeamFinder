from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import AnyHttpUrl, model_validator
from sqlmodel import Field, SQLModel

from common.enums import TeamStatus
from src.modules.users.schemas import UserPublicRead


class TeamCreate(SQLModel):
    event_id: UUID | None = Field(default=None)
    title: str = Field(min_length=1, max_length=255)
    project_description: str | None= Field(default=None, min_length=1)
    repository_url: AnyHttpUrl | None = Field(default=None, min_length=1, max_length=500)
    status: TeamStatus = Field(default=TeamStatus.RECRUITING)


class TeamUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    project_description: str | None= Field(default=None, min_length=1)
    repository_url: AnyHttpUrl | None = Field(default=None, min_length=1, max_length=500)
    status: TeamStatus | None = None

    @model_validator(mode="after")
    def validate_not_empty_and_non_nullable(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Необходимо передать хотя бы одно поле для обновления")

        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("Название команды не может быть пустым")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Статус команды не может быть пустым")

        return self


class TeamRead(SQLModel):
    event_id: UUID | None
    title: str
    project_description: str | None
    repository_url: AnyHttpUrl | None
    status: TeamStatus
    created_at: datetime | None


class TeamMemberCreate(SQLModel):
    """Схема для добавления участника в команду (лидером или через принятие заявки)."""
    role_name: str = Field(min_length=1, max_length=255)
    user_id: UUID


class TeamMemberUpdate(SQLModel):
    """Схема для изменения роли участника внутри команды."""
    role_name: str | None = Field(default=None, min_length=1, max_length=255)


class TeamMemberRead(SQLModel):
    """Базовая схема записи участника команды."""
    id: UUID
    team_id: UUID
    user_id: UUID
    role_name: str
    joined_at: datetime


class TeamMemberDetailRead(SQLModel):
    """Расширенная карточка участника с публичным профилем для отображения состава команды."""
    user: UserPublicRead