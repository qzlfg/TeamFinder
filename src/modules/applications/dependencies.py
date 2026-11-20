from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from core.database import get_session
from modules.applications.repository import ApplicationRepository
from modules.applications.services import ApplicationService
from modules.events.repository import EventRepository
from modules.teams.repository import TeamRepository
from modules.users.repository import UserRepository


def get_application_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationService:
    return ApplicationService(
        app_repo=ApplicationRepository(session),
        team_repo=TeamRepository(session),
        event_repo=EventRepository(session),
        user_repo=UserRepository(session),
    )