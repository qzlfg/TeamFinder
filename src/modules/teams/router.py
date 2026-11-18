from uuid import UUID

from fastapi import APIRouter, Depends, status

from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User

from .dependencies import get_team_service
from .schemas import TeamCreate, TeamRead, TeamUpdate
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