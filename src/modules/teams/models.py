from datetime import UTC, datetime
from uuid import UUID, uuid7

from sqlmodel import Column, DateTime, Field, SQLModel, UniqueConstraint, func

from common.enums import TeamStatus


class Team(SQLModel, table=True):
    __tablename__ = "teams"

    id: UUID = Field(
        default_factory=uuid7, primary_key=True, index=True, nullable=False
    )

    event_id: UUID | None = Field(
        default=None,
        foreign_key="events.id",
        index=True,
        nullable=True,
    )
    leader_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)

    title: str = Field(max_length=255, nullable=False)
    project_description: str | None = Field(default=None)
    repository_url: str | None = Field(default=None, max_length=500)
    status: TeamStatus = Field(default=TeamStatus.RECRUITING, nullable=False)

    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        ),
        default_factory=lambda: datetime.now(UTC),
    )


class TeamMember(SQLModel, table=True):
    __tablename__ = "team_members"
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )

    id: UUID = Field(default_factory=uuid7, primary_key=True, index=True, nullable=False)
    team_id: UUID = Field(foreign_key="teams.id", index=True, nullable=False)
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)
    role_name: str = Field(max_length=255, nullable=False)

    joined_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        ),
        default_factory=lambda: datetime.now(UTC),
    )