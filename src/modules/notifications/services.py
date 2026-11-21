import asyncio
import logging
from collections.abc import AsyncGenerator, Sequence
from uuid import UUID

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from common.event_bus import NotificationEvent
from core.database import async_session_maker
from core.redis import get_redis_client
from modules.notifications.exceptions import (
    NotificationForbiddenError,
    NotificationNotFoundError,
)
from modules.notifications.models import Notification
from modules.notifications.repository import NotificationRepository
from modules.notifications.schemas import NotificationRead

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "notifications"


class RedisSSEManager:
    """
    Менеджер SSE-соединений с синхронизацией между воркерами через Redis Pub/Sub.
    Держит 1 фоновое Pub/Sub-соединение на процесс и раздаёт события в локальные очереди вкладок.
    """

    def __init__(self) -> None:
        self._connections: dict[UUID, list[asyncio.Queue[str]]] = {}

    @property
    def _redis(self) -> Redis:
        return get_redis_client()

    @staticmethod
    def _channel_name(user_id: UUID) -> str:
        return f"{CHANNEL_PREFIX}:{user_id}"

    def connect(self, user_id: UUID) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        self._connections.setdefault(user_id, []).append(queue)
        return queue

    def disconnect(self, user_id: UUID, queue: asyncio.Queue[str]) -> None:
        queues = self._connections.get(user_id)
        if not queues:
            return
        if queue in queues:
            queues.remove(queue)
        if not queues:
            self._connections.pop(user_id, None)

    def _push_local(self, user_id: UUID, payload_json: str) -> None:
        """Кладёт сообщение в локальные очереди всех вкладок пользователя на текущем воркере."""
        queues = self._connections.get(user_id)
        if not queues:
            return

        for queue in list(queues):
            try:
                queue.put_nowait(payload_json)
            except asyncio.QueueFull:
                pass

    async def publish(self, user_id: UUID, payload_json: str) -> None:
        """Публикует JSON-уведомление в канал пользователя в Redis."""
        await self._redis.publish(self._channel_name(user_id), payload_json)

    async def listen_loop(self) -> None:
        """Фоновая задача: слушает шаблон notifications:* и маршрутизирует события в локальные очереди."""
        pattern = f"{CHANNEL_PREFIX}:*"

        while True:
            pubsub = self._redis.pubsub()
            try:
                await pubsub.psubscribe(pattern)
                async for message in pubsub.listen():
                    if message.get("type") != "pmessage":
                        continue

                    channel = message.get("channel")
                    data = message.get("data")
                    if not isinstance(channel, str) or not isinstance(data, str):
                        continue

                    try:
                        user_id = UUID(channel.split(":", 1)[1])
                    except (IndexError, ValueError):
                        continue

                    self._push_local(user_id, data)
            except asyncio.CancelledError:
                raise
            except RedisError:
                logger.exception("Потеряно соединение с Redis Pub/Sub, переподключение через 2с...")
                await asyncio.sleep(2.0)
            finally:
                try:
                    await pubsub.punsubscribe(pattern)
                    await pubsub.aclose()
                except RedisError:
                    pass

    async def event_stream(
        self, user_id: UUID, request: Request
    ) -> AsyncGenerator[str]:
        """Асинхронный генератор SSE-событий для StreamingResponse."""
        queue = self.connect(user_id)
        try:
            yield "event: connected\ndata: {}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    data = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"event: notification\ndata: {data}\n\n"
                except TimeoutError:
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self.disconnect(user_id, queue)


sse_manager = RedisSSEManager()


class NotificationService:
    def __init__(
        self,
        notification_repo: NotificationRepository,
        connection_manager: RedisSSEManager = sse_manager,
    ):
        self.notification_repo = notification_repo
        self.connection_manager = connection_manager

    async def create_and_push(
        self,
        *,
        user_id: UUID,
        title: str,
        message: str,
        action_url: str | None = None,
    ) -> Notification:
        """Сохраняет уведомление в PostgreSQL и публикует его в Redis Pub/Sub."""
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            action_url=action_url,
        )
        saved = await self.notification_repo.create(notification)

        payload_json = NotificationRead.model_validate(saved).model_dump_json()
        await self.connection_manager.publish(user_id, payload_json)
        return saved

    async def get_my_notifications(
        self,
        user_id: UUID,
        *,
        unread_only: bool,
        skip: int,
        limit: int,
    ) -> Sequence[Notification]:
        return await self.notification_repo.get_user_notifications(
            user_id=user_id,
            unread_only=unread_only,
            skip=skip,
            limit=limit,
        )

    async def get_unread_count(self, user_id: UUID) -> int:
        return await self.notification_repo.count_unread(user_id)

    async def mark_as_read(
        self, notification_id: UUID, user_id: UUID
    ) -> Notification:
        notification = await self.notification_repo.get_by_id(notification_id)
        if not notification:
            raise NotificationNotFoundError()

        if notification.user_id != user_id:
            raise NotificationForbiddenError()

        return await self.notification_repo.mark_as_read(notification)

    async def mark_all_as_read(self, user_id: UUID) -> None:
        await self.notification_repo.mark_all_as_read(user_id)


async def handle_notification_event(event: NotificationEvent) -> None:
    """Подписчик внутренней шины событий: пишет в БД и отправляет в Redis."""
    async with async_session_maker() as session:
        repo = NotificationRepository(session)
        service = NotificationService(repo, sse_manager)
        await service.create_and_push(
            user_id=event.user_id,
            title=event.title,
            message=event.message,
            action_url=event.action_url,
        )