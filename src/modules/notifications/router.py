from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse

from src.modules.auth.dependencies import get_current_user, get_current_user_id
from src.modules.notifications.dependencies import get_notification_service
from src.modules.notifications.schemas import NotificationRead, UnreadCountRead
from src.modules.notifications.services import NotificationService, sse_manager
from src.modules.users.models import User

router = APIRouter()

CurrentUser = Annotated[User, Depends(get_current_user)]
ServiceDep = Annotated[NotificationService, Depends(get_notification_service)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]


@router.get("/notifications/stream")
async def stream_notifications(
    request: Request,
    user_id: CurrentUserId,
):
    return StreamingResponse(
        sse_manager.event_stream(user_id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/notifications/unread-count",
    response_model=UnreadCountRead,
)
async def get_unread_count(
    user: CurrentUser,
    notification_service: ServiceDep,
):
    """Получить количество непрочитанных уведомлений текущего пользователя."""
    count = await notification_service.get_unread_count(user.id)
    return UnreadCountRead(unread_count=count)


@router.get(
    "/notifications",
    response_model=list[NotificationRead],
)
async def get_notifications(
    user: CurrentUser,
    notification_service: ServiceDep,
    unread_only: Annotated[bool, Query()] = False,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Получить историю уведомлений текущего пользователя (с пагинацией и фильтром непрочитанных)."""
    return await notification_service.get_my_notifications(
        user_id=user.id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )


@router.patch(
    "/notifications/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def mark_all_notifications_read(
    user: CurrentUser,
    notification_service: ServiceDep,
):
    """Пометить все уведомления текущего пользователя как прочитанные."""
    await notification_service.mark_all_as_read(user.id)


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationRead,
)
async def mark_notification_read(
    notification_id: UUID,
    user: CurrentUser,
    notification_service: ServiceDep,
):
    """Пометить конкретное уведомление как прочитанное."""
    return await notification_service.mark_as_read(
        notification_id=notification_id,
        user_id=user.id,
    )