from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from core.database import get_session
from modules.notifications.repository import NotificationRepository
from modules.notifications.services import NotificationService


def get_notification_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> NotificationService:
    return NotificationService(NotificationRepository(session))