from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import col, func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.common.enums import SkillCategory
from src.core.exceptions import ConflictException
from src.modules.users.exceptions import (
    SkillAlreadyExistsError,
    UserSkillAlreadyAddedError,
    UserTelegramAlreadyExistsError,
)
from src.modules.users.models import Skill, User, UserSkill
from src.modules.users.schemas import UserUpdate


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: UUID, *, populate_existing: bool = False) -> User | None:
        statement = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.skills))  # type: ignore[arg-type]
        )
        if populate_existing:
            statement = statement.execution_options(populate_existing=True)
        result = await self.session.exec(statement)
        return result.first()

    async def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(func.lower(User.email) == email.lower())
        result = await self.session.exec(statement)
        return result.first()

    async def get_by_telegram(self, telegram_username: str) -> User | None:
        statement = select(User).where(
            func.lower(User.telegram_username) == telegram_username.lower()
        )
        result = await self.session.exec(statement)
        return result.first()

    async def get_users(
        self,
        *,
        skill_ids: list[int] | None,
        faculty: str | None,
        course: int | None,
        q: str | None,
        skip: int,
        limit: int,
    ) -> Sequence[User]:
        """Витрина студентов с фильтрацией по стеку навыков, факультету, курсу и имени."""
        statement = select(User).options(selectinload(User.skills))  # type: ignore[arg-type]

        if skill_ids:
            statement = (
                statement.join(UserSkill, UserSkill.user_id == User.id)
                .where(col(UserSkill.skill_id).in_(skill_ids))
                .distinct()
            )

        if faculty is not None:
            statement = statement.where(col(User.faculty).ilike(f"%{faculty.strip()}%"))

        if course is not None:
            statement = statement.where(User.course == course)

        if q is not None:
            pattern = f"%{q.strip()}%"
            statement = statement.where(
                or_(
                    col(User.first_name).ilike(pattern),
                    col(User.last_name).ilike(pattern),
                    func.concat(User.first_name, " ", User.last_name).ilike(pattern),
                    func.concat(User.last_name, " ", User.first_name).ilike(pattern),
                )
            )

        statement = statement.order_by(col(User.created_at).desc()).offset(skip).limit(limit)
        result = await self.session.exec(statement)
        return result.all()

    async def create(self, user: User) -> User:
        self.session.add(user)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictException(
                "Пользователь с таким email или Telegram username уже существует"
            ) from exc
        await self.session.refresh(user)
        return user

    async def save(self, user: User) -> User:
        """Сохраняет изменённые поля профиля (например, email) без DTO-патча."""
        self.session.add(user)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictException(
                "Пользователь с таким email или Telegram username уже существует"
            ) from exc

        return await self.get_by_id(user.id) or user

    async def update(self, user: User, update_data: UserUpdate) -> User:
        patch_dict = update_data.model_dump(exclude_unset=True)

        for url_field in ("github_url", "portfolio_url"):
            if url_field in patch_dict and patch_dict[url_field] is not None:
                patch_dict[url_field] = str(patch_dict[url_field])

        for key, value in patch_dict.items():
            setattr(user, key, value)

        self.session.add(user)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise UserTelegramAlreadyExistsError() from exc
        return user

    # skills

    async def get_skills(self, category: SkillCategory | None) -> Sequence[Skill]:
        statement = select(Skill)
        if category is not None:
            statement = statement.where(Skill.category == category)
        statement = statement.order_by(col(Skill.name).asc())
        result = await self.session.exec(statement)
        return result.all()

    async def get_skill_by_id(self, skill_id: int) -> Skill | None:
        return await self.session.get(Skill, skill_id)

    async def get_skill_by_name(self, name: str) -> Skill | None:
        statement = select(Skill).where(func.lower(Skill.name) == name.strip().lower())
        result = await self.session.exec(statement)
        return result.first()

    async def create_skill(self, skill: Skill) -> Skill:
        self.session.add(skill)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise SkillAlreadyExistsError() from exc
        await self.session.refresh(skill)
        return skill

    async def get_user_skill(self, user_id: UUID, skill_id: int) -> UserSkill | None:
        statement = select(UserSkill).where(
            UserSkill.user_id == user_id,
            UserSkill.skill_id == skill_id,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def add_user_skill(self, user_id: UUID, skill_id: int) -> None:
        link = UserSkill(user_id=user_id, skill_id=skill_id)
        self.session.add(link)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise UserSkillAlreadyAddedError() from exc

    async def remove_user_skill(self, link: UserSkill) -> None:
        await self.session.delete(link)
        await self.session.commit()