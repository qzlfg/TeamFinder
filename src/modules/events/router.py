from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from common.enums import EventType, UserRole
from modules.auth.dependencies import get_current_user, require_role
from modules.users.models import User

from .dependencies import get_event_service
from .schemas import EventCreate, EventRead, EventUpdate, EventParticipantRead, EventParticipantCreate
from .services import EventService

router = APIRouter()



@router.get("/events", response_model=list[EventRead])
async def get_events(
    event_type: list[EventType] | None = Query(default=None),
    status: bool | None = Query(default=True),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
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
async def create_event(event: EventCreate,
                       user: User = Depends(require_role(UserRole.ADMIN,
                                                         UserRole.MENTOR)),
                       event_service: EventService = Depends(get_event_service)):
    return await event_service.create_event(user.id, event)

@router.patch("/events/{event_id}", response_model=EventRead)
async def update_event(event_id: UUID,
                    update_data: EventUpdate,
                    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MENTOR)),
                    event_service: EventService = Depends(get_event_service)):
    return await event_service.update_event(event_id, user, update_data)

@router.post(
    "/events/{event_id}/participants",
    response_model=EventParticipantRead,
    status_code=status.HTTP_201_CREATED,
)
async def join_event_as_solo(event_id: UUID,
                             participant_data: EventParticipantCreate,
                             user: User = Depends(require_role(UserRole.MEMBER)),
                             event_service: EventService = Depends(get_event_service)
                             ):
    return await event_service.register_solo_participant(event_id, user, participant_data)

@router.get("/events/{event_id}/participants", response_model=EventParticipantRead)
async def get_all_participants(event_id: UUID,
                               )



@router.delete("/events/{event_id}/participants/me", status_code=status.HTTP_204_NO_CONTENT)
async def leave_event(event_id: UUID,
                      user: User = Depends(get_current_user),
                      event_service: EventService = Depends(get_event_service)):
    return await event_service.cancel_solo_participant(event_id, user)