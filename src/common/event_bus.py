from collections import defaultdict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

EventHandler = Callable[[Any], Awaitable[None]]


@dataclass(frozen=True, slots=True)
class NotificationEvent:
    """Событие запроса на отправку уведомления пользователю."""

    user_id: UUID
    title: str
    message: str
    action_url: str | None = None


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[type[Any], list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: type[Any], handler: EventHandler) -> None:
        self._subscribers[event_type].append(handler)

    async def publish(self, event: Any) -> None:
        handlers = self._subscribers.get(type(event), [])
        for handler in handlers:
            await handler(event)


event_bus = EventBus()