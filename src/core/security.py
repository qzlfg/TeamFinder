import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from src.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


def get_password_hash(password: str) -> str:
    """Превращает открытый пароль в хэш с солью."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Сверяет открытый пароль с захэшированным значением."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError, TypeError:
        return False


def _create_token(
    data: dict[str, Any],
    token_type: str,
    expires_delta: timedelta,
) -> str:
    """Внутренний генератор JWT с системными клеймами exp, iat, jti, type."""
    now = datetime.now(UTC)
    to_encode = data.copy()
    to_encode.update(
        {
            "type": token_type,
            "iat": now,
            "exp": now + expires_delta,
            "jti": str(uuid.uuid4()),
        }
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Генерирует короткоживущий Access-токен."""
    delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create_token(data=data, token_type="access", expires_delta=delta)


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Генерирует долгоживущий Refresh-токен."""
    delta = expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return _create_token(data=data, token_type="refresh", expires_delta=delta)


def decode_token(token: str, expected_type: str) -> dict[str, Any] | None:
    """Декодирует токен, проверяет подпись, срок действия и соответствие типа.

    Возвращает словарь полезной нагрузки (payload) или None, если токен невалиден.
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[ALGORITHM],
        )
        if payload.get("type") != expected_type:
            return None
        return payload
    except jwt.PyJWTError:
        return None
