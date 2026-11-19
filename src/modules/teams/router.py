from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from common.enums import TeamStatus, VacancyStatus
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User

from .dependencies import get_team_service
from .schemas import (
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
from .services import TeamService

router = APIRouter()


@router.post("/teams", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
async def create_team(
        data_team: TeamCreate,
        event_id: UUID | None = None,
        user: User = Depends(get_current_user),
        service_team: TeamService = Depends(get_team_service)):
    return await service_team.create_team(event_id, user.id, data_team)

@router.get("/teams/{team_id}", response_model=TeamRead, dependencies=[Depends(get_current_user)], status_code=status.HTTP_200_OK)
async def get_team(
        team_id: UUID,
        service_team: TeamService = Depends(get_team_service)
):
    return await service_team.get_team(team_id)


@router.get(
    "/teams",
    response_model=list[TeamRead],
    dependencies=[Depends(get_current_user)],
)
async def get_teams(
    status: list[TeamStatus] | None = Query(default=None),
    event_id: UUID | None = Query(default=None),
    only_pet_projects: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    team_service: TeamService = Depends(get_team_service),
):
    return await team_service.get_all_teams(
        statuses=status,
        event_id=event_id,
        only_pet_projects=only_pet_projects,
        skip=skip,
        limit=limit,
    )


@router.post("/teams/{team_id}/transfer-leadership", response_model=TeamRead)
async def transfer_leadership(
    team_id: UUID,
    new_leader_id: UUID,
    user: User = Depends(get_current_user),
    team_service: TeamService = Depends(get_team_service),
):
    return await team_service.transfer_leadership(
        team_id=team_id,
        current_user=user,
        new_leader_id=new_leader_id
    )


@router.patch("/teams/{team_id}", response_model=TeamRead)
async def update_team(
    team_id: UUID,
    update_data: TeamUpdate,
    user: User = Depends(get_current_user),
    team_service: TeamService = Depends(get_team_service),
):
    return await team_service.update_team(
        team_id=team_id,
        update_data=update_data,
        user=user
    )

@router.delete(
    "/teams/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_team(
    team_id: UUID,
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
    """Удаление команды (доступно лидеру команды или администратору)."""
    await team_service.delete_team(team_id=team_id, user=user)

@router.get(
    "/teams/{team_id}/members",
    response_model=list[TeamMemberDetailRead],
    dependencies=[Depends(get_current_user)],
)
async def get_team_members(
    team_id: UUID,
    team_service: Depends(get_team_service),
):
    """Список всех участников команды с их публичными профилями."""
    return await team_service.get_team_members(team_id)


@router.post(
    "/teams/{team_id}/members",
    response_model=TeamMemberRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: UUID,
    member_in: TeamMemberCreate,
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
    """Прямое добавление участника в команду (доступно лидеру команды или админу)."""
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
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
    """Изменение роли участника в команде (доступно лидеру, самому участнику или админу)."""
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
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
    """Добровольный выход текущего пользователя из команды."""
    await team_service.leave_team(team_id=team_id, current_user=user)


@router.delete(
    "/teams/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
    """Исключение участника из команды (доступно лидеру команды или админу)."""
    await team_service.remove_member(
        team_id=team_id,
        target_user_id=user_id,
        current_user=user,
    )


@router.get(
    "/teams/{team_id}/vacancies",
    response_model=list[VacancyRead],
    dependencies=[Depends(get_current_user)],
)
async def get_team_vacancies(
    team_id: UUID,
    team_service: Depends(get_team_service),
    status: Annotated[VacancyStatus | None, Query()] = VacancyStatus.OPEN,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return await team_service.get_team_vacancies(
        team_id=team_id,
        status=status,
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
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
    return await team_service.create_vacancy(
        team_id=team_id,
        user=user,
        vacancy_data=vacancy_in,
    )


@router.patch("/vacancies/{vacancy_id}", response_model=VacancyRead)
async def update_vacancy(
    vacancy_id: UUID,
    update_data: VacancyUpdate,
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
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
    user: Depends(get_current_user),
    team_service: Depends(get_team_service),
):
    await team_service.delete_vacancy(vacancy_id=vacancy_id, user=user)