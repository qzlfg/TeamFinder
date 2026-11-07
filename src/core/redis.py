from collections.abc import AsyncIterator

import redis.asyncio as aioredis

from src.core.config import settings

redis_pool: aioredis.ConnectionPool | None = None


def get_redis_pool() -> aioredis.ConnectionPool:
    """Инициализация или получение существующего пула соединений."""
    global redis_pool
    if redis_pool is None:
        redis_pool = aioredis.ConnectionPool.from_url(
            settings.redis_url,  # Например: "redis://localhost:6379/0"
            encoding="utf-8",
            decode_responses=True,  # Возвращает str вместо bytes
            max_connections=20,
        )
    return redis_pool


async def get_redis() -> AsyncIterator[aioredis.Redis]:
    """FastAPI Dependency: выдает клиенту сессию из пула и возвращает соединение обратно."""
    pool = get_redis_pool()
    client = aioredis.Redis(connection_pool=pool)
    try:
        yield client
    finally:
        await client.aclose()


async def close_redis() -> None:
    """Закрытие всех активных соединений пула при остановке сервера."""
    global redis_pool
    if redis_pool is not None:
        await redis_pool.disconnect()
        redis_pool = None