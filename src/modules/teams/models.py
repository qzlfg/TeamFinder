from datetime import UTC, datetime
from uuid import UUID, uuid7

from pydantic import AnyHttpUrl
from sqlmodel import Column, DateTime, Field, SQLModel, func

from common.enums import TeamStatus


class Team(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True, nullable=False)
    event_id: UUID = Field(foreign_key="events.id", index=True, nullable=False)
    leader_id: UUID = Field(foreign_key="user.id", index=True, nullable=False)
    title: str = Field(max_length=255, nullable=False)
    project_description: str | None = Field(default=None)
    repository_url: AnyHttpUrl | None = Field(default=None, max_length=255) #github, gitlab...
    status: TeamStatus = Field(default=TeamStatus.RECRUITING, nullable=False)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, server_default=func.now()), default_factory=lambda: datetime.now(UTC))