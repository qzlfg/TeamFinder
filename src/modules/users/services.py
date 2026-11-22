from collections.abc import Sequence
from uuid import UUID

from src.common.enums import SkillCategory, UserRole
from src.modules.applications.repository import ApplicationRepository
from src.modules.teams.repository import TeamRepository
from src.modules.users.exceptions import (
    SkillAlreadyExistsError,
    SkillNotFoundError,
    UserNotFoundError,
    UserSkillAlreadyAddedError,
    UserSkillNotFoundError,
    UserTelegramAlreadyExistsError,
)
from src.modules.users.models import Skill, User
from src.modules.users.repository import UserRepository
from src.modules.users.schemas import (
    SkillCreate,
    UserProfileRead,
    UserPublicRead,
    UserUpdate,
)


class UserService:
    def __init__(
        self,
        user_repo: UserRepository,
        team_repo: TeamRepository,
        app_repo: ApplicationRepository,
    ):
        self.user_repo = user_repo
        self.team_repo = team_repo
        self.app_repo = app_repo

    async def _has_contact_access(self, target_user_id: UUID, current_user: User) -> bool:
        if current_user.id == target_user_id or current_user.role == UserRole.ADMIN:
            return True

        if await self.team_repo.are_teammates(current_user.id, target_user_id):
            return True

        return await self.app_repo.has_contact_unlocking_application(
            current_user.id, target_user_id
        )

    async def get_user_profile(
        self, target_user_id: UUID, current_user: User
    ) -> UserProfileRead:
        """Возвращает карточку участника с контекстным раскрытием контактов."""
        target_user = await self.user_repo.get_by_id(target_user_id)
        if not target_user:
            raise UserNotFoundError()

        can_view = await self._has_contact_access(target_user_id, current_user)
        public = UserPublicRead.model_validate(target_user)
        return UserProfileRead(
            **public.model_dump(),
            can_view_contacts=can_view,
            telegram_username=target_user.telegram_username if can_view else None,
            group_name=target_user.group_name if can_view else None,
        )

    async def search_users(
        self,
        *,
        skill_ids: list[int] | None,
        faculty: str | None,
        course: int | None,
        q: str | None,
        skip: int,
        limit: int,
    ) -> Sequence[User]:
        return await self.user_repo.get_users(
            skill_ids=skill_ids,
            faculty=faculty,
            course=course,
            q=q,
            skip=skip,
            limit=limit,
        )

    async def update_my_profile(
        self, current_user: User, update_data: UserUpdate
    ) -> User:
        if (
            update_data.telegram_username is not None
            and update_data.telegram_username.lower()
            != (current_user.telegram_username or "").lower()
        ):
            existing = await self.user_repo.get_by_telegram(
                update_data.telegram_username
            )
            if existing and existing.id != current_user.id:
                raise UserTelegramAlreadyExistsError()

        return await self.user_repo.update(current_user, update_data)

    # Управление справочником и навыками профиля

    async def get_all_skills(self, category: SkillCategory | None) -> Sequence[Skill]:
        return await self.user_repo.get_skills(category)

    async def create_skill(self, skill_in: SkillCreate) -> Skill:
        existing = await self.user_repo.get_skill_by_name(skill_in.name)
        if existing:
            raise SkillAlreadyExistsError()

        skill = Skill(name=skill_in.name.strip(), category=skill_in.category)
        return await self.user_repo.create_skill(skill)

    async def add_skill_to_me(self, current_user: User, skill_id: int) -> User:
        skill = await self.user_repo.get_skill_by_id(skill_id)
        if not skill:
            raise SkillNotFoundError()

        existing_link = await self.user_repo.get_user_skill(current_user.id, skill_id)
        if existing_link:
            raise UserSkillAlreadyAddedError()

        await self.user_repo.add_user_skill(current_user.id, skill_id)
        updated_user = await self.user_repo.get_by_id(
            current_user.id, populate_existing=True
        )
        if not updated_user:
            raise UserNotFoundError()
        return updated_user

    async def remove_skill_from_me(self, current_user: User, skill_id: int) -> None:
        link = await self.user_repo.get_user_skill(current_user.id, skill_id)
        if not link:
            raise UserSkillNotFoundError()

        await self.user_repo.remove_user_skill(link)