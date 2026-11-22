import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.common.event_bus import NotificationEvent, event_bus
from src.core.config import settings
from src.core.database import engine
from src.core.exceptions import setup_exception_handlers
from src.core.redis import close_redis, get_redis_client
from src.modules.applications.router import router as applications_router
from src.modules.auth.router import router as auth_router
from src.modules.events.router import router as events_router
from src.modules.notifications.router import router as notifications_router
from src.modules.notifications.services import handle_notification_event, sse_manager
from src.modules.teams.router import router as teams_router
from src.modules.users.router import router as users_router


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
        await engine.dispose()


app = FastAPI(title="TeamFinder API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_exception_handlers(app)

API_V1_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_V1_PREFIX, tags=["Auth"])
app.include_router(users_router, prefix=API_V1_PREFIX, tags=["Users & Skills"])
app.include_router(events_router, prefix=API_V1_PREFIX, tags=["Events"])
app.include_router(teams_router, prefix=API_V1_PREFIX, tags=["Teams & Vacancies"])
app.include_router(applications_router, prefix=API_V1_PREFIX, tags=["Applications"])
app.include_router(notifications_router, prefix=API_V1_PREFIX, tags=["Notifications"])


@app.get("/health", tags=["System"])
async def healthcheck():
    return {"status": "ok"}