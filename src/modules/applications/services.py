from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from common.enums import (
    ApplicationDirection,
    ApplicationStatus,
    ParticipantStatus,
    TeamStatus,
    UserRole,
    VacancyStatus,
)
from modules.applications.exceptions import (
    ApplicationAlreadyExistsError,
    ApplicationForbiddenError,
    ApplicationNotFoundError,
    CannotApplyToOwnTeamError,
    InvalidApplicationTransitionError,
)
from modules.applications.models import Application
from modules.applications.repository import ACTIVE_APP_STATUSES, ApplicationRepository
from modules.applications.schemas import (
    ApplicationApplyCreate,
    ApplicationInviteCreate,
    ApplicationStatusUpdate,
)
from modules.events.exceptions import (
    EventInactiveError,
    EventNotFoundError,
    EventRegistrationDeadlinePassedError,
    ParticipantNotFoundError,
)
from modules.events.models import EventParticipant
from modules.events.repository import EventRepository
from modules.teams.exceptions import (
    TeamForbiddenError,
    TeamFullError,
    TeamMemberAlreadyExistsError,
    TeamNotFoundError,
    TeamNotRecruitingError,
    UserAlreadyInEventTeamError,
    VacancyClosedError,
    VacancyNotFoundError,
)
from modules.teams.models import Team, TeamMember, Vacancy
from modules.teams.repository import TeamRepository
from modules.users.exceptions import UserNotFoundError
from modules.users.models import User
from modules.users.repository import UserRepository


class ApplicationService:
    def __init__(
        self,
        app_repo: ApplicationRepository,
        team_repo: TeamRepository,
        event_repo: EventRepository,
        user_repo: UserRepository,
    ):
        self.app_repo = app_repo
        self.team_repo = team_repo
        self.event_repo = event_repo
        self.user_repo = user_repo

    async def apply_to_vacancy(
        self, current_user: User, payload: ApplicationApplyCreate
    ) -> Application:
        """Студент отправляет отклик (APPLY) на открытую вакансию."""
        vacancy, team = await self._validate_open_vacancy_and_team(payload.vacancy_id)

        # Нельзя откликаться в свою же команду
        existing_member = await self.team_repo.get_member_by_id(team.id, current_user.id)
        if existing_member:
            raise CannotApplyToOwnTeamError()

        await self._validate_event_constraints(
            team=team,
            candidate_user_id=current_user.id,
            require_event_registration=False,
        )

        # Проверка на дубль активного отклика или инвайта
        existing_app = await self.app_repo.get_active_by_vacancy_and_user(
            vacancy.id, current_user.id
        )
        if existing_app:
            raise ApplicationAlreadyExistsError()

        application = Application(
            vacancy_id=vacancy.id,
            user_id=current_user.id,
            direction=ApplicationDirection.APPLY,
            cover_letter=payload.cover_letter,
        )
        return await self.app_repo.create(application)

    async def invite_user_to_vacancy(
        self, current_user: User, payload: ApplicationInviteCreate
    ) -> Application:
        """Лидер команды отправляет приглашение (INVITE) студенту на конкретную вакансию."""
        vacancy, team = await self._validate_open_vacancy_and_team(payload.vacancy_id)

        if current_user.role != UserRole.ADMIN and team.leader_id != current_user.id:
            raise TeamForbiddenError()

        candidate = await self.user_repo.get_by_id(payload.user_id)
        if not candidate:
            raise UserNotFoundError()

        existing_member = await self.team_repo.get_member_by_id(team.id, candidate.id)
        if existing_member:
            raise TeamMemberAlreadyExistsError()

        # Для ивента приглашать можно только зарегистрированного свободного участника
        await self._validate_event_constraints(
            team=team,
            candidate_user_id=candidate.id,
            require_event_registration=True,
        )

        existing_app = await self.app_repo.get_active_by_vacancy_and_user(
            vacancy.id, candidate.id
        )
        if existing_app:
            raise ApplicationAlreadyExistsError()

        application = Application(
            vacancy_id=vacancy.id,
            user_id=candidate.id,
            direction=ApplicationDirection.INVITE,
            cover_letter=payload.cover_letter,
        )
        return await self.app_repo.create(application)

    async def get_my_applications(
        self,
        current_user: User,
        *,
        direction: ApplicationDirection | None,
        statuses: list[ApplicationStatus] | None,
        skip: int,
        limit: int,
    ) -> Sequence[Application]:
        return await self.app_repo.get_user_applications(
            user_id=current_user.id,
            direction=direction,
            statuses=statuses,
            skip=skip,
            limit=limit,
        )

    async def get_team_applications(
        self,
        team_id: UUID,
        current_user: User,
        *,
        vacancy_id: UUID | None,
        direction: ApplicationDirection | None,
        statuses: list[ApplicationStatus] | None,
        skip: int,
        limit: int,
    ) -> Sequence[Application]:
        team = await self.team_repo.get_by_id(team_id)
        if not team:
            raise TeamNotFoundError()

        if current_user.role != UserRole.ADMIN and team.leader_id != current_user.id:
            raise TeamForbiddenError()

        return await self.app_repo.get_team_applications(
            team_id=team_id,
            vacancy_id=vacancy_id,
            direction=direction,
            statuses=statuses,
            skip=skip,
            limit=limit,
        )

    async def get_application_by_id(
        self, application_id: UUID, current_user: User
    ) -> Application:
        application = await self.app_repo.get_by_id(application_id)
        if not application:
            raise ApplicationNotFoundError()

        vacancy = await self.team_repo.get_vacancy_by_id(application.vacancy_id)
        if not vacancy:
            raise VacancyNotFoundError()

        team = await self.team_repo.get_by_id(vacancy.team_id)
        if not team:
            raise TeamNotFoundError()

        is_participant = (
            current_user.role == UserRole.ADMIN
            or current_user.id == application.user_id
            or current_user.id == team.leader_id
        )
        if not is_participant:
            raise ApplicationForbiddenError()

        return application

    async def update_application_status(
        self,
        application_id: UUID,
        current_user: User,
        payload: ApplicationStatusUpdate,
    ) -> Application:
        """Конечный автомат переходов статуса заявки."""
        application = await self.app_repo.get_by_id(application_id)
        if not application:
            raise ApplicationNotFoundError()

        if application.status not in ACTIVE_APP_STATUSES:
            raise InvalidApplicationTransitionError(
                "Нельзя изменить статус уже завершённой заявки"
            )

        target_status = payload.status
        if target_status == ApplicationStatus.PENDING or target_status == application.status:
            raise InvalidApplicationTransitionError()

        vacancy = await self.team_repo.get_vacancy_by_id(application.vacancy_id)
        if not vacancy:
            raise VacancyNotFoundError()

        team = await self.team_repo.get_by_id(vacancy.team_id)
        if not team:
            raise TeamNotFoundError()

        # Определяем роли сторон относительно направления заявки
        is_applicant = current_user.id == application.user_id
        is_leader = current_user.id == team.leader_id
        is_admin = current_user.role == UserRole.ADMIN

        if not (is_applicant or is_leader or is_admin):
            raise ApplicationForbiddenError()

        if application.direction == ApplicationDirection.APPLY:
            is_initiator = is_applicant
            is_recipient = is_leader
        else:  # INVITE
            is_initiator = is_leader
            is_recipient = is_applicant

        # Проверка прав на конкретный переход
        if target_status == ApplicationStatus.CANCELLED:
            if not (is_initiator or is_admin):
                raise ApplicationForbiddenError(
                    "Отозвать заявку может только её инициатор"
                )
            return await self.app_repo.update_status(application, target_status)

        if target_status in (
            ApplicationStatus.IN_DISCUSSION,
            ApplicationStatus.REJECTED,
            ApplicationStatus.ACCEPTED,
        ) and not (is_recipient or is_admin):
            raise ApplicationForbiddenError(
                "Ответить на заявку может только принимающая сторона"
            )

        if target_status in (ApplicationStatus.IN_DISCUSSION, ApplicationStatus.REJECTED):
            return await self.app_repo.update_status(application, target_status)

        return await self._accept_application(application, team.id, vacancy.id)

    async def _accept_application(
        self, application: Application, team_id: UUID, vacancy_id: UUID
    ) -> Application:
        locked_team, locked_vacancy = await self.app_repo.lock_for_acceptance(
            team_id=team_id,
            vacancy_id=vacancy_id,
        )
        if not locked_team:
            raise TeamNotFoundError()
        if not locked_vacancy:
            raise VacancyNotFoundError()

        if locked_vacancy.status != VacancyStatus.OPEN:
            raise VacancyClosedError()
        if locked_team.status != TeamStatus.RECRUITING:
            raise TeamNotRecruitingError()

        existing_member = await self.team_repo.get_member_by_id(
            locked_team.id, application.user_id
        )
        if existing_member:
            raise TeamMemberAlreadyExistsError()

        participant: EventParticipant | None = None

        if locked_team.event_id is not None:
            event = await self.event_repo.get_by_id(locked_team.event_id)
            if not event:
                raise EventNotFoundError()
            if not event.is_active:
                raise EventInactiveError()

            current_size = await self.team_repo.count_members(locked_team.id)
            if current_size >= event.max_team_size:
                raise TeamFullError()

            existing_participant = await self.event_repo.get_participant_by_id(
                event_id=locked_team.event_id,
                user_id=application.user_id,
            )
            if existing_participant:
                if existing_participant.status == ParticipantStatus.IN_TEAM:
                    raise UserAlreadyInEventTeamError()
                participant = existing_participant
            else:
                # Если студент откликнулся на вакансию ивента без соло-регистрации — создаём запись
                participant = EventParticipant(
                    event_id=locked_team.event_id,
                    participant_id=application.user_id,
                    status=ParticipantStatus.IN_TEAM,
                )

        new_member = TeamMember(
            team_id=locked_team.id,
            user_id=application.user_id,
            role_name=locked_vacancy.required_role,
        )

        return await self.app_repo.accept_application_atomic(
            application=application,
            vacancy=locked_vacancy,
            new_member=new_member,
            event_id=locked_team.event_id,
            participant=participant,
        )

    async def _validate_open_vacancy_and_team(
        self, vacancy_id: UUID
    ) -> tuple[Vacancy, Team]:
        vacancy = await self.team_repo.get_vacancy_by_id(vacancy_id)
        if not vacancy:
            raise VacancyNotFoundError()
        if vacancy.status != VacancyStatus.OPEN:
            raise VacancyClosedError()

        team = await self.team_repo.get_by_id(vacancy.team_id)
        if not team:
            raise TeamNotFoundError()
        if team.status != TeamStatus.RECRUITING:
            raise TeamNotRecruitingError()

        return vacancy, team

    async def _validate_event_constraints(
        self,
        *,
        team: Team,
        candidate_user_id: UUID,
        require_event_registration: bool,
    ) -> None:
        if team.event_id is None:
            return

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

        current_size = await self.team_repo.count_members(team.id)
        if current_size >= event.max_team_size:
            raise TeamFullError()

        participant = await self.event_repo.get_participant_by_id(
            event_id=team.event_id,
            user_id=candidate_user_id,
        )
        if participant is None:
            if require_event_registration:
                raise ParticipantNotFoundError()
        elif participant.status == ParticipantStatus.IN_TEAM:
            raise UserAlreadyInEventTeamError()