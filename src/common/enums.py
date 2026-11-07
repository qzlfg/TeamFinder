from enum import StrEnum


class UserRole(StrEnum):
    MEMBER = "member"
    MENTOR = "mentor"
    AGENT = "agent"
    ADMIN = "admin"