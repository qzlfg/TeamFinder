from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, EmailStr, HttpUrl
from sqlmodel import Field, SQLModel

from common.enums import UserRole


def _lowercase_email(v: str) -> str:
    return v.lower()

NormalizedEmail = Annotated[EmailStr, AfterValidator(_lowercase_email)]


class UserBase(SQLModel):
    """Базовые поля пользователя, общие для чтения и записи."""

    email: NormalizedEmail
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    course: int | None = Field(default=None, ge=1, le=7)
    bio: str | None = Field(default=None, max_length=1000)
    faculty: str | None = None
    group_name: str | None = None
    github_url: HttpUrl | None = None
    portfolio_url: HttpUrl | None = None


class UserCreate(UserBase):
    """Схема регистрации пользователя."""

    password: str = Field(min_length=8, max_length=128)
    role: UserRole = Field(default=UserRole.MEMBER)
    telegram_username: str | None = Field(default=None, min_length=5, max_length=32, regex=r"^[a-zA-Z0-9_]+$")


class UserUpdate(SQLModel):
    """Схема частичного обновления профиля (все поля опциональны)."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    faculty: str | None = None
    course: int | None = Field(default=None, ge=1, le=7)
    group_name: str | None = None
    bio: str | None = None
    github_url: HttpUrl | None = None
    portfolio_url: HttpUrl | None = None
    telegram_username: str | None = Field(default=None, min_length=5, max_length=32, regex=r"^[a-zA-Z0-9_]+$")


class UserPublicRead(SQLModel):
    """Публичная карточка пользователя для витрины поиска команд и соло-участников.

    telegram_username намеренно исключен для защиты от спама.
    """

    id: UUID
    first_name: str
    last_name: str
    faculty: str | None
    course: int | None
    bio: str | None
    github_url: str | None
    portfolio_url: str | None
    role: UserRole


class UserContactRead(UserPublicRead):
    """Детальная карточка участника заявки или члена команды (с контактами)."""

    telegram_username: str | None
    group_name: str | None


class UserPrivateRead(UserContactRead):
    """Схема для личного кабинета (GET /users/me)."""

    email: NormalizedEmail
    created_at: datetime