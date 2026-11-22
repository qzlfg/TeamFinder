from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BeforeValidator,
    EmailStr,
    HttpUrl,
    StringConstraints,
    UrlConstraints,
    model_validator,
)
from sqlmodel import Field, SQLModel

from src.common.enums import SkillCategory, UserRole


def _lowercase_email(v: str) -> str:
    if isinstance(v, str):
        return v.strip().lower()
    return v


def _normalize_telegram(v: str | None) -> str | None:
    if isinstance(v, str):
        return v.strip().lstrip("@").lower()
    return v


NormalizedEmail = Annotated[EmailStr, BeforeValidator(_lowercase_email)]
SafeHttpUrl = Annotated[HttpUrl, UrlConstraints(max_length=500)]
TelegramUsername = Annotated[
    str,
    BeforeValidator(_normalize_telegram),
    StringConstraints(min_length=5, max_length=32, pattern=r"^[a-zA-Z0-9_]+$"),
]


# --- Схемы навыков ---


class SkillCreate(SQLModel):
    name: str = Field(min_length=1, max_length=100)
    category: SkillCategory


class SkillRead(SQLModel):
    id: int
    name: str
    category: SkillCategory


# --- Схемы пользователей ---


class UserBase(SQLModel):
    email: NormalizedEmail
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    course: int | None = Field(default=None, ge=1, le=7)
    bio: str | None = Field(default=None, max_length=1000)
    faculty: str | None = Field(default=None, max_length=255)
    group_name: str | None = Field(default=None, max_length=50)
    github_url: SafeHttpUrl | None = None
    portfolio_url: SafeHttpUrl | None = None


class UserCreate(UserBase):
    """Схема регистрации пользователя (роль всегда задаётся на бэкенде)."""

    password: str = Field(min_length=8, max_length=72)
    telegram_username: TelegramUsername | None = None


class UserUpdate(SQLModel):
    """Схема частичного обновления профиля."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    faculty: str | None = Field(default=None, max_length=255)
    course: int | None = Field(default=None, ge=1, le=7)
    group_name: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, max_length=1000)
    github_url: SafeHttpUrl | None = None
    portfolio_url: SafeHttpUrl | None = None
    telegram_username: TelegramUsername | None = None

    @model_validator(mode="after")
    def validate_not_empty_and_non_nullable(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Необходимо передать хотя бы одно поле для обновления")

        if "first_name" in self.model_fields_set and self.first_name is None:
            raise ValueError("Имя не может быть пустым")
        if "last_name" in self.model_fields_set and self.last_name is None:
            raise ValueError("Фамилия не может быть пустой")

        return self


class UserPublicRead(SQLModel):
    """Публичная карточка студента для витрины (без telegram_username)."""

    id: UUID
    first_name: str
    last_name: str
    faculty: str | None
    course: int | None
    bio: str | None
    github_url: str | None
    portfolio_url: str | None
    role: UserRole
    skills: list[SkillRead] = Field(default_factory=list)


class UserProfileRead(UserPublicRead):
    """Карточка участника (контакты заполнены только если can_view_contacts == True)."""

    can_view_contacts: bool
    telegram_username: str | None = None
    group_name: str | None = None


class UserPrivateRead(UserPublicRead):
    """Полная схема профиля для личного кабинета (GET /users/me)."""

    telegram_username: str | None
    group_name: str | None
    email: NormalizedEmail
    created_at: datetime