import { X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSkills } from '@/features/users/api'
import { cn } from '@/lib/utils'
import type { VacancySkillInput } from './api'

interface VacancySkillsFieldProps {
  value: VacancySkillInput[]
  onChange: (value: VacancySkillInput[]) => void
  enabled: boolean
}

/** Редактор навыков вакансии: обязательные и желательные, из общего справочника. */
export function VacancySkillsField({ value, onChange, enabled }: VacancySkillsFieldProps) {
  const { data: catalog = [], isPending } = useSkills(enabled)
  const [selected, setSelected] = useState('')

  const selectedIds = new Set(value.map((item) => item.skill_id))
  const available = catalog.filter((skill) => !selectedIds.has(skill.id))
  const selectedSkill = available.find((skill) => String(skill.id) === selected)

  const toggleRequired = (skillId: number) => {
    onChange(
      value.map((item) =>
        item.skill_id === skillId ? { ...item, is_required: !item.is_required } : item,
      ),
    )
  }

  const addSkill = () => {
    if (!selectedSkill) {
      return
    }

    onChange([...value, { skill_id: selectedSkill.id, is_required: true }])
    setSelected('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 ? (
          <p className="text-xs text-zinc-500">Навыки не выбраны.</p>
        ) : (
          value.map((item) => {
            const skill = catalog.find((entry) => entry.id === item.skill_id)

            return (
              <span
                key={item.skill_id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
                  item.is_required
                    ? 'border-zinc-300 text-zinc-800'
                    : 'border-dashed border-zinc-200 text-zinc-500',
                )}
              >
                <span>{skill?.name ?? `Навык #${item.skill_id}`}</span>
                <button
                  type="button"
                  className="rounded bg-zinc-100 px-1 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                  onClick={() => toggleRequired(item.skill_id)}
                >
                  {item.is_required ? 'Обязательный' : 'Будет плюсом'}
                </button>
                <button
                  type="button"
                  aria-label={`Удалить навык ${skill?.name ?? item.skill_id}`}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  onClick={() =>
                    onChange(value.filter((entry) => entry.skill_id !== item.skill_id))
                  }
                >
                  <X className="size-3" />
                </button>
              </span>
            )
          })
        )}
      </div>

      <div className="flex gap-2">
        <Select
          value={selected}
          onValueChange={setSelected}
          disabled={!enabled || isPending || available.length === 0}
        >
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue
              placeholder={
                isPending
                  ? 'Загрузка справочника…'
                  : catalog.length === 0
                    ? 'Справочник пуст'
                    : available.length === 0
                      ? 'Все навыки добавлены'
                      : 'Добавить навык'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {available.map((skill) => (
              <SelectItem key={skill.id} value={String(skill.id)}>
                {skill.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          disabled={!enabled || !selectedSkill}
          onClick={addSkill}
        >
          Добавить
        </Button>
      </div>
    </div>
  )
}
