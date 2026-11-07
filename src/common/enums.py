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