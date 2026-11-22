from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from src.common.enums import SkillCategory, UserRole
from src.modules.auth.dependencies import get_current_user, require_role
from src.modules.users.dependencies import get_user_service
from src.modules.users.models import User
from src.modules.users.schemas import (
    SkillCreate,
    SkillRead,
    UserContactRead,
    UserPrivateRead,
    UserPublicRead,
    UserUpdate,
)
from src.modules.users.services import UserService

router = APIRouter()

CurrentUser = Annotated[User, Depends(get_current_user)]
ServiceDep = Annotated[UserService, Depends(get_user_service)]


# =====================================================================
# 1. ЛИЧНЫЙ КАБИНЕТ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ (/users/me)
# =====================================================================


@router.get("/users/me", response_model=UserPrivateRead)
async def get_my_profile(
    user: CurrentUser,
    user_service: ServiceDep,
):
    """Получить полный профиль текущего авторизованного пользователя (с email, Telegram и навыками)."""
    return await user_service.get_my_profile(user.id)


@router.patch("/users/me", response_model=UserPrivateRead)
async def update_my_profile(
    update_data: UserUpdate,
    user: CurrentUser,
    user_service: ServiceDep,
):
    """Частично обновить анкету текущего пользователя."""
    return await user_service.update_my_profile(user, update_data)


@router.post(
    "/users/me/skills/{skill_id}",
    response_model=UserPrivateRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_my_skill(
    skill_id: int,
    user: CurrentUser,
    user_service: ServiceDep,
):
    """Прикрепить навык из справочника к профилю текущего пользователя."""
    return await user_service.add_skill_to_me(user, skill_id)


@router.delete(
    "/users/me/skills/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_my_skill(
    skill_id: int,
    user: CurrentUser,
    user_service: ServiceDep,
):
    """Удалить навык из профиля текущего пользователя."""
    await user_service.remove_skill_from_me(user, skill_id)


# =====================================================================
# 2. ВИТРИНА И ПУБЛИЧНЫЕ / КОНТАКТНЫЕ КАРТОЧКИ ПОЛЬЗОВАТЕЛЕЙ
# =====================================================================


@router.get(
    "/users",
    response_model=list[UserPublicRead],
    dependencies=[Depends(get_current_user)],
)
async def search_users(
    user_service: ServiceDep,
    skill_id: Annotated[list[int] | None, Query()] = None,
    faculty: Annotated[str | None, Query(min_length=1, max_length=255)] = None,
    course: Annotated[int | None, Query(ge=1, le=7)] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """
    Витрина поиска студентов по навыкам, факультету, курсу или имени.

    - **Приватность:** поле `telegram_username` скрыто.
    """
    return await user_service.search_users(
        skill_ids=skill_id,
        faculty=faculty,
        course=course,
        q=q,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/users/{user_id}",
    response_model=UserPublicRead,
    dependencies=[Depends(get_current_user)],
)
async def get_user_public_profile(
    user_id: UUID,
    user_service: ServiceDep,
):
    """Получить публичную карточку пользователя (без Telegram-контакта)."""
    return await user_service.get_public_profile(user_id)


@router.get(
    "/users/{user_id}/contacts",
    response_model=UserContactRead,
)
async def get_user_contacts(
    user_id: UUID,
    user: CurrentUser,
    user_service: ServiceDep,
):
    """
    Получить расширенную карточку пользователя с `telegram_username` и учебной группой.

    - **Ограничения:** доступно только сокомандникам, при наличии активной заявки между
      пользователями (`pending`, `in_discussion`, `accepted`), самому владельцу или администратору.
    """
    return await user_service.get_contact_profile(
        target_user_id=user_id,
        current_user=user,
    )


# =====================================================================
# 3. СПРАВОЧНИК НАВЫКОВ (/skills)
# =====================================================================


@router.get(
    "/skills",
    response_model=list[SkillRead],
    dependencies=[Depends(get_current_user)],
)
async def get_skills(
    user_service: ServiceDep,
    category: Annotated[SkillCategory | None, Query()] = None,
):
    """Получить список доступных навыков из справочника (с опциональным фильтром по категории)."""
    return await user_service.get_all_skills(category)


@router.post(
    "/skills",
    response_model=SkillRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.MENTOR))],
)
async def create_skill(
    skill_in: SkillCreate,
    user_service: ServiceDep,
):
    """Добавить новый навык в справочник (доступно только администратору или ментору)."""
    return await user_service.create_skill(skill_in)