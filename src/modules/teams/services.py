from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from common.enums import TeamStatus, UserRole
from modules.events.exceptions import (
    EventInactiveError,
    EventNotFoundError,
    EventRegistrationDeadlinePassedError,
)
from modules.events.repository import EventRepository
from modules.users.models import User

from .exceptions import (
    TeamForbiddenError,
    TeamFullError,
    TeamNotFoundError,
    TeamTitleAlreadyTaken,
    UserAlreadyInEventTeamError,
)
from .models import Team, TeamMember
from .repository import TeamRepository
from .schemas import TeamCreate, TeamUpdate


class TeamService:
    def __init__(self, team_repo: TeamRepository, event_repo: EventRepository):
        self.team_repo = team_repo
        self.event_repo = event_repo

    async def get_team(self, team_id: UUID) -> Team | None:
        return await self.team_repo.get_by_id(team_id)

    async def create_team(self, user_id: UUID, team_in: TeamCreate) -> Team:
        solo_participant = None


        if team_in.event_id is not None:
            event = await self.event_repo.get_by_id(team_in.event_id)
            if not event:
                raise EventNotFoundError()

            if not event.is_active:
                raise EventInactiveError()

            if event.registration_deadline:
                deadline = event.registration_deadline
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=UTC)
                if deadline <= datetime.now(UTC):
                    raise EventRegistrationDeadlinePassedError()

            existing_team = await self.team_repo.get_user_team_in_event(
                event_id=team_in.event_id,
                user_id=user_id,
            )
            if existing_team:
                raise UserAlreadyInEventTeamError()
            existing_team = await self.team_repo.get_team_by_title(team_in.title)
            if existing_team:
                raise TeamTitleAlreadyTaken()

            solo_participant = await self.event_repo.get_participant_by_id(
                event_id=team_in.event_id,
                user_id=user_id,
            )

        team = Team(
            title=team_in.title,
            project_description=team_in.project_description,
            repository_url=str(team_in.repository_url) if team_in.repository_url else None,
            event_id=team_in.event_id,
            leader_id=user_id,
        )
        leader_member = TeamMember(
            user_id=user_id,
            role_name="Team Lead",
        )

        return await self.team_repo.create_team(
            team=team,
            leader_member=leader_member,
            solo_participant=solo_participant,
        )

    async def get_event_teams(self, event_id: UUID, skip: int, limit: int) -> Sequence[Team]:
        return await self.team_repo.get_event_teams(event_id, skip, limit)


    async def update_team(
        self,
        team_id: UUID,
        user: User,
        update_data: TeamUpdate,
    ) -> Team:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        if user.role != UserRole.ADMIN and team.leader_id != user.id:
            raise TeamForbiddenError()

        if update_data.status == TeamStatus.RECRUITING and team.event_id is not None:
            event = await self.event_repo.get_by_id(team.event_id)
            if event:
                current_size = await self.team_repo.count_members(team.id)
                if current_size >= event.max_team_size:
                    raise TeamFullError()

        return await self.team_repo.update(team, update_data)