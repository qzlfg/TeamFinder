from collections.abc import Callable
from typing import Annotated
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel.ext.asyncio.session import AsyncSession

from src.common.enums import UserRole
from src.core.database import get_session
from src.core.redis import get_redis  # Клиент aioredis
from src.core.security import decode_token
from src.modules.auth.services import AuthService
from src.modules.users.models import User
from src.modules.users.repository import UserRepository

# auto_error=False позволяет не падать сразу, если заголовка Authorization нет в запросе
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_auth_service(
    session: AsyncSession = Depends(get_session),
    redis: aioredis.Redis = Depends(get_redis),
) -> AuthService:
    return AuthService(user_repo=UserRepository(session), redis=redis)


def get_current_user_id(
    request: Request,
    bearer_token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> UUID:
    """
    Лёгкая зависимость без обращения к БД.
    Проверяет JWT из Bearer-заголовка или HttpOnly Cookie и возвращает user_id.
    Идеальна для SSE / WebSocket, чтобы не трогать пул соединений PostgreSQL.
    """
    token = bearer_token or request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token, expected_type="access")
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или истекший access-токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return UUID(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Некорректный идентификатор пользователя в токене",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


async def get_current_user(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    """Полная зависимость для REST-эндпоинтов: загружает актуальный объект User из БД."""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    return user


def require_role(*roles: UserRole) -> Callable:
    """Фабрика зависимостей для проверки прав доступа по ролям."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для выполнения операции",
            )
        return current_user

    return role_checker