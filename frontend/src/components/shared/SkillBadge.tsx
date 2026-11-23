import type { components } from '@/api/schema'
import { SKILL_CATEGORY_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

type Skill = components['schemas']['SkillRead']

interface SkillBadgeProps {
  skill: Skill
  className?: string
}

/** Моноширинный тег навыка (цвет — только через токены zinc). */
export function SkillBadge({ skill, className }: SkillBadgeProps) {
  return (
    <span
      title={SKILL_CATEGORY_LABELS[skill.category]}
      className={cn(
        'inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600',
        className,
      )}
    >
      {skill.name}
    </span>
  )
}
