from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from src.common.enums import TeamStatus, UserRole, VacancyStatus
from src.modules.auth.dependencies import get_current_user, require_role
from src.modules.teams.dependencies import get_team_service
from src.modules.teams.schemas import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberDetailRead,
    TeamMemberRead,
    TeamMemberUpdate,
    TeamRead,
    TeamUpdate,
    VacancyCreate,
    VacancyRead,
    VacancyUpdate,
)
from src.modules.teams.services import TeamService
from src.modules.users.models import User

router = APIRouter()

CurrentUser = Annotated[User, Depends(get_current_user)]
MemberUser = Annotated[User, Depends(require_role(UserRole.MEMBER))]
ServiceDep = Annotated[TeamService, Depends(get_team_service)]


# =====================================================================
# 1. УПРАВЛЕНИЕ КОМАНДАМИ (TEAMS)
# =====================================================================


@router.get(
    "/teams",
    response_model=list[TeamRead],
    dependencies=[Depends(get_current_user)],
)
async def get_teams(
    team_service: ServiceDep,
    status: Annotated[list[TeamStatus] | None, Query()] = None,
    event_id: Annotated[UUID | None, Query()] = None,
    only_pet_projects: Annotated[bool, Query()] = False,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """
    Получить каталог команд с поддержкой фильтрации и пагинации.

    - **Доступ:** любой авторизованный пользователь.
    - **Фильтры:** множественный выбор по `status`, привязка к `event_id` или флаг `only_pet_projects`.
    """
    return await team_service.get_all_teams(
        user_id=None,
        statuses=status,
        event_id=event_id,
        only_pet_projects=only_pet_projects,
        skip=skip,
        limit=limit,
    )

@router.get(
    "/teams/me",
    response_model=list[TeamRead],
    dependencies=[Depends(get_current_user)]
)
async def get_all_personal_teams(
    user: MemberUser,
    team_service: ServiceDep,
    #personal: Annotated[bool | None, Query()] = None,
    status: Annotated[list[TeamStatus] | None, Query()] = None,
    event_id: Annotated[UUID | None, Query()] = None,
    only_pet_projects: Annotated[bool, Query()] = False,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return await team_service.get_all_teams(
        user_id=user.id,
        statuses=status,
        event_id=event_id,
        only_pet_projects=only_pet_projects,
        skip=skip,
        limit=limit
    )


@router.post(
    "/teams",
    response_model=TeamRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_team(
    team_in: TeamCreate,
    user: MemberUser,
    team_service: ServiceDep,
):
    """
    Создать новую команду (в рамках мероприятия или как свободный пет-проект).

    - **Доступ:** только пользователи с ролью `MEMBER`.
    - **Побочные эффекты:** создатель автоматически добавляется в `team_members` как `Team Lead`,
      а при указании `event_id` его статус в `event_participants` переводится в `IN_TEAM`.
    """
    return await team_service.create_team(user_id=user.id, team_in=team_in)



@router.get(
    "/teams/{team_id}",
    response_model=TeamRead,
    dependencies=[Depends(get_current_user)],
)
async def get_team(
    team_id: UUID,
    team_service: ServiceDep,
):
    """
    Получить детальную карточку конкретной команды по её идентификатору.

    - **Доступ:** любой авторизованный пользователь.
    - **Ошибки:** `404`, если команда не найдена.
    """
    return await team_service.get_team_by_id(team_id)


@router.patch(
    "/teams/{team_id}",
    response_model=TeamRead,
)
async def update_team(
    team_id: UUID,
    update_data: TeamUpdate,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Частично обновить данные команды (название, описание, ссылку на репозиторий, статус набора).

    - **Доступ:** только лидер этой команды или администратор (`ADMIN`).
    - **Побочные эффекты:** при переводе статуса из `RECRUITING` в `FORMED` или `ARCHIVED`
      все открытые вакансии команды автоматически закрываются.
    """
    return await team_service.update_team(
        team_id=team_id,
        user=user,
        update_data=update_data,
    )


@router.delete(
    "/teams/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_team(
    team_id: UUID,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Полностью удалить команду и расформировать её состав.

    - **Доступ:** только лидер этой команды или администратор (`ADMIN`).
    - **Побочные эффекты:** удаляет связанные вакансии и записи `team_members`; если команда
      была привязана к активному мероприятию, возвращает всех её участников в пул поиска (`SEARCHING`).
    """
    await team_service.delete_team(team_id=team_id, user=user)


@router.post(
    "/teams/{team_id}/transfer-leadership",
    response_model=TeamRead,
)
async def transfer_leadership(
    team_id: UUID,
    new_leader_id: UUID,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Передать права лидера команды другому действующему участнику.

    - **Доступ:** только текущий лидер этой команды или администратор (`ADMIN`).
    - **Ограничения:** новый лидер обязан уже состоять в `team_members` этой команды.
    """
    return await team_service.transfer_leadership(
        team_id=team_id,
        current_user=user,
        new_leader_id=new_leader_id,
    )


# =====================================================================
# 2. УПРАВЛЕНИЕ СОСТАВОМ КОМАНДЫ (TEAM MEMBERS)
# =====================================================================


@router.get(
    "/teams/{team_id}/members",
    response_model=list[TeamMemberDetailRead],
    dependencies=[Depends(get_current_user)],
)
async def get_team_members(
    team_id: UUID,
    team_service: ServiceDep,
):
    """
    Получить список всех участников команды вместе с их публичными профилями.

    - **Доступ:** любой авторизованный пользователь.
    """
    return await team_service.get_team_members(team_id)


@router.post(
    "/teams/{team_id}/members",
    response_model=TeamMemberRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: UUID,
    member_in: TeamMemberCreate,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Напрямую добавить пользователя в состав команды с указанием его роли.

    - **Доступ:** только лидер команды или администратор (`ADMIN`).
    - **Ограничения:** для команд в мероприятии кандидат должен быть зарегистрирован на ивент,
      не состоять в другой команде этого ивента и не превышать лимит `max_team_size`.
    """
    return await team_service.add_member(
        team_id=team_id,
        current_user=user,
        member_in=member_in,
    )


@router.patch(
    "/teams/{team_id}/members/{user_id}",
    response_model=TeamMemberRead,
)
async def update_team_member_role(
    team_id: UUID,
    user_id: UUID,
    update_data: TeamMemberUpdate,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Изменить проектную роль участника внутри команды (например, с `Backend` на `Tech Lead`).

    - **Доступ:** лидер команды, сам участник (`user_id == current_user.id`) или администратор (`ADMIN`).
    """
    return await team_service.update_member_role(
        team_id=team_id,
        target_user_id=user_id,
        current_user=user,
        update_data=update_data,
    )


@router.delete(
    "/teams/{team_id}/members/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def leave_team(
    team_id: UUID,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Добровольно покинуть команду.

    - **Доступ:** любой участник команды, кроме её текущего лидера.
    - **Ограничения:** лидер не может выйти из команды без предварительной передачи прав (`transfer-leadership`).
    - **Побочные эффекты:** если команда привязана к ивенту, статус пользователя возвращается в `SEARCHING`.
    """
    await team_service.leave_team(team_id=team_id, current_user=user)


@router.delete(
    "/teams/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Исключить участника из состава команды.

    - **Доступ:** только лидер команды или администратор (`ADMIN`).
    - **Ограничения:** нельзя исключить лидера команды.
    - **Побочные эффекты:** возвращает исключённого пользователя в пул поиска (`SEARCHING`) внутри ивента.
    """
    await team_service.remove_member(
        team_id=team_id,
        target_user_id=user_id,
        current_user=user,
    )


# =====================================================================
# 3. УПРАВЛЕНИЕ ВАКАНСИЯМИ КОМАНДЫ (VACANCIES)
# =====================================================================


@router.get(
    "/vacancies",
    response_model=list[VacancyRead],
    dependencies=[Depends(get_current_user)],
)
async def get_vacancies(
    team_service: ServiceDep,
    team_id: Annotated[list[UUID] | None, Query()] = None,
    event_id: Annotated[list[UUID] | None, Query()] = None,
    only_pet_projects: Annotated[bool, Query()] = False,
    status: Annotated[VacancyStatus | None, Query()] = VacancyStatus.OPEN,
    skill_id: Annotated[list[int] | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Общая витрина вакансий с фильтрацией по командам, ивентам, пет-проектам и навыкам."""
    return await team_service.get_all_vacancies(
        team_ids=team_id,
        event_ids=event_id,
        only_pet_projects=only_pet_projects,
        status=status,
        skill_ids=skill_id,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/vacancies/{vacancy_id}",
    response_model=VacancyRead,
    dependencies=[Depends(get_current_user)],
)
async def get_vacancy(
    vacancy_id: UUID,
    team_service: ServiceDep,
):
    """Детальная карточка вакансии с привязанными навыками."""
    return await team_service.get_vacancy_by_id(vacancy_id)



@router.get(
    "/teams/{team_id}/vacancies",
    response_model=list[VacancyRead],
    dependencies=[Depends(get_current_user)],
)
async def get_team_vacancies(
    team_id: UUID,
    team_service: ServiceDep,
    status: Annotated[VacancyStatus | None, Query()] = VacancyStatus.OPEN,
    skill_ids: Annotated[list[int] | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Список вакансий конкретной команды с опциональной фильтрацией по навыкам."""
    return await team_service.get_team_vacancies(
        team_id=team_id,
        status=status,
        skill_ids=skill_ids,
        skip=skip,
        limit=limit,
    )



@router.post(
    "/teams/{team_id}/vacancies",
    response_model=VacancyRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_vacancy(
    team_id: UUID,
    vacancy_in: VacancyCreate,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Открыть новую вакансию для поиска специалиста в команду.

    - **Доступ:** только лидер команды или администратор (`ADMIN`).
    - **Ограничения:** команда должна находиться в статусе `RECRUITING`, а её текущий размер
      должен быть меньше `max_team_size` мероприятия.
    """
    return await team_service.create_vacancy(
        team_id=team_id,
        user=user,
        vacancy_data=vacancy_in,
    )


@router.patch(
    "/vacancies/{vacancy_id}",
    response_model=VacancyRead,
)
async def update_vacancy(
    vacancy_id: UUID,
    update_data: VacancyUpdate,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Обновить описание вакансии, требуемую роль или её статус (`open` / `closed`).

    - **Доступ:** только лидер команды-владельца или администратор (`ADMIN`).
    - **Ограничения:** при повторном открытии закрытой вакансии проверяется статус набора и лимит мест.
    """
    return await team_service.update_vacancy(
        vacancy_id=vacancy_id,
        user=user,
        update_data=update_data,
    )


@router.delete(
    "/vacancies/{vacancy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_vacancy(
    vacancy_id: UUID,
    user: CurrentUser,
    team_service: ServiceDep,
):
    """
    Удалить вакансию команды.

    - **Доступ:** только лидер команды-владельца или администратор (`ADMIN`).
    """
    await team_service.delete_vacancy(vacancy_id=vacancy_id, user=user)