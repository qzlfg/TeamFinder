from fastapi import APIRouter, Cookie, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from src.core.security import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from src.modules.auth.dependencies import get_auth_service
from src.modules.auth.schemas import LoginRequest, TokenResponse
from src.modules.auth.services import AuthResult, AuthService
from src.modules.users.schemas import UserCreate, UserPrivateRead

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_auth_cookies(response: Response, result: AuthResult) -> None:
    """Установка токенов в безопасные Cookie."""
    response.set_cookie(
        key="access_token",
        value=result.access_token,
        httponly=True,
        samesite="lax",
        secure=False,  # В проде переключить на True (HTTPS)
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=result.refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", samesite="lax")
    response.delete_cookie(key="refresh_token", samesite="lax")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Регистрация студента или куратора."""
    result = await auth_service.register(user_data)
    _set_auth_cookies(response, result)
    return TokenResponse(
        access_token=result.access_token,
        user=UserPrivateRead.model_validate(result.user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    response: Response,
    credentials: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Вход по JSON-телу (для фронтенда)."""
    result = await auth_service.authenticate(credentials.email, credentials.password)
    _set_auth_cookies(response, result)
    return TokenResponse(
        access_token=result.access_token,
        user=UserPrivateRead.model_validate(result.user),
    )


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
async def login_for_swagger(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Служебный эндпоинт form-data для кнопки 'Authorize' в Swagger UI."""
    result = await auth_service.authenticate(form_data.username, form_data.password)
    _set_auth_cookies(response, result)
    return TokenResponse(
        access_token=result.access_token,
        user=UserPrivateRead.model_validate(result.user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_session(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Ротация токенов по Refresh Cookie с проверкой в Redis."""
    result = await auth_service.refresh_session(refresh_token)
    _set_auth_cookies(response, result)
    return TokenResponse(
        access_token=result.access_token,
        user=UserPrivateRead.model_validate(result.user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Отзыв сессии в Redis и очистка Cookie."""
    await auth_service.logout(refresh_token)
    _clear_auth_cookies(response)