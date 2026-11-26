from sqlmodel import Field, SQLModel

from src.modules.users.schemas import NormalizedEmail, UserPrivateRead


class PasswordChangeRequest(SQLModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)

class LoginRequest(SQLModel):
    """Схема для входа через JSON (SPA / мобильные приложения)."""
    email: NormalizedEmail
    password: str


class TokenResponse(SQLModel):
    """Ответ со схемой токенов для Swagger UI и небраузерных клиентов."""
    access_token: str
    token_type: str = "bearer"
    user: UserPrivateRead


class EmailChangeRequest(SQLModel):
    new_email: NormalizedEmail
    current_password: str