from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import AnyHttpUrl, model_validator
from sqlmodel import Field, SQLModel

from src.common.enums import TeamStatus, VacancyStatus
from src.modules.users.schemas import SkillRead, UserPublicRead


class TeamCreate(SQLModel):
    event_id: UUID | None = Field(default=None)
    title: str = Field(min_length=1, max_length=255)
    project_description: str | None= Field(default=None, min_length=1)
    repository_url: AnyHttpUrl | None = Field(default=None, min_length=1, max_length=500)
    status: TeamStatus = Field(default=TeamStatus.RECRUITING)


class TeamUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    project_description: str | None= Field(default=None, min_length=1)
    repository_url: AnyHttpUrl | None = Field(default=None, min_length=1, max_length=500)
    status: TeamStatus | None = None

    @model_validator(mode="after")
    def validate_not_empty_and_non_nullable(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Необходимо передать хотя бы одно поле для обновления")

        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("Название команды не может быть пустым")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Статус команды не может быть пустым")

        return self


class TeamRead(SQLModel):
    id: UUID
    event_id: UUID | None
    leader_id: UUID
    title: str
    project_description: str | None
    repository_url: AnyHttpUrl | None
    status: TeamStatus
    created_at: datetime | None
    members_count: int = 0
    open_vacancies_count: int = 0


class TeamMemberCreate(SQLModel):
    """Схема для добавления участника в команду (лидером или через принятие заявки)."""
    role_name: str = Field(min_length=1, max_length=255)
    user_id: UUID


class TeamMemberUpdate(SQLModel):
    """Схема для изменения роли участника внутри команды."""
    role_name: str | None = Field(default=None, min_length=1, max_length=255)


class TeamMemberRead(SQLModel):
    """Базовая схема записи участника команды."""
    id: UUID
    team_id: UUID
    user_id: UUID
    role_name: str
    joined_at: datetime


class TeamMemberDetailRead(SQLModel):
    """Расширенная карточка участника с публичным профилем для отображения состава команды."""
    user: UserPublicRead
    role_name: str
    joined_at: datetime


class VacancyCreate(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=1000)
    required_role: str = Field(min_length=1, max_length=255)
    skills: list[VacancySkillInput] = []


class VacancyUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1, max_length=1000)
    required_role: str | None = Field(default=None, min_length=1, max_length=255)
    status: VacancyStatus | None = None
    skills: list[VacancySkillInput] | None = None

    @model_validator(mode="after")
    def validate_not_empty_and_non_nullable(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Необходимо передать хотя бы одно поле для обновления")

        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("Название вакансии не может быть пустым")
        if "description" in self.model_fields_set and self.description is None:
            raise ValueError("Описание вакансии не может быть пустым")
        if "required_role" in self.model_fields_set and self.required_role is None:
            raise ValueError("Требуемая роль не может быть пустой")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Статус вакансии не может быть пустым")
        if "skills" in self.model_fields_set and self.skills is None:
                    raise ValueError("Скиллы вакансии не может быть пустым")

        return self


class VacancyRead(SQLModel):
    id: UUID
    team_id: UUID
    title: str
    description: str
    required_role: str
    status: VacancyStatus
    created_at: datetime
    skills: list[VacancySkillInput]


class VacancySkillInput(SQLModel):
    skill_id: int
    is_required: bool = True

class VacancySkillRead(SQLModel):
    skill: SkillRead
    is_required: bool