from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_session
from src.modules.applications.repository import ApplicationRepository
from src.modules.applications.services import ApplicationService
from src.modules.events.repository import EventRepository
from src.modules.teams.repository import TeamRepository
from src.modules.users.repository import UserRepository


def get_application_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationService:
    return ApplicationService(
        app_repo=ApplicationRepository(session),
        team_repo=TeamRepository(session),
        event_repo=EventRepository(session),
        user_repo=UserRepository(session),
    )