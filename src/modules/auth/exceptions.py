from fastapi import status

from src.core.exceptions import DomainException


class AuthError(DomainException):
    """Базовое исключение домена аутентификации."""
    status_code = status.HTTP_401_UNAUTHORIZED
    detail = "Ошибка аутентификации"


class InvalidCredentialsError(AuthError):
    detail = "Неверный email или пароль"


class UserAlreadyExistsError(AuthError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Пользователь с таким email уже зарегистрирован"


class InvalidTokenError(AuthError):
    detail = "Недействительный или просроченный токен"


class SessionExpiredError(AuthError):
    detail = "Сессия завершена или отозвана. Пожалуйста, войдите снова"