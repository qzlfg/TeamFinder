from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from common.enums import ApplicationDirection, ApplicationStatus, UserRole
from modules.applications.dependencies import get_application_service
from modules.applications.schemas import (
    ApplicationApplyCreate,
    ApplicationInviteCreate,
    ApplicationRead,
    ApplicationStatusUpdate,
)
from modules.applications.services import ApplicationService
from modules.auth.dependencies import get_current_user, require_role
from modules.users.models import User

router = APIRouter()

CurrentUser = Annotated[User, Depends(get_current_user)]
MemberUser = Annotated[User, Depends(require_role(UserRole.MEMBER))]
ServiceDep = Annotated[ApplicationService, Depends(get_application_service)]


@router.post(
    "/applications/apply",
    response_model=ApplicationRead,
    status_code=status.HTTP_201_CREATED,
)
async def apply_to_vacancy(
    payload: ApplicationApplyCreate,
    user: MemberUser,
    app_service: ServiceDep,
):
    """
    Отправить отклик студента на открытую вакансию команды (`direction=apply`).

    - **Доступ:** пользователи с ролью `MEMBER`.
    - **Побочные эффекты:** открывает лидеру команды доступ к `telegram_username` соискателя.
    """
    return await app_service.apply_to_vacancy(user, payload)


@router.post(
    "/applications/invite",
    response_model=ApplicationRead,
    status_code=status.HTTP_201_CREATED,
)
async def invite_to_vacancy(
    payload: ApplicationInviteCreate,
    user: CurrentUser,
    app_service: ServiceDep,
):
    """
    Отправить приглашение студенту на открытую вакансию команды (`direction=invite`).

    - **Доступ:** лидер команды-владельца вакансии или администратор (`ADMIN`).
    - **Побочные эффекты:** открывает приглашённому студенту доступ к `telegram_username` лидера.
    """
    return await app_service.invite_user_to_vacancy(user, payload)


@router.get(
    "/applications/me",
    response_model=list[ApplicationRead],
)
async def get_my_applications(
    user: CurrentUser,
    app_service: ServiceDep,
    direction: Annotated[ApplicationDirection | None, Query()] = None,
    status: Annotated[list[ApplicationStatus] | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Получить список исходящих откликов и входящих приглашений текущего пользователя."""
    return await app_service.get_my_applications(
        current_user=user,
        direction=direction,
        statuses=status,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/applications/teams/{team_id}",
    response_model=list[ApplicationRead],
)
async def get_team_applications(
    team_id: UUID,
    user: CurrentUser,
    app_service: ServiceDep,
    vacancy_id: Annotated[UUID | None, Query()] = None,
    direction: Annotated[ApplicationDirection | None, Query()] = None,
    status: Annotated[list[ApplicationStatus] | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """
    Получить все входящие отклики и исходящие приглашения команды.

    - **Доступ:** лидер команды или администратор (`ADMIN`).
    """
    return await app_service.get_team_applications(
        team_id=team_id,
        current_user=user,
        vacancy_id=vacancy_id,
        direction=direction,
        statuses=status,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/applications/{application_id}",
    response_model=ApplicationRead,
)
async def get_application(
    application_id: UUID,
    user: CurrentUser,
    app_service: ServiceDep,
):
    """
    Получить детали конкретной заявки.

    - **Доступ:** автор заявки, лидер команды или администратор (`ADMIN`).
    """
    return await app_service.get_application_by_id(application_id, user)


@router.patch(
    "/applications/{application_id}/status",
    response_model=ApplicationRead,
)
async def update_application_status(
    application_id: UUID,
    payload: ApplicationStatusUpdate,
    user: CurrentUser,
    app_service: ServiceDep,
):
    """
    Изменить статус заявки по правилам конечного автомата.

    - **Инициатор** может перевести активную заявку только в `cancelled`.
    - **Принимающая сторона** может перевести заявку в `in_discussion`, `rejected` или `accepted`.
    - При переходе в `accepted` атомарно закрывается вакансия, пользователь добавляется в команду
      и отменяются все его конкурирующие активные заявки в рамках того же мероприятия.
    """
    return await app_service.update_application_status(
        application_id=application_id,
        current_user=user,
        payload=payload,
    )