from enum import StrEnum


class UserRole(StrEnum):
    MEMBER = "member"
    MENTOR = "mentor"
    AGENT = "agent"
    ADMIN = "admin"

class EventType(StrEnum):
    ACADEMIC_COURSE = "academic_course"  # Проектная деятельность, курсовые
    HACKATHON = "hackathon"              # Хакатоны, кейс-чемпионаты
    CTF_JAM = "ctf_jam"                  # Game Jams, CTF
    STARTUP_GRANT = "startup_grant"      # Акселераторы, гранты
    DIPLOMA = "diploma"                  # Междисциплинарный диплом
    PET_PROJECT = "pet_project"          # Бессрочные пет-проекты, open-source проекты

class ParticipantStatus(StrEnum):
    SEARCHING = "searching"
    IN_TEAM = "in_team"

class TeamStatus(StrEnum):
    RECRUITING = "recruiting"
    FORMED = "formed"
    ARCHIVED = "archived"

class VacancyStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"

class SkillCategory(StrEnum):
    FRONTEND = "frontend"
    BACKEND = "backend"
    DESIGN = "design"
    ANALYTICS = "analytics"
    QA = "qa"

class ApplicationDirection(StrEnum):
    APPLY = "apply"    # Отклик студента на вакансию
    INVITE = "invite"  # Приглашение от лидера команды


class ApplicationStatus(StrEnum):
    PENDING = "pending"
    IN_DISCUSSION = "in_discussion"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"