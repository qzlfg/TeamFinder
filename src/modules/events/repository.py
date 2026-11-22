from collections.abc import Sequence
from uuid import UUID

from sqlmodel import col, func, select
from sqlmodel import update as sqlmodel_update
from sqlmodel.ext.asyncio.session import AsyncSession

from src.common.enums import EventType, ParticipantStatus
from src.modules.events.models import Event, EventParticipant
from src.modules.events.schemas import EventUpdate


class EventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, event_id: UUID) -> Event | None:
        return await self.session.get(Event, event_id) # type: ignore

    async def get_events(self, event_types: list[EventType] | None, status: bool | None, skip: int, limit: int) -> Sequence[Event]:
        statement = select(Event)

        if event_types:
            statement = statement.where(col(Event.event_type).in_(event_types))

        if status is not None:
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
        patch_dict = update_data.model_dump(exclude_unset=True)
        for key, value in patch_dict.items():
            setattr(event, key, value)

        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)

        return event

    async def get_participant_by_id(self, event_id: UUID, user_id: UUID) -> EventParticipant | None:
        statement = select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.participant_id == user_id,
        )
        res = await self.session.exec(statement)
        return res.one_or_none()


    async def get_participants(self, event_id: UUID, status: ParticipantStatus | None, skip: int, limit: int) -> Sequence[EventParticipant]:
        statement = select(EventParticipant).where(EventParticipant.event_id == event_id).offset(skip).limit(limit)
        if status:
            statement = statement.where(EventParticipant.status == status)
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

    async def reset_participants_to_searching(
        self, event_id: UUID, user_ids: Sequence[UUID]
    ) -> None:
        """Возвращает участников расформированной команды в пул поиска."""
        if not user_ids:
            return

        statement = (
            sqlmodel_update(EventParticipant)
            .where(
                col(EventParticipant.event_id) == event_id,
                col(EventParticipant.participant_id).in_(user_ids),
            )
            .values(status=ParticipantStatus.SEARCHING)
        )
        await self.session.exec(statement)