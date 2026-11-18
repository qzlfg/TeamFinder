from fastapi.params import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from modules.events.dependencies import get_event_repo
from modules.events.repository import EventRepository
from src.core.database import get_session

from .repository import TeamRepository
from .services import TeamService


async def get_team_repo(session: AsyncSession = Depends(get_session)) -> TeamRepository:
    return TeamRepository(session)

async def get_team_service(team_repo: TeamRepository = Depends(get_team_repo),
                           event_repo: EventRepository = Depends(get_event_repo)) -> TeamService:
    return TeamService(team_repo, event_repo)