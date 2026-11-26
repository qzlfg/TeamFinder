import uuid
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

import redis.asyncio as aioredis

from src.core import security
from src.core.exceptions import BadRequestException, ConflictException
from src.core.security import REFRESH_TOKEN_EXPIRE_DAYS, decode_token, verify_password, get_password_hash
from src.modules.auth.exceptions import (
    InvalidCredentialsError,
    InvalidTokenError,
    SessionExpiredError,
    UserAlreadyExistsError,
)
from src.modules.auth.schemas import EmailChangeRequest, PasswordChangeRequest
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
        if (
            user_data.telegram_username
            and await self.user_repo.get_by_telegram(user_data.telegram_username)
        ):
            raise ConflictException(
                "Пользователь с таким Telegram username уже зарегистрирован"
            )

        user_dict = user_data.model_dump(exclude={"password", "github_url", "portfolio_url"})
        user = User(
            **user_dict,
            password_hash=get_password_hash(user_data.password),
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
        """Валидирует refresh-токен, проверяет Redis и производит ротацию токенов."""
        if not refresh_token:
            raise InvalidTokenError("Refresh-токен отсутствует")

        payload = decode_token(refresh_token, expected_type="refresh")
        if not payload or "sub" not in payload or "jti" not in payload:
            raise InvalidTokenError("Недействительный refresh-токен")

        try:
            user_id = UUID(payload["sub"])
        except ValueError:
            raise InvalidTokenError("Недействительный refresh-токен") from None

        jti = payload["jti"]
        session_key = self._redis_session_key(user_id, jti)

        is_active = await self.redis.get(session_key)
        if not is_active:
            raise SessionExpiredError()

        await self.redis.delete(session_key)

        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise InvalidCredentialsError("Пользователь больше не существует")

        return await self._issue_session(user)

    async def logout(self, refresh_token: str | None) -> None:
        """Отзывает сессию в Redis."""
        if not refresh_token:
            return

        payload = decode_token(refresh_token, expected_type="refresh")
        if payload and "sub" in payload and "jti" in payload:
            try:
                user_id = UUID(payload["sub"])
            except ValueError:
                return
            jti = payload["jti"]
            await self.redis.delete(self._redis_session_key(user_id, jti))

    async def change_email(
        self,
        user: User,
        data: EmailChangeRequest,
    ) -> AuthResult:
        if data.new_email.strip().lower() == user.email.lower():
            raise BadRequestException("Новый email совпадает с текущим")

        if not verify_password(data.current_password, user.password_hash):
            raise InvalidCredentialsError("Неверный текущий пароль")

        existing_user = await self.user_repo.get_by_email(data.new_email)
        if existing_user and existing_user.id != user.id:
            raise ConflictException("Этот email уже используется другим аккаунтом")

        user.email = data.new_email
        updated_user = await self.user_repo.save(user)

        session_keys = [
            key
            async for key in self.redis.scan_iter(match=f"session:{updated_user.id}:*")
        ]
        if session_keys:
            await self.redis.delete(*session_keys)

        return await self._issue_session(updated_user)


    async def change_password(
        self,
        user: User,
        data: PasswordChangeRequest
    ) -> AuthResult:
        if data.new_password == data.current_password:
            raise BadRequestException("Новый пароль совпадает с текущим")

        if not verify_password(data.current_password, user.password_hash):
                    raise InvalidCredentialsError("Неверный текущий пароль")

        user.password_hash = get_password_hash(data.new_password)
        updated_user = await self.user_repo.save(user)

        session_keys = [
            key
            async for key in self.redis.scan_iter(match=f"session:{updated_user.id}:*")
        ]
        if session_keys:
            await self.redis.delete(*session_keys)

        return await self._issue_session(updated_user)