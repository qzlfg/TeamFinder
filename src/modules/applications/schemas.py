from datetime import datetime
from uuid import UUID

from sqlmodel import Field, SQLModel

from common.enums import ApplicationDirection, ApplicationStatus


class ApplicationApplyCreate(SQLModel):
    """Схема отклика студента на открытую вакансию (direction = apply)."""

    vacancy_id: UUID
    cover_letter: str | None = Field(default=None, min_length=1, max_length=1000)


class ApplicationInviteCreate(SQLModel):
    """Схема приглашения студента лидером команды на вакансию (direction = invite)."""

    vacancy_id: UUID
    user_id: UUID
    cover_letter: str | None = Field(default=None, min_length=1, max_length=1000)


class ApplicationStatusUpdate(SQLModel):
    """Схема смены статуса заявки в конечном автомате."""

    status: ApplicationStatus


class ApplicationRead(SQLModel):
    """Базовая схема ответа для заявки или приглашения."""

    id: UUID
    vacancy_id: UUID
    user_id: UUID
    direction: ApplicationDirection
    cover_letter: str | None
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime