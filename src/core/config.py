from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения, загружаемые из переменных окружения и файла .env."""

    # База данных и брокер сообщений
    database_url: str
    redis_url: str = "redis://localhost:6379/0"

    # JWT-аутентификация (Access + Refresh)
    secret_key: str = "change_me_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Настройки HttpOnly Cookie
    cookie_secure: bool = False  # В продакшне с HTTPS переключить на True
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8001",
        "http://localhost:8002",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()  # type: ignore