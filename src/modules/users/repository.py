from collections.abc import Sequence
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.modules.users.models import User


class UserRepository:
    """
    Слой доступа к данным для сущности User.
    Изолирует написание SQL-запросов от остальной бизнес-логики приложения.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        """
        Ищет пользователя по ID.
        Возвращает объект User или None, если такого пользователя нет.
        """

        return await self.session.get(User, user_id) # type: ignore

    async def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        result = await self.session.exec(statement)
        return result.first()
    
    async def get_all_users(self, skip: int, limit: int) -> Sequence[User]:
        """
        Ищет всех пользователей в БД
        """
        statement = select(User).offset(skip).limit(limit)
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def create(self, user: User) -> User:
        """
        Создает нового пользователя в базе данных.
        """
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, db_user: User, update_data: dict) -> User:
        """
        Обновляет существующего пользователя.
        Принимает объект из БД и словарь с новыми данными.
        """
        for key, value in update_data.items():
            setattr(db_user, key, value)

        self.session.add(db_user)
        await self.session.flush()
        await self.session.refresh(db_user)

        return db_user