from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class NotificationRead(SQLModel):
    """Схема уведомления для REST API и SSE-потока."""

    id: UUID
    user_id: UUID
    title: str
    message: str
    action_url: str | None
    is_read: bool
    created_at: datetime


class UnreadCountRead(SQLModel):
    """Количество непрочитанных уведомлений для бейджа в шапке сайта."""

    unread_count: int