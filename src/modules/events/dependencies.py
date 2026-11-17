from fastapi import Depends

from core.database import get_session

from .repository import EventRepository
from .services import EventService


async def get_event_repo(session: Depends(get_session)) -> EventRepository:
    return EventRepository(session)

async def get_event_service(repo: Depends(get_event_repo)) -> EventService:
    return EventService(repo)