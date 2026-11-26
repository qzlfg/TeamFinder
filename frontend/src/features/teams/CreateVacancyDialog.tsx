import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { VacancySkillInput } from './api'
import { useCreateVacancy } from './api'
import { VacancySkillsField } from './VacancySkillsField'

const vacancySchema = z.object({
  title: z.string().trim().min(1, 'Укажите заголовок').max(255, 'Максимум 255 символов'),
  description: z.string().trim().min(1, 'Добавьте описание').max(1000, 'Максимум 1000 символов'),
  required_role: z.string().trim().min(1, 'Укажите роль').max(255, 'Максимум 255 символов'),
})

type VacancyValues = z.infer<typeof vacancySchema>

interface CreateVacancyDialogProps {
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Открытие вакансии лидером команды в статусе «Набор». */
export function CreateVacancyDialog({ teamId, open, onOpenChange }: CreateVacancyDialogProps) {
  const createVacancy = useCreateVacancy(teamId)
  const [skills, setSkills] = useState<VacancySkillInput[]>([])

  const form = useForm<VacancyValues>({
    resolver: zodResolver(vacancySchema),
    defaultValues: { title: '', description: '', required_role: '' },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSkills([])
      form.reset()
    }

    onOpenChange(nextOpen)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createVacancy.mutateAsync({
        title: values.title.trim(),
        description: values.description.trim(),
        required_role: values.required_role.trim(),
        skills,
      })
      handleOpenChange(false)
    } catch {
      // Ошибка показана тостом в src/api/client.ts.
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая вакансия</DialogTitle>
          <DialogDescription>
            Опишите роль и задачи — вакансия появится в каталоге открытых слотов.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Заголовок"
            placeholder="Frontend-разработчик"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />

          <FormField
            label="Роль"
            placeholder="React / TypeScript"
            error={form.formState.errors.required_role?.message}
            {...form.register('required_role')}
          />

          <div className="space-y-1.5">
            <label className="text-sm leading-none font-medium" htmlFor="vacancy-description">
              Описание
            </label>
            <Textarea
              id="vacancy-description"
              rows={4}
              placeholder="Задачи, требования, формат работы"
              className="bg-white"
              {...form.register('description')}
            />
            {form.formState.errors.description?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm leading-none font-medium">Навыки</p>
            <VacancySkillsField value={skills} onChange={setSkills} enabled={open} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={createVacancy.isPending}>
              {createVacancy.isPending ? 'Открываем…' : 'Открыть вакансию'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
