from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from src.common.enums import (
    EventType,
    ParticipantStatus,
    TeamStatus,
    UserRole,
    VacancyStatus,
)
from src.modules.auth.dependencies import get_current_user, require_role
from src.modules.events.dependencies import get_event_service
from src.modules.events.schemas import (
    EventCreate,
    EventParticipantCreate,
    EventParticipantDetailRead,
    EventParticipantRead,
    EventRead,
    EventUpdate,
)
from src.modules.events.services import EventService
from src.modules.teams.dependencies import get_team_service
from src.modules.teams.schemas import TeamRead, VacancyRead
from src.modules.teams.services import TeamService
from src.modules.users.models import User

router = APIRouter()


@router.get(
    "/events",
    response_model=list[EventRead],
    dependencies=[Depends(get_current_user)],
)
async def get_events(
    event_type: list[EventType] | None = Query(default=None),
    status: bool | None = Query(default=True),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    event_service: EventService = Depends(get_event_service),
):
    return await event_service.get_all_events(event_type, status, skip, limit)


@router.get(
    "/events/search",
    response_model=list[EventRead],
    dependencies=[Depends(get_current_user)],
)
async def get_events_with_search(
    q: str = Query(min_length=2, max_length=100, description="Поисковый запрос по названию"),
    event_service: EventService = Depends(get_event_service),
):
    return await event_service.get_search_suggestions(q)


@router.get(
    "/events/{event_id}",
    response_model=EventRead,
    dependencies=[Depends(get_current_user)],
)
async def get_event(
    event_id: UUID,
    event_service: EventService = Depends(get_event_service),
):
    return await event_service.get_event(event_id)


@router.post("/events", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: EventCreate,
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MENTOR)),
    event_service: EventService = Depends(get_event_service),
):
    return await event_service.create_event(user.id, event)


@router.patch("/events/{event_id}", response_model=EventRead)
async def update_event(
    event_id: UUID,
    update_data: EventUpdate,
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MENTOR)),
    event_service: EventService = Depends(get_event_service),
):
    return await event_service.update_event(event_id, user, update_data)


@router.post(
    "/events/{event_id}/participants",
    response_model=EventParticipantRead,
    status_code=status.HTTP_201_CREATED,
)
async def join_event_as_solo(
    event_id: UUID,
    participant_data: EventParticipantCreate,
    user: User = Depends(require_role(UserRole.MEMBER)),
    event_service: EventService = Depends(get_event_service),
):
    return await event_service.register_solo_participant(event_id, user, participant_data)


@router.get(
    "/events/{event_id}/participants",
    response_model=list[EventParticipantDetailRead],
    dependencies=[Depends(get_current_user)],
)
async def get_all_participants(
    event_id: UUID,
    status: ParticipantStatus | None = Query(default=ParticipantStatus.SEARCHING),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    event_service: EventService = Depends(get_event_service),
):
    return await event_service.get_all_participants(event_id, status, skip, limit)


@router.delete("/events/{event_id}/participants/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_event(
    event_id: UUID,
    user: User = Depends(get_current_user),
    event_service: EventService = Depends(get_event_service),
):
    await event_service.cancel_solo_participant(event_id, user)


@router.get(
    "/events/{event_id}/teams",
    response_model=list[TeamRead],
    dependencies=[Depends(get_current_user)],
)
async def get_event_teams(
    event_id: UUID,
    status: list[TeamStatus] | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    team_service: TeamService = Depends(get_team_service),
):
    """Список всех команд, участвующих в конкретном мероприятии."""
    return await team_service.get_teams_by_event(
        event_id=event_id,
        statuses=status,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/events/{event_id}/vacancies",
    response_model=list[VacancyRead],
    dependencies=[Depends(get_current_user)],
)
async def get_event_vacancies(
    event_id: UUID,
    team_service: Annotated[TeamService, Depends(get_team_service)],
    status: Annotated[VacancyStatus | None, Query()] = VacancyStatus.OPEN,
    skill_ids: Annotated[list[int] | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Список вакансий конкретного мероприятия с опциональной фильтрацией по навыкам."""
    return await team_service.get_event_vacancies(
        event_id=event_id,
        status=status,
        skill_ids=skill_ids,
        skip=skip,
        limit=limit,
    )