from typing import Annotated

from fastapi.params import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.database import get_session
from src.modules.events.repository import EventRepository
from src.modules.teams.repository import TeamRepository
from src.modules.teams.services import TeamService


async def get_team_service(session: Annotated[AsyncSession, Depends(get_session)]) -> TeamService:
    return TeamService(TeamRepository(session), EventRepository(session))