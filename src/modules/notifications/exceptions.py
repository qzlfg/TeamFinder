from fastapi import status

from core.exceptions import DomainException


class NotificationError(DomainException):
    """Базовое исключение для модуля уведомлений."""

    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Ошибка в модуле уведомлений"


class NotificationNotFoundError(NotificationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Уведомление не найдено"


class NotificationForbiddenError(NotificationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "У вас нет доступа к этому уведомлению"