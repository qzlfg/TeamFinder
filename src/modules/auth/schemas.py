from sqlmodel import SQLModel

from src.modules.users.schemas import NormalizedEmail, UserPrivateRead


class LoginRequest(SQLModel):
    """Схема для входа через JSON (SPA / мобильные приложения)."""
    email: NormalizedEmail
    password: str


class TokenResponse(SQLModel):
    """Ответ со схемой токенов для Swagger UI и небраузерных клиентов."""
    access_token: str
    token_type: str = "bearer"
    user: UserPrivateRead