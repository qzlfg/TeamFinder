from collections.abc import Sequence
from uuid import UUID

from sqlmodel import col, func, select
from sqlmodel import delete as sqlmodel_delete
from sqlmodel import update as sqlmodel_update
from sqlmodel.ext.asyncio.session import AsyncSession

from common.enums import ParticipantStatus, TeamStatus, VacancyStatus
from modules.events.models import EventParticipant
from modules.teams.models import Team, TeamMember, Vacancy
from modules.teams.schemas import TeamMemberUpdate, TeamUpdate, VacancyUpdate


class TeamRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save(self, team: Team) -> Team:
        self.session.add(team)
        await self.session.commit()
        await self.session.refresh(team)
        return team

    async def get_members(self, team_id: UUID) -> Sequence[TeamMember]:
        statement = select(TeamMember).where(TeamMember.team_id == team_id)
        result = await self.session.exec(statement)
        return result.all()

    async def count_members(self, team_id: UUID) -> int:
        """Возвращает текущее количество участников в команде."""
        statement = (
            select(func.count())
            .select_from(TeamMember)
            .where(TeamMember.team_id == team_id)
        )
        result = await self.session.exec(statement)
        return result.one()

    async def get_member_by_id(self, team_id: UUID, user_id: UUID) -> TeamMember | None:
        statement = select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        result = await self.session.exec(statement)
        return result.first()

    async def get_user_team_in_event(self, event_id: UUID, user_id: UUID) -> Team | None:
        """Проверяет, состоит ли пользователь уже в какой-либо команде этого мероприятия."""
        statement = (
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                Team.event_id == event_id,
                TeamMember.user_id == user_id,
                )
        )
        result = await self.session.exec(statement)
        return result.first()
        
    async def get_team_by_title(self, event_id: UUID, title: str) -> Team | None:
        """Поиск команды с таким названием"""
        statement = select(Team).where(
            func.lower(Team.title) == title.lower().strip(),
            Team.event_id == event_id,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create_team(self,
        team: Team,
        leader_member: TeamMember,
        solo_participant: EventParticipant | None = None,
        ) -> Team:
        self.session.add(team)
        await self.session.flush()

        leader_member.team_id = team.id
        self.session.add(leader_member)

        if solo_participant is not None:
            solo_participant.status = ParticipantStatus.IN_TEAM
            self.session.add(solo_participant)

        await self.session.commit()
        await self.session.refresh(team)
        return team

    async def get_teams(
        self,
        *,
        statuses: list[TeamStatus] | None,
        event_id: UUID | None,
        only_pet_projects: bool,
        skip: int,
        limit: int,
    ) -> Sequence[Team]:
        statement = select(Team)

        if statuses:
            statement = statement.where(col(Team.status).in_(statuses))

        if only_pet_projects:
            statement = statement.where(col(Team.event_id).is_(None))
        elif event_id is not None:
            statement = statement.where(Team.event_id == event_id)

        statement = (
            statement.order_by(col(Team.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()

    async def get_by_id(self, team_id: UUID) -> Team | None:
        return await self.session.get(Team, team_id)

    async def update(self, team: Team, update_data: TeamUpdate) -> Team:
        patch_dict = update_data.model_dump(exclude_unset=True)

        if "repository_url" in patch_dict and patch_dict["repository_url"] is not None:
            patch_dict["repository_url"] = str(patch_dict["repository_url"])

        for key, value in patch_dict.items():
            setattr(team, key, value)

        self.session.add(team)
        await self.session.commit()
        await self.session.refresh(team)
        return team

    async def get_member_user_ids(self, team_id: UUID) -> Sequence[UUID]:
        """Возвращает список user_id всех участников команды."""
        statement = select(TeamMember.user_id).where(TeamMember.team_id == team_id)
        result = await self.session.exec(statement)
        return result.all()

    async def delete(self, team: Team) -> None:
        """Удаляет вакансии, состав участников и саму команду в одной транзакции."""
        await self.session.exec(
            sqlmodel_delete(Vacancy).where(col(Vacancy.team_id) == team.id)
        )
        await self.session.exec(
            sqlmodel_delete(TeamMember).where(col(TeamMember.team_id) == team.id)
        )
        await self.session.delete(team)
        await self.session.commit()

    async def add_member(
        self,
        member: TeamMember,
        solo_participant: EventParticipant | None = None,
    ) -> TeamMember:
        """Добавляет участника в команду и переводит его статус одиночки в IN_TEAM."""
        self.session.add(member)
        if solo_participant is not None:
            solo_participant.status = ParticipantStatus.IN_TEAM
            self.session.add(solo_participant)

        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def update_member(
            self,
            member: TeamMember,
            update_data: TeamMemberUpdate,
    ) -> TeamMember:
        patch_dict = update_data.model_dump(exclude_unset=True)
        for key, value in patch_dict.items():
            setattr(member, key, value)

        self.session.add(member)
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def remove_member(self,
                            member: TeamMember,
                            solo_participant: EventParticipant | None = None,) -> None:
        """Удаляет участника из команды и возвращает его в пул поиска (если он в ивенте)."""
        await self.session.delete(member)
        if solo_participant is not None:
            solo_participant.status = ParticipantStatus.SEARCHING
            self.session.add(solo_participant)

        await self.session.commit()


    async def get_vacancy_by_id(self, vacancy_id: UUID) -> Vacancy | None:
        return await self.session.get(Vacancy, vacancy_id)

    async def get_team_vacancies(
        self,
        team_id: UUID,
        status: VacancyStatus | None,
        skip: int,
        limit: int,
    ) -> Sequence[Vacancy]:
        statement = select(Vacancy).where(Vacancy.team_id == team_id)

        if status is not None:
            statement = statement.where(Vacancy.status == status)

        statement = (
            statement.order_by(col(Vacancy.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()

    async def get_vacancies_by_event(
        self,
        event_id: UUID,
        status: VacancyStatus | None,
        skip: int,
        limit: int,
    ) -> Sequence[Vacancy]:
        """Витрина вакансий всех команд внутри конкретного мероприятия."""
        statement = (
            select(Vacancy)
            .join(Team, Vacancy.team_id == Team.id)
            .where(Team.event_id == event_id)
        )

        if status is not None:
            statement = statement.where(Vacancy.status == status)

        statement = (
            statement.order_by(col(Vacancy.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()

    async def create_vacancy(self, vacancy: Vacancy) -> Vacancy:
        self.session.add(vacancy)
        await self.session.commit()
        await self.session.refresh(vacancy)
        return vacancy

    async def update_vacancy(
        self, vacancy: Vacancy, update_data: VacancyUpdate
    ) -> Vacancy:
        patch_dict = update_data.model_dump(exclude_unset=True)
        for key, value in patch_dict.items():
            setattr(vacancy, key, value)

        self.session.add(vacancy)
        await self.session.commit()
        await self.session.refresh(vacancy)
        return vacancy

    async def delete_vacancy(self, vacancy: Vacancy) -> None:
        await self.session.delete(vacancy)
        await self.session.commit()

    async def close_open_vacancies(self, team_id: UUID) -> None:
        """Переводит все открытые вакансии команды в статус CLOSED."""
        statement = (
            sqlmodel_update(Vacancy)
            .where(
                col(Vacancy.team_id) == team_id,
                col(Vacancy.status) == VacancyStatus.OPEN,
            )
            .values(status=VacancyStatus.CLOSED)
        )
        await self.session.exec(statement)