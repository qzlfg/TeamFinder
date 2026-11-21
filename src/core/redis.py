import redis.asyncio as aioredis

from src.core.config import settings

_redis_pool: aioredis.ConnectionPool | None = None
_redis_client: aioredis.Redis | None = None


def get_redis_client() -> aioredis.Redis:
    """Ленивая инициализация пула и единого асинхронного клиента Redis."""
    global _redis_pool, _redis_client
    if _redis_client is None:
        _redis_pool = aioredis.ConnectionPool.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
        _redis_client = aioredis.Redis(connection_pool=_redis_pool)
    return _redis_client


def get_redis() -> aioredis.Redis:
    """FastAPI Dependency (без создания нового объекта на каждый запрос)."""
    return get_redis_client()


async def close_redis() -> None:
    """Закрытие клиента и всех соединений пула при остановке сервера."""
    global _redis_pool, _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None