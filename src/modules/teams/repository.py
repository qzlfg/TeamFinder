from collections.abc import Sequence
from uuid import UUID

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from common.enums import ParticipantStatus
from modules.events.models import Event, EventParticipant
from modules.teams.models import Team, TeamMember
from modules.teams.schemas import TeamUpdate


class TeamRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def count_members(self, team_id: UUID) -> int:
        """Возвращает текущее количество участников в команде."""
        statement = (
            select(func.count())
            .select_from(TeamMember)
            .where(TeamMember.team_id == team_id)
        )
        result = await self.session.exec(statement)
        return result.one()

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
        
    async def get_team_by_title(self, event_id: UUID, title: str):
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
        solo_participant: EventParticipant | None = None,) -> Team:
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

    async def get_event_teams(self, event_id: UUID, skip: int, limit: int) -> Sequence[Team]:
        statement = select(Team).where(Event.id == event_id).offset(skip).limit(limit)
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