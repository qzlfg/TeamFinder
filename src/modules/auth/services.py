import uuid
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

import redis.asyncio as aioredis

from src.core import security
from src.core.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    decode_token,
)
from src.modules.auth.exceptions import (
    InvalidCredentialsError,
    InvalidTokenError,
    SessionExpiredError,
    UserAlreadyExistsError,
)
from src.modules.users.models import User
from src.modules.users.repository import UserRepository
from src.modules.users.schemas import UserCreate


@dataclass(frozen=True)
class AuthResult:
    access_token: str
    refresh_token: str
    user: User


class AuthService:
    def __init__(self, user_repo: UserRepository, redis: aioredis.Redis):
        self.user_repo = user_repo
        self.redis = redis

    def _redis_session_key(self, user_id: UUID, jti: str) -> str:
        return f"session:{user_id}:{jti}"

    async def _issue_session(self, user: User) -> AuthResult:
        """Генерирует пару токенов и регистрирует сессию в Redis."""
        jti = str(uuid.uuid4())
        token_payload = {"sub": str(user.id), "jti": jti}

        access_token = security.create_access_token(token_payload)
        refresh_token = security.create_refresh_token(token_payload)

        # Сохраняем активный refresh-токен в Redis с его временем жизни
        await self.redis.set(
            self._redis_session_key(user.id, jti),
            "active",
            ex=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )

        return AuthResult(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user,
        )

    async def register(self, user_data: UserCreate) -> AuthResult:
        if await self.user_repo.get_by_email(user_data.email):
            raise UserAlreadyExistsError()

        user_dict = user_data.model_dump(exclude={"password", "github_url", "portfolio_url"})
        user = User(
            **user_dict,
            password_hash=security.get_password_hash(user_data.password),
            github_url=str(user_data.github_url) if user_data.github_url else None,
            portfolio_url=str(user_data.portfolio_url) if user_data.portfolio_url else None,
        )
        created_user = await self.user_repo.create(user)
        return await self._issue_session(created_user)

    async def authenticate(self, email: str, password: str) -> AuthResult:
        user = await self.user_repo.get_by_email(email)
        if not user or not security.verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        return await self._issue_session(user)

    async def refresh_session(self, refresh_token: str | None) -> AuthResult:
        """Валидирует refresh токен, проверяет Redis и производит ротацию токенов."""
        if not refresh_token:
            raise InvalidTokenError("Refresh-токен отсутствует")

        payload = decode_token(refresh_token, expected_type="refresh")
        if not payload or "sub" not in payload or "jti" not in payload:
            raise InvalidTokenError("Недействительный refresh-токен")

        user_id = UUID(payload["sub"])
        jti = payload["jti"]
        session_key = self._redis_session_key(user_id, jti)

        # Проверяем, существует ли активная сессия в Redis
        is_active = await self.redis.get(session_key)
        if not is_active:
            raise SessionExpiredError()

        # Ротация токена: удаляем старый jti
        await self.redis.delete(session_key)

        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise InvalidCredentialsError("Пользователь больше не существует")

        # Выпускаем новую пару токенов с новым jti
        return await self._issue_session(user)

    async def logout(self, refresh_token: str | None) -> None:
        """Отзывает сессию в Redis."""
        if not refresh_token:
            return

        payload = decode_token(refresh_token, expected_type="refresh")
        if payload and "sub" in payload and "jti" in payload:
            user_id = UUID(payload["sub"])
            jti = payload["jti"]
            await self.redis.delete(self._redis_session_key(user_id, jti))