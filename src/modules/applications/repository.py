from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import and_, col, or_, select
from sqlmodel import update as sqlmodel_update
from sqlmodel.ext.asyncio.session import AsyncSession

from common.enums import (
    ApplicationDirection,
    ApplicationStatus,
    ParticipantStatus,
    VacancyStatus,
)
from modules.applications.models import Application
from modules.events.models import EventParticipant
from modules.teams.models import Team, TeamMember, Vacancy

ACTIVE_APP_STATUSES = (
    ApplicationStatus.PENDING,
    ApplicationStatus.IN_DISCUSSION,
)

CONTACT_UNLOCK_STATUSES = (
    ApplicationStatus.PENDING,
    ApplicationStatus.IN_DISCUSSION,
    ApplicationStatus.ACCEPTED,
)


class ApplicationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, application_id: UUID) -> Application | None:
        return await self.session.get(Application, application_id)

    async def get_active_by_vacancy_and_user(
        self, vacancy_id: UUID, user_id: UUID
    ) -> Application | None:
        """Проверяет, есть ли уже активный отклик или инвайт для этой пары."""
        statement = select(Application).where(
            Application.vacancy_id == vacancy_id,
            Application.user_id == user_id,
            col(Application.status).in_(ACTIVE_APP_STATUSES),
        )
        result = await self.session.exec(statement)
        return result.first()

    async def get_user_applications(
        self,
        user_id: UUID,
        *,
        direction: ApplicationDirection | None,
        statuses: list[ApplicationStatus] | None,
        skip: int,
        limit: int,
    ) -> Sequence[Application]:
        """Личный кабинет студента: его исходящие отклики и входящие приглашения."""
        statement = select(Application).where(Application.user_id == user_id)

        if direction is not None:
            statement = statement.where(Application.direction == direction)
        if statuses:
            statement = statement.where(col(Application.status).in_(statuses))

        statement = (
            statement.order_by(col(Application.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()

    async def get_team_applications(
        self,
        team_id: UUID,
        *,
        vacancy_id: UUID | None,
        direction: ApplicationDirection | None,
        statuses: list[ApplicationStatus] | None,
        skip: int,
        limit: int,
    ) -> Sequence[Application]:
        """Кабинет лидера команды: все отклики кандидатов и отправленные инвайты по команде."""
        statement = (
            select(Application)
            .join(Vacancy, Application.vacancy_id == Vacancy.id)
            .where(Vacancy.team_id == team_id)
        )

        if vacancy_id is not None:
            statement = statement.where(Application.vacancy_id == vacancy_id)
        if direction is not None:
            statement = statement.where(Application.direction == direction)
        if statuses:
            statement = statement.where(col(Application.status).in_(statuses))

        statement = (
            statement.order_by(col(Application.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()

    async def has_contact_unlocking_application(
        self, user_a_id: UUID, user_b_id: UUID
    ) -> bool:
        """Проверяет, есть ли между кандидатом и лидером заявка, открывающая Telegram."""
        statement = (
            select(Application.id)
            .join(Vacancy, Application.vacancy_id == Vacancy.id)
            .join(Team, Vacancy.team_id == Team.id)
            .where(
                col(Application.status).in_(CONTACT_UNLOCK_STATUSES),
                or_(
                    and_(
                        Application.user_id == user_a_id,
                        Team.leader_id == user_b_id,
                    ),
                    and_(
                        Application.user_id == user_b_id,
                        Team.leader_id == user_a_id,
                    ),
                ),
            )
            .limit(1)
        )
        result = await self.session.exec(statement)
        return result.first() is not None

    async def create(self, application: Application) -> Application:
        self.session.add(application)
        await self.session.commit()
        await self.session.refresh(application)
        return application

    async def update_status(
        self, application: Application, new_status: ApplicationStatus
    ) -> Application:
        application.status = new_status
        application.updated_at = datetime.now(UTC)
        self.session.add(application)
        await self.session.commit()
        await self.session.refresh(application)
        return application

    async def lock_for_acceptance(
        self, team_id: UUID, vacancy_id: UUID
    ) -> tuple[Team | None, Vacancy | None]:
        """Блокирует строки команды и вакансии (FOR UPDATE) от гонки за последнее место."""
        team_res = await self.session.exec(
            select(Team).where(Team.id == team_id).with_for_update()
        )
        vacancy_res = await self.session.exec(
            select(Vacancy).where(Vacancy.id == vacancy_id).with_for_update()
        )
        return team_res.first(), vacancy_res.first()

    async def accept_application_atomic(
        self,
        *,
        application: Application,
        vacancy: Vacancy,
        new_member: TeamMember,
        event_id: UUID | None,
        participant: EventParticipant | None,
    ) -> Application:
        """
        Атомарная транзакция принятия заявки:
        1. Переводит заявку в ACCEPTED.
        2. Закрывает вакансию (CLOSED).
        3. Добавляет студента в team_members.
        4. Переводит статус участника в event_participants в IN_TEAM.
        5. Автоматически отменяет остальные активные заявки на эту закрытую вакансию.
        6. Автоматически отменяет все остальные активные заявки студента в этом же мероприятии.
        """
        now = datetime.now(UTC)

        application.status = ApplicationStatus.ACCEPTED
        application.updated_at = now
        self.session.add(application)

        vacancy.status = VacancyStatus.CLOSED
        self.session.add(vacancy)

        self.session.add(new_member)

        if participant is not None:
            participant.status = ParticipantStatus.IN_TEAM
            self.session.add(participant)

        # Отменяем остальные висящие заявки других кандидатов на эту же закрытую вакансию
        await self.session.exec(
            sqlmodel_update(Application)
            .where(
                col(Application.vacancy_id) == vacancy.id,
                col(Application.id) != application.id,
                col(Application.status).in_(ACTIVE_APP_STATUSES),
            )
            .values(status=ApplicationStatus.CANCELLED, updated_at=now)
        )

        # Автоотзыв всех остальных активных заявок/инвайтов студента в рамках того же события
        if event_id is not None:
            event_vacancy_ids = (
                select(Vacancy.id)
                .join(Team, Vacancy.team_id == Team.id)
                .where(Team.event_id == event_id)
            )
            await self.session.exec(
                sqlmodel_update(Application)
                .where(
                    col(Application.user_id) == application.user_id,
                    col(Application.id) != application.id,
                    col(Application.vacancy_id).in_(event_vacancy_ids),
                    col(Application.status).in_(ACTIVE_APP_STATUSES),
                )
                .values(status=ApplicationStatus.CANCELLED, updated_at=now)
            )

        await self.session.commit()
        await self.session.refresh(application)
        return application