from fastapi import status

from core.exceptions import DomainException


class ApplicationError(DomainException):
    """Базовое исключение для модуля заявок."""

    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Ошибка в модуле заявок"


class ApplicationNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Заявка не найдена"


class ApplicationAlreadyExistsError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Активная заявка или приглашение на эту вакансию уже существует"


class ApplicationForbiddenError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "У вас нет прав на это действие с заявкой"


class InvalidApplicationTransitionError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Недопустимый переход статуса заявки"


class CannotApplyToOwnTeamError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Нельзя отправить отклик в команду, в которой вы уже состоите"