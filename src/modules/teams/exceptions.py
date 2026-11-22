from fastapi import status

from src.core.exceptions import DomainException


class TeamError(DomainException):
    """Базовое исключение для домена команд."""
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Ошибка в модуле команд"


class TeamNotFoundError(TeamError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Команда не найдена"


class TeamTitleAlreadyTaken(TeamError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Команда с таким названием уже существует"


class TeamForbiddenError(TeamError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "У вас нет прав на управление этой командой"


class TeamFullError(TeamError):
    status_code = status.HTTP_409_CONFLICT
    detail = "В команде достигнут максимальный лимит участников"


class UserAlreadyInEventTeamError(TeamError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Вы уже состоите в другой команде в рамках этого мероприятия"


class InvalidLeadershipTransferError(TeamError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Невозможно передать права лидера указанному пользователю"



#TeamMember исключения
class TeamMemberNotFoundError(TeamError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Участник не найден в составе этой команды"


class TeamMemberAlreadyExistsError(TeamError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Пользователь уже состоит в этой команде"


class LeaderCannotLeaveTeamError(TeamError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Лидер не может покинуть команду, не передав права другому участнику"


class VacancyNotFoundError(TeamError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Вакансия не найдена"


class VacancyClosedError(TeamError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Вакансия уже закрыта"


class TeamNotRecruitingError(TeamError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Команда закрыла набор участников"