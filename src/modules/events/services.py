from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from .exceptions import EventTitleAlreadyExistsError
from .models import Event
from .repository import EventRepository
from .schemas import EventCreate


class EventService:
    def __init__(self, event_repo: EventRepository):
        self.event_repo = event_repo

    async def create_event(self, creator_id: UUID, event_data: EventCreate) -> Event:
        existing_event = await self.event_repo.get_active_by_title(event_data.title)
        if existing_event:
            raise EventTitleAlreadyExistsError()

        event = Event(
            **event_data.model_dump(),
            creator_id=creator_id,
        )

        try:
            return await self.event_repo.create(event)
        except IntegrityError:
            raise EventTitleAlreadyExistsError()

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