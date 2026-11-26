import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { VACANCY_STATUS_LABELS, type VacancyStatus } from '@/lib/labels'
import type { VacancyRead, VacancySkillInput } from './api'
import { useUpdateVacancy } from './api'
import { VacancySkillsField } from './VacancySkillsField'

const vacancySchema = z.object({
  title: z.string().trim().min(1, 'Укажите заголовок').max(255, 'Максимум 255 символов'),
  required_role: z.string().trim().min(1, 'Укажите роль').max(255, 'Максимум 255 символов'),
  description: z.string().trim().min(1, 'Добавьте описание').max(1000, 'Максимум 1000 символов'),
  status: z.enum(['open', 'closed']),
})

type VacancyValues = z.infer<typeof vacancySchema>

interface EditVacancyDialogProps {
  vacancy: VacancyRead
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Редактирование вакансии: текст, статус и навыки. */
export function EditVacancyDialog({ vacancy, open, onOpenChange }: EditVacancyDialogProps) {
  const updateVacancy = useUpdateVacancy()
  const [skills, setSkills] = useState<VacancySkillInput[]>([])

  const form = useForm<VacancyValues>({
    resolver: zodResolver(vacancySchema),
    defaultValues: {
      title: '',
      required_role: '',
      description: '',
      status: 'open',
    },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    form.reset({
      title: vacancy.title,
      required_role: vacancy.required_role,
      description: vacancy.description,
      status: vacancy.status,
    })
    setSkills(
      (vacancy.skills ?? []).map((item) => ({
        skill_id: item.skill.id,
        is_required: item.is_required,
      })),
    )
  }, [open, vacancy, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateVacancy.mutateAsync({
        vacancyId: vacancy.id,
        payload: {
          title: values.title.trim(),
          required_role: values.required_role.trim(),
          description: values.description.trim(),
          status: values.status,
          skills,
        },
      })
      onOpenChange(false)
    } catch {
      // Ошибка уже показана тостом в src/api/client.ts.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Редактировать вакансию</DialogTitle>
          <DialogDescription>Измените описание, статус и требования к навыкам.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Заголовок"
            placeholder="Frontend-разработчик"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Роль"
              placeholder="React / TypeScript"
              error={form.formState.errors.required_role?.message}
              {...form.register('required_role')}
            />

            <div className="space-y-1.5">
              <Label htmlFor="edit-vacancy-status">Статус</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) =>
                  form.setValue('status', value as VacancyStatus, { shouldValidate: true })
                }
              >
                <SelectTrigger id="edit-vacancy-status" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VACANCY_STATUS_LABELS) as VacancyStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {VACANCY_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm leading-none font-medium" htmlFor="edit-vacancy-description">
              Описание
            </label>
            <Textarea
              id="edit-vacancy-description"
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={updateVacancy.isPending}>
              {updateVacancy.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
