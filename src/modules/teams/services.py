from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from src.common.enums import ParticipantStatus, TeamStatus, UserRole, VacancyStatus
from src.modules.events.exceptions import (
    EventInactiveError,
    EventNotFoundError,
    EventRegistrationDeadlinePassedError,
    ParticipantNotFoundError,
)
from src.modules.events.models import EventParticipant
from src.modules.events.repository import EventRepository
from src.modules.teams.exceptions import (
    InvalidLeadershipTransferError,
    LeaderCannotLeaveTeamError,
    TeamError,
    TeamForbiddenError,
    TeamFullError,
    TeamMemberAlreadyExistsError,
    TeamMemberNotFoundError,
    TeamNotFoundError,
    TeamNotRecruitingError,
    TeamTitleAlreadyTaken,
    UserAlreadyInEventTeamError,
    VacancyNotFoundError,
)
from src.modules.teams.models import Team, TeamMember, Vacancy, VacancySkill
from src.modules.teams.repository import TeamRepository
from src.modules.teams.schemas import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberDetailRead,
    TeamMemberUpdate,
    TeamRead,
    TeamUpdate,
    VacancyCreate,
    VacancySkillInput,
    VacancyUpdate,
)
from src.modules.users.models import Skill, User
from src.modules.users.schemas import UserPublicRead


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
            existing_team = await self.team_repo.get_team_by_title(event.id, team_in.title)
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
        user_id: UUID | None,
        statuses: list[TeamStatus] | None,
        event_id: UUID | None,
        only_pet_projects: bool,
        skip: int,
        limit: int,
    ) -> list[TeamRead]:
        rows = await self.team_repo.get_teams(
            user_id=user_id,
            statuses=statuses,
            event_id=event_id,
            only_pet_projects=only_pet_projects,
            skip=skip,
            limit=limit,
        )
        return [
            TeamRead(
                **team.model_dump(),
                members_count=members_count,
                open_vacancies_count=open_vacancies_count,
            )
            for team, members_count, open_vacancies_count in rows
        ]

    async def get_team_by_id(
        self,
        team_id: UUID,
    ):
        return await self.team_repo.get_by_id(team_id)

    async def get_teams_by_event(
        self,
        event_id: UUID,
        statuses: list[TeamStatus] | None,
        skip: int,
        limit: int,
    ) -> list[TeamRead]:
        event = await self.event_repo.get_by_id(event_id)
        if not event:
            raise EventNotFoundError()

        return await self.get_all_teams(
            user_id=None,
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

        if (
            update_data.status is not None
            and update_data.status != TeamStatus.RECRUITING
            and team.status == TeamStatus.RECRUITING
        ):
            await self.team_repo.close_open_vacancies(team.id)

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

    async def delete_team(self, team_id: UUID, user: User) -> None:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        if user.role != UserRole.ADMIN and team.leader_id != user.id:
            raise TeamForbiddenError()

        if team.event_id is not None:
            event = await self.event_repo.get_by_id(team.event_id)
            if not event:
                raise EventNotFoundError()

            if not event.is_active and user.role != UserRole.ADMIN:
                raise EventInactiveError()

            member_ids = await self.team_repo.get_member_user_ids(team.id)
            await self.event_repo.reset_participants_to_searching(
                event_id=team.event_id,
                user_ids=member_ids,
            )

        await self.team_repo.delete(team)


    async def get_team_members(self, team_id: UUID) -> Sequence[TeamMemberDetailRead]:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        members = await self.team_repo.get_members(team_id)
        users = await self.team_repo.get_users_by_ids([member.user_id for member in members])
        users_by_id = {user.id: user for user in users}

        return [
            TeamMemberDetailRead(
                user=UserPublicRead.model_validate(users_by_id[member.user_id], from_attributes=True),
                role_name=member.role_name,
                joined_at=member.joined_at,
            )
            for member in members
            if member.user_id in users_by_id
        ]

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

        member = await self.team_repo.get_member_by_id(team_id, target_user_id)
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

        member = await self.team_repo.get_member_by_id(team_id, current_user.id)
        if not member:
            raise TeamMemberNotFoundError()

        solo_participant = None
        if team.event_id is not None:
            solo_participant = await self.event_repo.get_participant_by_id(
                event_id=team.event_id,
                user_id=current_user.id,
            )

        await self.team_repo.remove_member(
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

        member = await self.team_repo.get_member_by_id(team_id, target_user_id)
        if not member:
            raise TeamMemberNotFoundError()

        solo_participant = None
        if team.event_id is not None:
            solo_participant = await self.event_repo.get_participant_by_id(
                event_id=team.event_id,
                user_id=target_user_id,
            )

        await self.team_repo.remove_member(
            member=member,
            solo_participant=solo_participant,
        )


    async def _load_and_validate_skills(
        self,
        skills: Sequence[VacancySkillInput],
    ) -> dict[int, Skill]:
        """Загружает объекты Skill и проверяет, что все переданные ID существуют."""
        if not skills:
            return {}

        requested_ids = {item.skill_id for item in skills}
        skills_by_id = await self.team_repo.get_skills_by_ids(list(requested_ids))
        missing = requested_ids - skills_by_id.keys()
        if missing:
            raise TeamError(f"Указанные навыки не найдены: {sorted(missing)}")

        return skills_by_id
    

    async def create_vacancy(self, team_id: UUID, user: User, vacancy_data: VacancyCreate) -> Vacancy:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()
        if user.role != UserRole.ADMIN and team.leader_id != user.id:
            raise TeamForbiddenError()

        if team.status != TeamStatus.RECRUITING:
            raise TeamNotRecruitingError()

        if team.event_id is not None:
            event = await self.event_repo.get_by_id(team.event_id)
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

            current_size = await self.team_repo.count_members(team_id)
            if current_size >= event.max_team_size:
                raise TeamFullError()

        skills_by_id = await self._load_and_validate_skills(vacancy_data.skills)

        vacancy = Vacancy(
            team_id=team_id,
            title=vacancy_data.title,
            description=vacancy_data.description,
            required_role=vacancy_data.required_role,
        )
        vacancy.skill_links = [
            VacancySkill(
                vacancy_id=vacancy.id,
                skill_id=item.skill_id,
                is_required=item.is_required,
                skill=skills_by_id[item.skill_id],
            )
            for item in vacancy_data.skills
        ]

        return await self.team_repo.create_vacancy(vacancy)

    async def get_team_vacancies(
        self,
        team_id: UUID,
        status: VacancyStatus | None,
        skill_ids: list[int] | None,
        skip: int,
        limit: int,
    ) -> Sequence[Vacancy]:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        if status == VacancyStatus.OPEN and team.status != TeamStatus.RECRUITING:
            return []

        return await self.team_repo.get_vacancies(
            team_ids=[team_id],
            status=status,
            skill_ids=skill_ids,
            skip=skip,
            limit=limit,
        )

    async def get_event_vacancies(
        self,
        event_id: UUID,
        status: VacancyStatus | None,
        skill_ids: list[int] | None,
        skip: int,
        limit: int,
    ) -> Sequence[Vacancy]:
        event = await self.event_repo.get_by_id(event_id)
        if not event:
            raise EventNotFoundError()

        return await self.team_repo.get_vacancies(
            event_ids=[event_id],
            status=status,
            skill_ids=skill_ids,
            skip=skip,
            limit=limit,
        )

    async def get_all_vacancies(
            self,
            team_ids: list[UUID] | None,
            event_ids: list[UUID] | None,
            only_pet_projects: bool,
            status: VacancyStatus | None,
            skill_ids: list[int] | None,
            skip: int,
            limit: int,
    ):
        return await self.team_repo.get_vacancies(
                    team_ids=team_ids,
                    event_ids=event_ids,
                    only_pet_projects=only_pet_projects,
                    status=status,
                    skill_ids=skill_ids,
                    skip=skip,
                    limit=limit,
                )
        
        

    async def update_vacancy(
        self,
        vacancy_id: UUID,
        user: User,
        update_data: VacancyUpdate,
    ) -> Vacancy:
        vacancy = await self.team_repo.get_vacancy_by_id(vacancy_id)
        if not vacancy:
            raise VacancyNotFoundError()

        team = await self.team_repo.get_by_id(vacancy.team_id)
        if not team:
            raise TeamNotFoundError()

        if user.role != UserRole.ADMIN and team.leader_id != user.id:
            raise TeamForbiddenError()

        if (
            update_data.status == VacancyStatus.OPEN
            and vacancy.status == VacancyStatus.CLOSED
        ):
            if team.status != TeamStatus.RECRUITING:
                raise TeamNotRecruitingError()

            if team.event_id is not None:
                event = await self.event_repo.get_by_id(team.event_id)
                if not event:
                    raise EventNotFoundError()
                if not event.is_active:
                    raise EventInactiveError()

                current_size = await self.team_repo.count_members(team.id)
                if current_size >= event.max_team_size:
                    raise TeamFullError()

                if event.registration_deadline:
                    deadline = event.registration_deadline
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=UTC)
                    if deadline <= datetime.now(UTC):
                        raise EventRegistrationDeadlinePassedError()

        skills_by_id: dict[int, Skill] | None = None
        if update_data.skills is not None:
            skills_by_id = await self._load_and_validate_skills(update_data.skills)

        return await self.team_repo.update_vacancy(
            vacancy=vacancy,
            update_data=update_data,
            skills_by_id=skills_by_id,
        )

    async def delete_vacancy(self, vacancy_id: UUID, user: User) -> None:
        vacancy = await self.team_repo.get_vacancy_by_id(vacancy_id)
        if not vacancy:
            raise VacancyNotFoundError()

        team = await self.team_repo.get_by_id(vacancy.team_id)
        if not team:
            raise TeamNotFoundError()

        if user.role != UserRole.ADMIN and team.leader_id != user.id:
            raise TeamForbiddenError()

        await self.team_repo.delete_vacancy(vacancy)