from collections.abc import Sequence
from uuid import UUID

from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from common.enums import EventType, ParticipantStatus
from modules.events.models import Event, EventParticipant
from modules.users.models import User

from .schemas import EventUpdate


class EventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, event_id: UUID) -> Event | None:
        return await self.session.get(event_id, Event) # type: ignore

    async def get_events(self, event_types: list[EventType] | None, status: bool | None, skip: int, limit: int) -> Sequence[Event]:
        statement = select(Event)

        if event_types and len(event_types) > 1:
            statement = statement.where(col(Event.event_type).in_(event_types))
        else:
            statement = statement.where(Event.event_type == event_types)

        if status:
            statement = statement.where(Event.is_active == status)

        statement = statement.offset(skip).limit(limit)

        results = await self.session.exec(statement)

        return results.all()


    async def search_by_title(
        self,
        query: str,
        *,
        limit: int = 10,
        similarity_threshold: float = 0.2,
    ) -> Sequence[Event]:
        """Нечеткий поиск мероприятий по названию с ранжированием по релевантности.

        :param query: Поисковая фраза пользователя.
        :param limit: Максимальное количество подсказок в выдаче.
        :param similarity_threshold: Минимальный порог совпадения (0.2-0.3 оптимально для подсказок).
        """
        # Вычисляем коэффициент схожести по триграммам
        similarity_score = func.similarity(Event.title, query)

        statement = (
            select(Event)
            .where(
                # Отсекаем записи, у которых сходство ниже порога
                similarity_score >= similarity_threshold,
                # Ищем только среди активных событий
                Event.is_active == True,
            )
            # Сортируем: сначала самые релевантные совпадения
            .order_by(similarity_score.desc())
            .limit(limit)
        )

        result = await self.session.exec(statement)
        return result.all()

    async def get_active_by_title(self, title: str) -> Event | None:
        """Поиск активного мероприятия с таким же названием"""
        statement = select(Event).where(
            func.lower(Event.title) == title.lower().strip(),
            Event.is_active == True,
        )
        result = await self.session.exec(statement)
        return result.first()

    async def create(self, event: Event) -> Event:
        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)
        return event

    async def update(self, event: Event, update_data: EventUpdate) -> Event:
        for key, value in update_data.model_dump():
            setattr(event, key, value)

        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)

        return event

    async def get_participant_by_id(self, event_id: UUID, user_id: UUID) -> EventParticipant | None:
        statement = select(Event).where(Event.id == event_id, User.id == user_id)
        res = await self.session.exec(statement)
        return res.one_or_none()


    async def get_participants(self, event_id: UUID, skip: int, limit: int) -> Sequence[EventParticipant]:
        statement = select(Event).where(Event.id == event_id).offset(skip).limit(limit)
        res = await self.session.exec(statement)
        return res.all()

    async def add_participant(self, event_participant: EventParticipant) -> EventParticipant:
        self.session.add(event_participant)

        await self.session.commit()
        await self.session.refresh(event_participant)

        return event_participant

    async def remove_participant(self, event_participant: EventParticipant) -> None:
        await self.session.delete(event_participant)
        await self.session.commit()
        await self.session.refresh(event_participant)

    async def get_solo_participants(self, event_id: UUID, skip: int, limit: int) -> Sequence[EventParticipant]:
        statement = select(EventParticipant).where(Event.id == event_id, EventParticipant == ParticipantStatus.SEARCHING).offset(skip).limit(limit)
        res = await self.session.exec(statement)
        return res.all()