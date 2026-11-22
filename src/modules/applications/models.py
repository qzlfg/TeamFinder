from datetime import UTC, datetime
from uuid import UUID, uuid7

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, SQLModel

from src.common.enums import ApplicationDirection, ApplicationStatus


class Application(SQLModel, table=True):
    __tablename__ = "applications"

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True, nullable=False)
    vacancy_id: UUID = Field(foreign_key="vacancies.id", index=True, nullable=False, ondelete="CASCADE")
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False, ondelete="CASCADE")

    direction: ApplicationDirection = Field(nullable=False)
    cover_letter: str | None = Field(default=None, max_length=1000)
    status: ApplicationStatus = Field(
        default=ApplicationStatus.PENDING,
        index=True,
        nullable=False,
    )

    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        ),
        default_factory=lambda: datetime.now(UTC),
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            onupdate=func.now(),
        ),
        default_factory=lambda: datetime.now(UTC),
    )