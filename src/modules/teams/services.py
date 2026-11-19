from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from common.enums import ParticipantStatus, TeamStatus, UserRole
from modules.events.exceptions import (
    EventInactiveError,
    EventNotFoundError,
    EventRegistrationDeadlinePassedError,
    ParticipantNotFoundError,
)
from modules.events.models import EventParticipant
from modules.events.repository import EventRepository
from modules.users.models import User

from .exceptions import (
    InvalidLeadershipTransferError,
    LeaderCannotLeaveTeamError,
    TeamForbiddenError,
    TeamFullError,
    TeamMemberAlreadyExistsError,
    TeamMemberNotFoundError,
    TeamNotFoundError,
    TeamTitleAlreadyTaken,
    UserAlreadyInEventTeamError,
)
from .models import Team, TeamMember
from .repository import TeamRepository
from .schemas import TeamCreate, TeamMemberCreate, TeamMemberUpdate, TeamUpdate


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

            if solo_participant:
                if solo_participant.status == ParticipantStatus.IN_TEAM:
                    raise UserAlreadyInEventTeamError()
            else:
                solo_participant = EventParticipant(
                    event_id=team_in.event_id,
                    participant_id=user_id,
                    status=ParticipantStatus.IN_TEAM,
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

    async def get_all_teams(
        self,
        statuses: list[TeamStatus] | None,
        event_id: UUID | None,
        only_pet_projects: bool,
        skip: int,
        limit: int,
    ) -> Sequence[Team]:
        return await self.team_repo.get_teams(
            statuses=statuses,
            event_id=event_id,
            only_pet_projects=only_pet_projects,
            skip=skip,
            limit=limit,
        )

    async def get_teams_by_event(
        self,
        event_id: UUID,
        statuses: list[TeamStatus] | None,
        skip: int,
        limit: int,
    ) -> Sequence[Team]:
        event = await self.event_repo.get_by_id(event_id)
        if not event:
            raise EventNotFoundError()

        return await self.team_repo.get_teams(
            statuses=statuses,
            event_id=event_id,
            only_pet_projects=False,
            skip=skip,
            limit=limit,
        )


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


    async def transfer_leadership(self, team_id: UUID, current_user: User, new_leader_id: UUID) -> Team:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        if current_user.role != UserRole.ADMIN and team.leader_id != current_user.id:
            raise TeamForbiddenError(
                "Передать лидерство может только текущий лидер команды"
            )

        if team.leader_id == new_leader_id:
            raise InvalidLeadershipTransferError(
                "Этот пользователь уже является лидером команды"
            )

        member = await self.team_repo.get_member_by_id(team_id=team_id, user_id=new_leader_id)
        if not member:
            raise InvalidLeadershipTransferError(
                "Нельзя передать лидерство пользователю, который не состоит в команде"
            )

        team.leader_id = new_leader_id
        return await self.team_repo.save(team)


    async def get_team_members(self, team_id: UUID) -> Sequence[TeamMember]:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        return await self.team_repo.get_members(team_id)

    async def add_member(
        self,
        team_id: UUID,
        current_user: User,
        member_in: TeamMemberCreate,
    ) -> TeamMember:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        if current_user.role != UserRole.ADMIN and team.leader_id != current_user.id:
            raise TeamForbiddenError()


        existing_member = await self.team_repo.get_member_by_id(team_id, member_in.user_id)
        if existing_member:
            raise TeamMemberAlreadyExistsError()

        solo_participant = None

        if team.event_id is not None:
            event = await self.event_repo.get_by_id(team.event_id)
            if not event:
                raise EventNotFoundError()
            if not event.is_active:
                raise EventInactiveError()

            current_size = await self.team_repo.count_members(team_id)
            if current_size >= event.max_team_size:
                raise TeamFullError()

            participant = await self.event_repo.get_participant_by_id(
                event_id=team.event_id,
                user_id=member_in.user_id,
            )

            if not participant:
                raise ParticipantNotFoundError()

            if participant.status == ParticipantStatus.IN_TEAM:
                raise UserAlreadyInEventTeamError()

        new_member = TeamMember(
            team_id=team_id,
            user_id=member_in.user_id,
            role_name=member_in.role_name,
        )
        return await self.team_repo.add_member(
            member=new_member,
            solo_participant=solo_participant,
        )

    async def update_member_role(
        self,
        team_id: UUID,
        target_user_id: UUID,
        current_user: User,
        update_data: TeamMemberUpdate,
    ) -> TeamMember:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        # Менять роль может лидер команды, сам участник или администратор
        is_allowed = (
            current_user.role == UserRole.ADMIN
            or team.leader_id == current_user.id
            or current_user.id == target_user_id
        )
        if not is_allowed:
            raise TeamForbiddenError()

        member = await self.team_repo.get_member(team_id, target_user_id)
        if not member:
            raise TeamMemberNotFoundError()

        return await self.team_repo.update_member(member, update_data)

    async def leave_team(self, team_id: UUID, current_user: User) -> None:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        # Лидер не может просто выйти — сначала обязан передать права или удалить команду
        if team.leader_id == current_user.id:
            raise LeaderCannotLeaveTeamError()

        member = await self.team_repo.get_member(team_id, current_user.id)
        if not member:
            raise TeamMemberNotFoundError()

        solo_participant = None
        if team.event_id is not None:
            solo_participant = await self.event_repo.get_participant_by_id(
                event_id=team.event_id,
                user_id=current_user.id,
            )

        await self.team_repo.remove_member_atomic(
            member=member,
            solo_participant=solo_participant,
        )

    async def remove_member(
        self,
        team_id: UUID,
        target_user_id: UUID,
        current_user: User,
    ) -> None:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        # Исключать участников может только лидер или админ
        if current_user.role != UserRole.ADMIN and team.leader_id != current_user.id:
            raise TeamForbiddenError()

        # Лидер не может кикнуть сам себя через этот эндпоинт
        if target_user_id == team.leader_id:
            raise LeaderCannotLeaveTeamError()

        member = await self.team_repo.get_member(team_id, target_user_id)
        if not member:
            raise TeamMemberNotFoundError()

        solo_participant = None
        if team.event_id is not None:
            solo_participant = await self.event_repo.get_participant_by_id(
                event_id=team.event_id,
                user_id=target_user_id,
            )

        await self.team_repo.remove_member_atomic(
            member=member,
            solo_participant=solo_participant,
        )