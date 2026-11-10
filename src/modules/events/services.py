from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from common.enums import EventType, ParticipantStatus
from modules.users.models import User

from .exceptions import (
    EventForbiddenError,
    EventInactiveError,
    EventNotFoundError,
    EventRegistrationDeadlinePassedError,
    EventTitleAlreadyExistsError,
    InvalidTeamSizeLimitsError,
    ParticipantAlreadyInTeamError,
    ParticipantAlreadyRegisteredError,
    ParticipantNotFoundError,
)
from .models import Event, EventParticipant
from .repository import EventRepository
from .schemas import EventCreate, EventParticipantCreate, EventUpdate


class EventService:
    def __init__(self, event_repo: EventRepository):
        self.event_repo = event_repo

    async def create_event(self, creator_id: UUID, event_data: EventCreate) -> Event:
        existing_event = await self.event_repo.get_active_by_title(event_data.title)
        if existing_event:
            raise EventTitleAlreadyExistsError()
        if event_data.max_team_size > event_data.min_team_size:
            raise InvalidTeamSizeLimitsError()

        event = Event(
            **event_data.model_dump(),
            creator_id=creator_id,
        )

        try:
            return await self.event_repo.create(event)
        except IntegrityError:
            raise EventTitleAlreadyExistsError()

    async def get_event(self, event_id: UUID) -> Event | None:
        return await self.event_repo.get_by_id(event_id)


    async def get_all_events(self, event_types: list[EventType] | None, status: bool | None, skip: int, limit: int) -> Sequence[Event]:
        return await self.event_repo.get_events(event_types, status, skip, limit)

    async def update_event(self, event_id: UUID, user: User , update_data: EventUpdate) -> Event:
        existing_event = await self.event_repo.get_by_id(event_id)
        if not existing_event:
            raise EventNotFoundError()
        if existing_event.creator_id != user.id:
            raise EventForbiddenError()
        return await self.event_repo.update(existing_event, update_data)
    
    async def register_solo_participant(self, event_id: UUID, user: User, participant_desired_role: EventParticipantCreate | None) -> EventParticipant:
        existing_event = await self.event_repo.get_by_id(event_id)
        if not existing_event:
            raise EventNotFoundError()

        participant = await self.event_repo.get_participant_by_id(event_id, user.id)
        if participant is not None and participant.status == ParticipantStatus.IN_TEAM:
            raise ParticipantAlreadyInTeamError()
        elif participant is not None and participant.status == ParticipantStatus.SEARCHING:
            raise ParticipantAlreadyRegisteredError()

        if existing_event.registration_deadline >= datetime.now():
            raise EventRegistrationDeadlinePassedError()
        elif not existing_event.is_active:
            raise EventInactiveError()

        event_participant = EventParticipant(event_id=event_id, participant_id=user.id, desired_role=participant_desired_role.desired_role)

        return await self.event_repo.add_participant(event_participant)


    async def cancel_solo_participant(self, event_id: UUID, user: User) -> EventParticipant:
        existing_event = await self.event_repo.get_by_id(event_id)
        if not existing_event:
            raise EventNotFoundError()
        participant = await self.event_repo.get_participant_by_id(event_id, user.id)
        if participant is None:
            raise ParticipantNotFoundError()
        await self.event_repo.remove_participant(participant)
        return participant

    async def get_all_participants(self, event_id: UUID, skip: int, limit: int) -> Sequence[EventParticipant]:
        return await self.event_repo.get_participants(event_id, skip, limit)

    async def get_solo_participants(self, event_id: UUID, skip: int, limit: int) -> Sequence[EventParticipant]:
        return await self.event_repo.get_solo_participants(event_id, skip, limit)

    async def get_search_suggestions(self, raw_query: str) -> Sequence[Event]:
        query = raw_query.strip()

        # Если пользователь ввел меньше 2 символов, поиск не запускаем
        if len(query) < 2:
            return []

        return await self.event_repo.search_by_title(
            query=query,
            limit=7,
            similarity_threshold=0.25, # Отсекает совсем несвязанный шум
        )