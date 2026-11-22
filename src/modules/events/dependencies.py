from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_session
from src.modules.events.repository import EventRepository
from src.modules.events.services import EventService


def get_event_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EventService:
    return EventService(EventRepository(session))