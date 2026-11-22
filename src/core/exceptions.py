from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class DomainException(Exception):
    """Базовое исключение для всей бизнес-логики приложения."""
    status_code: int = status.HTTP_400_BAD_REQUEST
    detail: str = "Ошибка бизнес-логики"

    def __init__(self, detail: str | None = None):
        if detail:
            self.detail = detail
        super().__init__(self.detail)


class BadRequestException(DomainException):
    status_code = status.HTTP_400_BAD_REQUEST


class ForbiddenException(DomainException):
    status_code = status.HTTP_403_FORBIDDEN


class NotFoundException(DomainException):
    status_code = status.HTTP_404_NOT_FOUND


class ConflictException(DomainException):
    status_code = status.HTTP_409_CONFLICT


def setup_exception_handlers(app: FastAPI) -> None:
    """Глобальный перехватчик доменных исключений."""
    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )