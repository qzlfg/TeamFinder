from typing import Annotated

from applications.repository import ApplicationRepository
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from core.database import get_session
from modules.teams.repository import TeamRepository
from modules.users.repository import UserRepository
from modules.users.services import UserService


def get_user_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserService:
    user_repo = UserRepository(session)
    team_repo = TeamRepository(session)
    app_repo = ApplicationRepository(session)
    return UserService(user_repo=user_repo, team_repo=team_repo, app_repo=app_repo)