import { X } from 'lucide-react'
import { useState } from 'react'

import { SkillBadge } from '@/components/shared/SkillBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UserPrivateRead } from './api'
import { useAddSkill, useRemoveSkill, useSkills } from './api'

interface SkillsEditorProps {
  user: UserPrivateRead
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Управление навыками профиля: справочник /skills + привязка к /users/me. */
export function SkillsEditor({ user, open, onOpenChange }: SkillsEditorProps) {
  const { data: catalog = [], isPending } = useSkills()
  const addSkill = useAddSkill()
  const removeSkill = useRemoveSkill()
  const [selected, setSelected] = useState('')

  const ownSkills = user.skills ?? []
  const available = catalog.filter((skill) => !ownSkills.some((owned) => owned.id === skill.id))
  const selectedSkill = available.find((skill) => String(skill.id) === selected)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Навыки</DialogTitle>
          <DialogDescription>
            Добавляйте навыки из справочника — по ним вас найдут в каталоге участников.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {ownSkills.length === 0 ? (
              <p className="text-sm text-zinc-500">Навыки пока не добавлены.</p>
            ) : (
              ownSkills.map((skill) => (
                <span key={skill.id} className="inline-flex items-center gap-1">
                  <SkillBadge skill={skill} />
                  <button
                    type="button"
                    aria-label={`Удалить навык ${skill.name}`}
                    className="rounded-md p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    disabled={removeSkill.isPending}
                    onClick={() => removeSkill.mutate(skill.id)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Select
              value={selected}
              onValueChange={setSelected}
              disabled={isPending || available.length === 0}
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
                          : 'Выберите навык'
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
              disabled={!selectedSkill || addSkill.isPending}
              onClick={() => {
                if (!selectedSkill) {
                  return
                }
                addSkill.mutate(selectedSkill.id, {
                  onSuccess: () => setSelected(''),
                })
              }}
            >
              Добавить
            </Button>
          </div>

          {catalog.length === 0 && !isPending ? (
            <p className="text-xs leading-relaxed text-zinc-500">
              Справочник навыков пуст: администратор или ментор может добавить навыки через
              <span className="font-mono"> POST /api/v1/skills</span>.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
