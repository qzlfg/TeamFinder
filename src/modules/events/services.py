from collections.abc import Sequence

from .models import Event
from .repository import EventRepository


class EventService:
    def __init__(self, event_repo: EventRepository):
        self.event_repo = event_repo

    async def get_search_suggestions(self, raw_query: str) -> Sequence[Event]:
        query = raw_query.strip()

        # Если пользователь ввел меньше 2 символов, поиск не запускаем
        if len(query) < 2:
            return []

        return await self.event_repo.search_by_title(
            query=query,
            limit=7,                  # Для выпадающего списка подсказок достаточно 5-7 штук
            similarity_threshold=0.25, # Отсекает совсем несвязанный шум
        )