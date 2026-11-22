"""Наполняет базу TeamFinder реалистичными тестовыми данными.

Запуск из корня репозитория:

    .venv/Scripts/python.exe scripts/seed_test_data.py
    .venv/Scripts/python.exe scripts/seed_test_data.py --reset

Скрипт идемпотентен: повторный запуск досоздаёт только недостающие записи.
Флаг --reset удаляет ранее созданные сидом команды, мероприятия и
пользователей (по известным email/названиям), затем создаёт их заново.
Справочник навыков не удаляется: он общий, к нему привязаны профили.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import delete
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.common.enums import (
    ApplicationDirection,
    ApplicationStatus,
    EventType,
    ParticipantStatus,
    SkillCategory,
    TeamStatus,
    UserRole,
    VacancyStatus,
)
from src.core.database import async_session_maker
from src.core.security import get_password_hash
from src.modules.applications.models import Application
from src.modules.events.models import Event, EventParticipant
from src.modules.notifications.models import Notification
from src.modules.teams.models import Team, TeamMember, Vacancy
from src.modules.users.models import Skill, User, UserSkill

PASSWORD = "password123"

SKILLS: list[tuple[str, SkillCategory]] = [
    ("React", SkillCategory.FRONTEND),
    ("TypeScript", SkillCategory.FRONTEND),
    ("Vue", SkillCategory.FRONTEND),
    ("Python", SkillCategory.BACKEND),
    ("FastAPI", SkillCategory.BACKEND),
    ("Go", SkillCategory.BACKEND),
    ("PostgreSQL", SkillCategory.BACKEND),
    ("Node.js", SkillCategory.BACKEND),
    ("Figma", SkillCategory.DESIGN),
    ("UI/UX", SkillCategory.DESIGN),
    ("Motion Design", SkillCategory.DESIGN),
    ("SQL", SkillCategory.ANALYTICS),
    ("Pandas", SkillCategory.ANALYTICS),
    ("Product Analytics", SkillCategory.ANALYTICS),
    ("Manual QA", SkillCategory.QA),
    ("Playwright", SkillCategory.QA),
    ("Pytest", SkillCategory.QA),
]

USERS: list[dict] = [
    {
        "key": "admin",
        "email": "admin.seed@example.com",
        "first_name": "Анна",
        "last_name": "Смирнова",
        "role": UserRole.ADMIN,
        "bio": "Куратор платформы TeamFinder: слежу за порядком в справочниках и мероприятиях.",
        "telegram": "anna_admin",
        "skills": ["Product Analytics", "SQL"],
    },
    {
        "key": "mentor",
        "email": "mentor@example.com",
        "first_name": "Дмитрий",
        "last_name": "Ковалёв",
        "role": UserRole.MENTOR,
        "faculty": "ИУ7",
        "bio": "Ментор по backend, 6 лет в продуктовой разработке. Помогаю с архитектурой и FastAPI.",
        "telegram": "dmitry_mentor",
        "github": "https://github.com/dmitry-mentor",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
    },
    {
        "key": "agent",
        "email": "agent@example.com",
        "first_name": "Ольга",
        "last_name": "Петрова",
        "role": UserRole.AGENT,
        "bio": "Организатор хакатонов и партнёрских программ. Пишите по вопросам мероприятий.",
        "telegram": "olga_events",
        "skills": ["Product Analytics"],
    },
    {
        "key": "max",
        "email": "max@example.com",
        "first_name": "Максим",
        "last_name": "Иванов",
        "faculty": "ИУ7",
        "course": 3,
        "group_name": "ИУ7-33Б",
        "bio": "Backend-разработчик на Python/FastAPI. Люблю чистые API и продуманные схемы БД.",
        "telegram": "max_ivanov",
        "github": "https://github.com/max-ivanov",
        "portfolio": "https://maxivanov.dev",
        "skills": ["Python", "FastAPI", "PostgreSQL"],
    },
    {
        "key": "kate",
        "email": "kate@example.com",
        "first_name": "Екатерина",
        "last_name": "Соколова",
        "faculty": "ПИ",
        "course": 2,
        "group_name": "ПИ-21",
        "bio": "Frontend на React и TypeScript, собираю интерфейсы в стиле Linear.",
        "telegram": "kate_sokolova",
        "github": "https://github.com/kate-sokolova",
        "skills": ["React", "TypeScript", "UI/UX"],
    },
    {
        "key": "ivan",
        "email": "ivan@example.com",
        "first_name": "Иван",
        "last_name": "Кузнецов",
        "faculty": "ИУ7",
        "course": 4,
        "group_name": "ИУ7-43Б",
        "bio": "Go и PostgreSQL, люблю высоконагруженные сервисы. Играю в CTF.",
        "telegram": "ivan_kuznetsov",
        "github": "https://github.com/ivan-kuznetsov",
        "skills": ["Go", "PostgreSQL", "Python"],
    },
    {
        "key": "elena",
        "email": "elena@example.com",
        "first_name": "Елена",
        "last_name": "Морозова",
        "faculty": "Дизайн",
        "course": 3,
        "group_name": "ДИ-31",
        "bio": "Product designer: исследования, прототипы в Figma, дизайн-системы.",
        "telegram": "elena_design",
        "portfolio": "https://elenamorozova.design",
        "skills": ["Figma", "UI/UX"],
    },
    {
        "key": "artem",
        "email": "artem@example.com",
        "first_name": "Артём",
        "last_name": "Волков",
        "faculty": "ФН",
        "course": 2,
        "group_name": "ФН-21",
        "bio": "Аналитик: SQL, Python, продуктовые метрики. Строю дашборды и ищу инсайты.",
        "telegram": "artem_volkov",
        "github": "https://github.com/artem-volkov",
        "skills": ["SQL", "Pandas", "Product Analytics"],
    },
    {
        "key": "sofia",
        "email": "sofia@example.com",
        "first_name": "София",
        "last_name": "Лебедева",
        "faculty": "ИУ7",
        "course": 1,
        "group_name": "ИУ7-13Б",
        "bio": "QA-инженер: ручное тестирование и автотесты на Playwright.",
        "telegram": "sofia_qa",
        "skills": ["Manual QA", "Playwright"],
    },
    {
        "key": "nikita",
        "email": "nikita@example.com",
        "first_name": "Никита",
        "last_name": "Орлов",
        "faculty": "ПИ",
        "course": 3,
        "group_name": "ПИ-31",
        "bio": "Frontend + дизайн. Делаю пет-проекты и помогаю с UI-китами.",
        "telegram": "nikita_orlov",
        "github": "https://github.com/nikita-orlov",
        "skills": ["React", "Figma", "TypeScript"],
    },
    {
        "key": "daria",
        "email": "daria@example.com",
        "first_name": "Дарья",
        "last_name": "Новикова",
        "faculty": "ИУ7",
        "course": 4,
        "group_name": "ИУ7-44Б",
        "bio": "Backend Python/FastAPI, интересуюсь AI-продуктами и стартапами.",
        "telegram": "daria_novikova",
        "skills": ["Python", "FastAPI", "SQL"],
    },
    {
        "key": "pavel",
        "email": "pavel@example.com",
        "first_name": "Павел",
        "last_name": "Зайцев",
        "faculty": "ФН",
        "course": 1,
        "group_name": "ФН-11",
        "bio": "Первые шаги в анализе данных: Pandas, SQL, немного QA.",
        "telegram": "pavel_zaytsev",
        "skills": ["Pandas", "Manual QA", "SQL"],
    },
    {
        "key": "vlada",
        "email": "vlada@example.com",
        "first_name": "Влада",
        "last_name": "Киселёва",
        "faculty": "Дизайн",
        "course": 2,
        "group_name": "ДИ-21",
        "bio": "Motion-дизайнер и UI-дизайнер. Помогаю командам с презентациями.",
        "telegram": "vlada_kiseleva",
        "portfolio": "https://vladakiseleva.design",
        "skills": ["Figma", "Motion Design"],
    },
]

EVENTS: list[dict] = [
    {
        "key": "hackathon_2026",
        "title": "Хакатон TeamFinder 2026",
        "description": "48 часов на прототип сервиса для студенческих команд: треки Web, AI и EdTech.",
        "event_type": EventType.HACKATHON,
        "min_team_size": 2,
        "max_team_size": 5,
        "deadline_days": 14,
        "creator": "mentor",
        "is_active": True,
    },
    {
        "key": "academic",
        "title": "Проектная деятельность: продуктовый анализ",
        "description": "Курсовой проект по продуктовой аналитике: метрики, A/B-тесты, дашборды.",
        "event_type": EventType.ACADEMIC_COURSE,
        "min_team_size": 2,
        "max_team_size": 4,
        "deadline_days": 7,
        "creator": "mentor",
        "is_active": True,
    },
    {
        "key": "ctf_jam",
        "title": "CTF Jam: Winter Edition",
        "description": "Двухдневный CTF для студенческих команд: web, pwn, reverse, crypto.",
        "event_type": EventType.CTF_JAM,
        "min_team_size": 3,
        "max_team_size": 5,
        "deadline_days": 21,
        "creator": "agent",
        "is_active": True,
    },
    {
        "key": "startup_grant",
        "title": "Startup Grant 2026",
        "description": "Акселератор студенческих стартапов: грант на прототип и менторская поддержка.",
        "event_type": EventType.STARTUP_GRANT,
        "min_team_size": 2,
        "max_team_size": 6,
        "deadline_days": 30,
        "creator": "admin",
        "is_active": True,
    },
    {
        "key": "diploma",
        "title": "Дипломный проект: AI-ассистент",
        "description": "Междисциплинарный диплом: RAG-ассистент для студенческих сервисов.",
        "event_type": EventType.DIPLOMA,
        "min_team_size": 1,
        "max_team_size": 3,
        "deadline_days": 60,
        "creator": "mentor",
        "is_active": True,
    },
    {
        "key": "pet_projects",
        "title": "Пет-проекты: весна 2026",
        "description": "Бессрочная витрина open-source и пет-проектов без дедлайнов.",
        "event_type": EventType.PET_PROJECT,
        "min_team_size": 1,
        "max_team_size": 5,
        "deadline_days": None,
        "creator": "agent",
        "is_active": True,
    },
    {
        "key": "hackathon_2025",
        "title": "Хакатон TeamFinder 2025",
        "description": "Прошлогодний хакатон: архив с результатами и проектами победителей.",
        "event_type": EventType.HACKATHON,
        "min_team_size": 2,
        "max_team_size": 5,
        "deadline_days": -30,
        "creator": "mentor",
        "is_active": False,
    },
]

TEAMS: list[dict] = [
    {
        "key": "neural_ninjas",
        "title": "Neural Ninjas",
        "event": "hackathon_2026",
        "leader": "max",
        "status": TeamStatus.RECRUITING,
        "description": "ML-сервис для подбора команды по навыкам: эмбеддинги профилей + рекомендации.",
        "repo": "https://github.com/teamfinder/neural-ninjas",
        "members": [
            ("max", "Team Lead"),
            ("kate", "Frontend-разработчик"),
            ("ivan", "Backend-разработчик"),
        ],
        "vacancies": [
            {
                "title": "ML-инженер",
                "role": "Python / ML",
                "description": "Собрать пайплайн эмбеддингов и ранжирование кандидатов. Опыт с sklearn приветствуется.",
                "status": VacancyStatus.OPEN,
            }
        ],
    },
    {
        "key": "data_owls",
        "title": "Data Owls",
        "event": "hackathon_2026",
        "leader": "artem",
        "status": TeamStatus.FORMED,
        "description": "Аналитический сервис для оценки загрузки студентов по расписанию.",
        "repo": "https://github.com/teamfinder/data-owls",
        "members": [
            ("artem", "Team Lead"),
            ("pavel", "Data Analyst"),
            ("daria", "Backend-разработчик"),
        ],
        "vacancies": [
            {
                "title": "Backend-разработчик",
                "role": "Python / FastAPI",
                "description": "API для агрегации расписания и расчёта загрузки.",
                "status": VacancyStatus.CLOSED,
            }
        ],
    },
    {
        "key": "deadbeef",
        "title": "0xDEADBEEF",
        "event": "ctf_jam",
        "leader": "ivan",
        "status": TeamStatus.RECRUITING,
        "description": "CTF-команда: web-эксплуатация, reverse engineering и криптография.",
        "repo": None,
        "members": [
            ("ivan", "Team Lead"),
            ("daria", "Web / Crypto"),
        ],
        "vacancies": [
            {
                "title": "Reverse Engineer",
                "role": "Reverse / Pwn",
                "description": "Разбор бинарей и pwn-задач. Нужен опыт с gdb и pwntools.",
                "status": VacancyStatus.OPEN,
            }
        ],
    },
    {
        "key": "greenloop",
        "title": "GreenLoop",
        "event": "startup_grant",
        "leader": "daria",
        "status": TeamStatus.RECRUITING,
        "description": "Сервис возврата упаковки в пункты приёма: карта, QR-коды, баллы за сдачу.",
        "repo": "https://github.com/teamfinder/greenloop",
        "members": [
            ("daria", "CEO / Backend"),
            ("elena", "Product Designer"),
        ],
        "vacancies": [
            {
                "title": "Backend-разработчик",
                "role": "Python / FastAPI",
                "description": "Разработать API баллов и интеграцию с картой пунктов приёма.",
                "status": VacancyStatus.OPEN,
            }
        ],
    },
    {
        "key": "ai_assistant",
        "title": "AI Assistant",
        "event": "diploma",
        "leader": "pavel",
        "status": TeamStatus.RECRUITING,
        "description": "RAG-ассистент по учебным материалам: поиск по конспектам и генерация ответов.",
        "repo": None,
        "members": [("pavel", "Team Lead")],
        "vacancies": [
            {
                "title": "Python-разработчик",
                "role": "Python / RAG",
                "description": "Пайплайн индексации и ответов, интеграция с LLM API.",
                "status": VacancyStatus.OPEN,
            }
        ],
    },
    {
        "key": "teamfinder_frontend",
        "title": "TeamFinder Frontend",
        "event": None,
        "leader": "kate",
        "status": TeamStatus.RECRUITING,
        "description": "Пет-проект: SPA для TeamFinder на React 19, TanStack Router и Tailwind v4.",
        "repo": "https://github.com/teamfinder/frontend",
        "members": [
            ("kate", "Team Lead / Frontend"),
            ("nikita", "Frontend-разработчик"),
        ],
        "vacancies": [
            {
                "title": "Frontend-разработчик",
                "role": "React / TypeScript",
                "description": "Развивать дизайн-систему и экраны заявок. Нужен опыт с TanStack Query.",
                "status": VacancyStatus.OPEN,
            }
        ],
    },
    {
        "key": "studybuddy",
        "title": "StudyBuddy",
        "event": None,
        "leader": "nikita",
        "status": TeamStatus.RECRUITING,
        "description": "Пет-проект: поиск напарников по учёбе и совместные сессии Pomodoro.",
        "repo": "https://github.com/teamfinder/studybuddy",
        "members": [("nikita", "Team Lead / Frontend")],
        "vacancies": [
            {
                "title": "Frontend-разработчик",
                "role": "React / TypeScript",
                "description": "Экраны поиска напарников и календарь совместных сессий.",
                "status": VacancyStatus.OPEN,
            },
            {
                "title": "Дизайнер интерфейсов",
                "role": "UI/UX",
                "description": "Дизайн мобильных экранов и онбординга в Figma.",
                "status": VacancyStatus.OPEN,
            },
        ],
    },
    {
        "key": "pethealth",
        "title": "PetHealth",
        "event": None,
        "leader": "vlada",
        "status": TeamStatus.FORMED,
        "description": "Пет-проект: трекер здоровья питомцев с напоминаниями о прививках.",
        "repo": "https://github.com/teamfinder/pethealth",
        "members": [
            ("vlada", "Team Lead / Design"),
            ("elena", "Product Designer"),
        ],
        "vacancies": [],
    },
]

PARTICIPANTS: list[tuple[str, str, ParticipantStatus, str | None]] = [
    ("hackathon_2026", "max", ParticipantStatus.IN_TEAM, "Backend"),
    ("hackathon_2026", "kate", ParticipantStatus.IN_TEAM, "Frontend"),
    ("hackathon_2026", "ivan", ParticipantStatus.IN_TEAM, "Backend"),
    ("hackathon_2026", "artem", ParticipantStatus.IN_TEAM, "Analytics"),
    ("hackathon_2026", "pavel", ParticipantStatus.IN_TEAM, "Analytics"),
    ("hackathon_2026", "daria", ParticipantStatus.IN_TEAM, "Backend"),
    ("hackathon_2026", "sofia", ParticipantStatus.SEARCHING, "QA"),
    ("hackathon_2026", "vlada", ParticipantStatus.SEARCHING, "Design"),
    ("ctf_jam", "ivan", ParticipantStatus.IN_TEAM, "Reverse"),
    ("ctf_jam", "daria", ParticipantStatus.IN_TEAM, "Web"),
    ("ctf_jam", "nikita", ParticipantStatus.SEARCHING, "Pwn"),
    ("ctf_jam", "pavel", ParticipantStatus.SEARCHING, "Crypto"),
    ("startup_grant", "daria", ParticipantStatus.IN_TEAM, "CEO"),
    ("startup_grant", "elena", ParticipantStatus.IN_TEAM, "Design"),
    ("startup_grant", "sofia", ParticipantStatus.SEARCHING, "QA"),
    ("startup_grant", "artem", ParticipantStatus.SEARCHING, "Analytics"),
    ("diploma", "pavel", ParticipantStatus.IN_TEAM, "ML"),
    ("diploma", "max", ParticipantStatus.SEARCHING, "Backend"),
    ("academic", "artem", ParticipantStatus.SEARCHING, "Analytics"),
    ("academic", "pavel", ParticipantStatus.SEARCHING, "Analytics"),
    ("academic", "elena", ParticipantStatus.SEARCHING, "Design"),
]

APPLICATIONS: list[dict] = [
    {
        "team": "neural_ninjas",
        "vacancy": "ML-инженер",
        "user": "sofia",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.PENDING,
        "cover_letter": "Тестировала ML-сервисы, хочу попробовать себя в роли QA+ML. Готова разобраться в пайплайне.",
    },
    {
        "team": "greenloop",
        "vacancy": "Backend-разработчик",
        "user": "ivan",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.IN_DISCUSSION,
        "cover_letter": "Есть опыт с геоданными и PostgreSQL. Могу собрать API баллов за неделю.",
    },
    {
        "team": "greenloop",
        "vacancy": "Backend-разработчик",
        "user": "artem",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.REJECTED,
        "cover_letter": "Больше аналитик, но готов помочь с метриками продукта.",
    },
    {
        "team": "data_owls",
        "vacancy": "Backend-разработчик",
        "user": "pavel",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.ACCEPTED,
        "cover_letter": "Хочу развиваться в backend, готов учиться FastAPI.",
    },
    {
        "team": "deadbeef",
        "vacancy": "Reverse Engineer",
        "user": "nikita",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.PENDING,
        "cover_letter": "Проходил pwn-курсы, есть опыт с gdb. Ищу команду на CTF.",
    },
    {
        "team": "deadbeef",
        "vacancy": "Reverse Engineer",
        "user": "pavel",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.CANCELLED,
        "cover_letter": "Попробовал бы, но пока мало опыта.",
    },
    {
        "team": "ai_assistant",
        "vacancy": "Python-разработчик",
        "user": "daria",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.PENDING,
        "cover_letter": "Делала RAG-прототипы на LangChain, интересен дипломный проект.",
    },
    {
        "team": "studybuddy",
        "vacancy": "Frontend-разработчик",
        "user": "elena",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.PENDING,
        "cover_letter": "Могу помочь с UI и дизайн-системой, хочу попрактиковаться в React.",
    },
    {
        "team": "studybuddy",
        "vacancy": "Frontend-разработчик",
        "user": "max",
        "direction": ApplicationDirection.APPLY,
        "status": ApplicationStatus.CANCELLED,
        "cover_letter": "Интересен проект, но сейчас загружен своим хакатоном.",
    },
    {
        "team": "studybuddy",
        "vacancy": "Дизайнер интерфейсов",
        "user": "vlada",
        "direction": ApplicationDirection.INVITE,
        "status": ApplicationStatus.PENDING,
        "cover_letter": "Приглашаю в команду: нужен дизайнер мобильных экранов.",
    },
    {
        "team": "teamfinder_frontend",
        "vacancy": "Frontend-разработчик",
        "user": "sofia",
        "direction": ApplicationDirection.INVITE,
        "status": ApplicationStatus.PENDING,
        "cover_letter": "Приглашаем в пет-проект: нужен человек на тесты и UI-полировку.",
    },
]

NOTIFICATIONS: list[dict] = [
    {
        "user": "max",
        "title": "Новый отклик на вакансию",
        "message": "София Лебедева откликнулась на «ML-инженер» в команде Neural Ninjas.",
        "action_url_team": "neural_ninjas",
        "is_read": False,
    },
    {
        "user": "max",
        "title": "Дедлайн регистрации",
        "message": "«Хакатон TeamFinder 2026»: до конца регистрации 14 дней.",
        "action_url_team": None,
        "is_read": False,
    },
    {
        "user": "max",
        "title": "Добро пожаловать в TeamFinder",
        "message": "Заполните профиль и добавьте навыки, чтобы вас находили команды.",
        "action_url_team": None,
        "is_read": True,
    },
    {
        "user": "sofia",
        "title": "Приглашение в команду",
        "message": "Екатерина Соколова приглашает вас на «Frontend-разработчик» в TeamFinder Frontend.",
        "action_url_team": "teamfinder_frontend",
        "is_read": False,
    },
    {
        "user": "ivan",
        "title": "Ваш отклик в обсуждении",
        "message": "Лидер команды GreenLoop просматривает вашу заявку на «Backend-разработчик».",
        "action_url_team": "greenloop",
        "is_read": True,
    },
    {
        "user": "kate",
        "title": "Новый отклик на вакансию",
        "message": "София Лебедева получила приглашение на «Frontend-разработчик».",
        "action_url_team": "teamfinder_frontend",
        "is_read": False,
    },
]


async def get_or_create(session: AsyncSession, model, defaults: dict | None = None, **lookup):
    """Возвращает существующую запись или создаёт новую (идемпотентный сид)."""
    conditions = [getattr(model, field) == value for field, value in lookup.items()]
    statement = select(model).where(*conditions)
    existing = (await session.exec(statement)).first()
    if existing is not None:
        return existing, False

    instance = model(**lookup, **(defaults or {}))
    session.add(instance)
    await session.flush()
    return instance, True


async def reset_seed_data(session: AsyncSession) -> None:
    """Удаляет только данные, созданные этим скриптом."""
    await session.execute(delete(Team).where(Team.title.in_([team["title"] for team in TEAMS])))
    await session.execute(delete(Event).where(Event.title.in_([event["title"] for event in EVENTS])))
    await session.execute(delete(User).where(User.email.in_([user["email"] for user in USERS])))
    await session.commit()


async def seed(session: AsyncSession) -> dict[str, int]:
    """Создаёт тестовые данные и возвращает счётчики созданных записей."""
    created = {
        "skills": 0,
        "users": 0,
        "events": 0,
        "teams": 0,
        "members": 0,
        "vacancies": 0,
        "participants": 0,
        "applications": 0,
        "notifications": 0,
    }

    skills_by_name: dict[str, Skill] = {}
    for name, category in SKILLS:
        skill, was_created = await get_or_create(
            session, Skill, defaults={"category": category}, name=name
        )
        skills_by_name[name] = skill
        created["skills"] += int(was_created)

    users_by_key: dict[str, User] = {}
    for user_data in USERS:
        email = user_data["email"]
        existing = (await session.exec(select(User).where(User.email == email))).first()

        if existing is None:
            user = User(
                email=email,
                password_hash=get_password_hash(PASSWORD),
                first_name=user_data["first_name"],
                last_name=user_data["last_name"],
                role=user_data.get("role", UserRole.MEMBER),
                faculty=user_data.get("faculty"),
                course=user_data.get("course"),
                group_name=user_data.get("group_name"),
                bio=user_data.get("bio"),
                github_url=user_data.get("github"),
                portfolio_url=user_data.get("portfolio"),
                telegram_username=user_data.get("telegram"),
            )
            session.add(user)
            await session.flush()
            created["users"] += 1
        else:
            user = existing

        users_by_key[user_data["key"]] = user

        for skill_name in user_data.get("skills", []):
            skill = skills_by_name[skill_name]
            link = await session.get(UserSkill, (user.id, skill.id))
            if link is None:
                session.add(UserSkill(user_id=user.id, skill_id=skill.id))

    events_by_key: dict[str, Event] = {}
    now = datetime.now(UTC)
    for event_data in EVENTS:
        deadline_days = event_data["deadline_days"]
        event, was_created = await get_or_create(
            session,
            Event,
            defaults={
                "description": event_data["description"],
                "event_type": event_data["event_type"],
                "min_team_size": event_data["min_team_size"],
                "max_team_size": event_data["max_team_size"],
                "creator_id": users_by_key[event_data["creator"]].id,
                "registration_deadline": (
                    now + timedelta(days=deadline_days) if deadline_days is not None else None
                ),
                "is_active": event_data["is_active"],
            },
            title=event_data["title"],
        )
        events_by_key[event_data["key"]] = event
        created["events"] += int(was_created)

    teams_by_key: dict[str, Team] = {}
    vacancies_by_team_and_title: dict[tuple[str, str], Vacancy] = {}

    for team_data in TEAMS:
        event_key = team_data["event"]
        team, was_created = await get_or_create(
            session,
            Team,
            defaults={
                "event_id": events_by_key[event_key].id if event_key else None,
                "leader_id": users_by_key[team_data["leader"]].id,
                "project_description": team_data["description"],
                "repository_url": team_data["repo"],
                "status": team_data["status"],
            },
            title=team_data["title"],
        )
        teams_by_key[team_data["key"]] = team
        created["teams"] += int(was_created)

        for member_key, role_name in team_data["members"]:
            _, member_created = await get_or_create(
                session,
                TeamMember,
                defaults={"role_name": role_name},
                team_id=team.id,
                user_id=users_by_key[member_key].id,
            )
            created["members"] += int(member_created)

        for vacancy_data in team_data["vacancies"]:
            vacancy, vacancy_created = await get_or_create(
                session,
                Vacancy,
                defaults={
                    "description": vacancy_data["description"],
                    "required_role": vacancy_data["role"],
                    "status": vacancy_data["status"],
                },
                team_id=team.id,
                title=vacancy_data["title"],
            )
            vacancies_by_team_and_title[(team_data["key"], vacancy_data["title"])] = vacancy
            created["vacancies"] += int(vacancy_created)

    for event_key, user_key, status, desired_role in PARTICIPANTS:
        _, was_created = await get_or_create(
            session,
            EventParticipant,
            defaults={"status": status, "desired_role": desired_role},
            event_id=events_by_key[event_key].id,
            participant_id=users_by_key[user_key].id,
        )
        created["participants"] += int(was_created)

    for application_data in APPLICATIONS:
        vacancy = vacancies_by_team_and_title[
            (application_data["team"], application_data["vacancy"])
        ]
        _, was_created = await get_or_create(
            session,
            Application,
            defaults={
                "cover_letter": application_data.get("cover_letter"),
                "status": application_data["status"],
            },
            vacancy_id=vacancy.id,
            user_id=users_by_key[application_data["user"]].id,
            direction=application_data["direction"],
        )
        created["applications"] += int(was_created)

    for notification_data in NOTIFICATIONS:
        team_key = notification_data.get("action_url_team")
        action_url = f"/teams/{teams_by_key[team_key].id}" if team_key else None
        _, was_created = await get_or_create(
            session,
            Notification,
            defaults={
                "message": notification_data["message"],
                "action_url": action_url,
                "is_read": notification_data["is_read"],
            },
            user_id=users_by_key[notification_data["user"]].id,
            title=notification_data["title"],
        )
        created["notifications"] += int(was_created)

    await session.commit()
    return created


def print_summary(created: dict[str, int]) -> None:
    print("\nТестовые данные готовы.")
    print("Создано записей:", ", ".join(f"{name}={count}" for name, count in created.items()))
    print(f"\nДоступы (пароль у всех: {PASSWORD}):")
    for user_data in USERS:
        role = user_data.get("role", UserRole.MEMBER).value
        print(
            f"  {role:6}  {user_data['email']:22}  "
            f"{user_data['first_name']} {user_data['last_name']}"
        )
    print("\nПодсказка: войдите как max@example.com, kate@example.com или admin.seed@example.com.")


async def main(reset: bool) -> None:
    async with async_session_maker() as session:
        if reset:
            await reset_seed_data(session)
            print("Старые сид-данные удалены.")

        created = await seed(session)

    print_summary(created)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Тестовые данные TeamFinder")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="удалить ранее созданные сидом данные и создать их заново",
    )
    args = parser.parse_args()
    asyncio.run(main(reset=args.reset))
