from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.core.exceptions import setup_exception_handlers
from src.core.redis import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Действия при запуске (startup)
    yield
    # Действия при остановке (shutdown)
    await close_redis()


app = FastAPI(title="TeamFinder API", lifespan=lifespan)

setup_exception_handlers(app)