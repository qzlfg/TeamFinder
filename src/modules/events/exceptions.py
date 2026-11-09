from fastapi import status

from src.core.exceptions import DomainException


class EventError(DomainException):
    """Базовое исключение для домена мероприятий."""
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Ошибка в модуле мероприятий"


class EventNotFoundError(EventError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Мероприятие не найдено"


class EventTitleAlreadyExistsError(EventError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Активное мероприятие с таким названием уже существует"


class EventInactiveError(EventError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Мероприятие неактивно или завершено"


class EventRegistrationDeadlinePassedError(EventError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Регистрация на мероприятие завершена (дедлайн прошёл)"


class InvalidTeamSizeLimitsError(EventError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    detail = "Минимальный размер команды не может быть больше максимального"


class EventForbiddenError(EventError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "У вас нет прав на редактирование этого мероприятия"


# Исключения для участников (EventParticipants)

class ParticipantAlreadyRegisteredError(EventError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Вы уже зарегистрированы в списке участников этого мероприятия"


class ParticipantAlreadyInTeamError(EventError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Нельзя войти в список одиночек: вы уже состоите в команде этого мероприятия"


class ParticipantNotFoundError(EventError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Запись участника мероприятия не найдена"