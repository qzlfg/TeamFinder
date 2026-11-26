import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { VacancySkillRead } from './api'

interface VacancySkillsListProps {
  skills?: VacancySkillRead[] | null
  userSkillIds?: Set<number>
}

/** Компактный список навыков вакансии с подсветкой совпадений профиля. */
export function VacancySkillsList({ skills, userSkillIds }: VacancySkillsListProps) {
  if (!skills || skills.length === 0) {
    return null
  }

  const matchedCount = userSkillIds
    ? skills.filter((item) => userSkillIds.has(item.skill.id)).length
    : 0
  const orderedSkills = [...skills].sort((a, b) => Number(b.is_required) - Number(a.is_required))

  return (
    <div className="flex flex-wrap items-center gap-1">
      {orderedSkills.map((item) => {
        const matched = userSkillIds?.has(item.skill.id) ?? false

        return (
          <span
            key={item.skill.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
              item.is_required
                ? 'border-zinc-300 text-zinc-800'
                : 'border-dashed border-zinc-200 text-zinc-500',
              matched && 'border-blue-200 bg-blue-50 text-blue-700',
            )}
          >
            {matched ? <Check className="size-3" /> : null}
            {item.skill.name}
          </span>
        )
      })}

      {userSkillIds ? (
        <span className="ml-1 font-mono text-xs text-zinc-500 tabular-nums">
          Совпадает {matchedCount} из {skills.length}
        </span>
      ) : null}
    </div>
  )
}
