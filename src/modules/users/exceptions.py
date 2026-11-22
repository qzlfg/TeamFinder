from fastapi import status

from src.core.exceptions import DomainException


class UserError(DomainException):
    """Базовое исключение для модуля пользователей."""

    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Ошибка в модуле пользователей"


class UserNotFoundError(UserError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Пользователь не найден"


class UserTelegramAlreadyExistsError(UserError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Этот Telegram-аккаунт уже привязан к другому профилю"


class SkillNotFoundError(UserError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Навык не найден в справочнике"


class SkillAlreadyExistsError(UserError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Навык с таким названием уже существует"


class UserSkillAlreadyAddedError(UserError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Этот навык уже добавлен в профиль пользователя"


class UserSkillNotFoundError(UserError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Указанный навык отсутствует в профиле пользователя"