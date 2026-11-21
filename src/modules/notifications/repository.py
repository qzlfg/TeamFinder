from collections.abc import Sequence
from uuid import UUID

from sqlmodel import col, func, select
from sqlmodel import update as sqlmodel_update
from sqlmodel.ext.asyncio.session import AsyncSession

from modules.notifications.models import Notification


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, notification_id: UUID) -> Notification | None:
        return await self.session.get(Notification, notification_id)

    async def get_user_notifications(
        self,
        user_id: UUID,
        *,
        unread_only: bool,
        skip: int,
        limit: int,
    ) -> Sequence[Notification]:
        statement = select(Notification).where(Notification.user_id == user_id)

        if unread_only:
            statement = statement.where(col(Notification.is_read).is_(False))

        statement = (
            statement.order_by(col(Notification.created_at).desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.exec(statement)
        return result.all()

    async def count_unread(self, user_id: UUID) -> int:
        statement = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                col(Notification.is_read).is_(False),
            )
        )
        result = await self.session.exec(statement)
        return result.one()

    async def create(self, notification: Notification) -> Notification:
        self.session.add(notification)
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def mark_as_read(self, notification: Notification) -> Notification:
        if not notification.is_read:
            notification.is_read = True
            self.session.add(notification)
            await self.session.commit()
            await self.session.refresh(notification)
        return notification

    async def mark_all_as_read(self, user_id: UUID) -> None:
        statement = (
            sqlmodel_update(Notification)
            .where(
                col(Notification.user_id) == user_id,
                col(Notification.is_read).is_(False),
            )
            .values(is_read=True)
        )
        await self.session.exec(statement)
        await self.session.commit()