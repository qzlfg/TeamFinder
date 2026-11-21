import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from common.event_bus import NotificationEvent, event_bus
from core.exceptions import setup_exception_handlers
from core.redis import close_redis, get_redis_client
from modules.notifications.services import handle_notification_event, sse_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Проверяем доступность Redis при старте
    await get_redis_client().ping()

    # 2. Подписываем обработчик уведомлений на внутреннюю шину
    event_bus.subscribe(NotificationEvent, handle_notification_event)

    # 3. Запускаем фоновый Redis Pub/Sub слушатель
    listener_task = asyncio.create_task(sse_manager.listen_loop())
    try:
        yield
    finally:
        listener_task.cancel()
        with suppress(asyncio.CancelledError):
            await listener_task
        await close_redis()


app = FastAPI(title="TeamFinder API", lifespan=lifespan)


setup_exception_handlers(app)