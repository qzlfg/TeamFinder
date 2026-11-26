"""add_vacancy_skills

Revision ID: a661973e19fb
Revises: 44c72a483906
Create Date: 2026-11-26 14:41:51.042493

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'a661973e19fb'
down_revision: Union[str, Sequence[str], None] = '44c72a483906'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "vacancy_skills",
        sa.Column("vacancy_id", sa.Uuid(), nullable=False),
        sa.Column("skill_id", sa.Integer(), nullable=False),
        sa.Column(
            "is_required",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vacancy_id"], ["vacancies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("vacancy_id", "skill_id"),
    )
    op.create_index(
        op.f("ix_vacancy_skills_skill_id"),
        "vacancy_skills",
        ["skill_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_vacancy_skills_skill_id"), table_name="vacancy_skills")
    op.drop_table("vacancy_skills")