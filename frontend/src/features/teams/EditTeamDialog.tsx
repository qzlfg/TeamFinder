import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
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
import type { TeamStatus } from '@/lib/labels'
import { TEAM_STATUS_LABELS } from '@/lib/labels'
import type { TeamRead } from './api'
import { useUpdateTeam } from './api'

const teamSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название').max(255, 'Максимум 255 символов'),
  project_description: z.string().optional(),
  repository_url: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^https?:\/\/\S+$/.test(value),
      'Ссылка должна начинаться с http:// или https://',
    ),
  status: z.enum(['recruiting', 'formed', 'archived']),
})

type TeamValues = z.infer<typeof teamSchema>

interface EditTeamDialogProps {
  team: TeamRead
  open: boolean
  onOpenChange: (open: boolean) => void
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Редактирование команды лидером: описание, репозиторий и статус набора. */
export function EditTeamDialog({ team, open, onOpenChange }: EditTeamDialogProps) {
  const updateTeam = useUpdateTeam(team.id)

  const form = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { title: team.title, status: team.status },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    form.reset({
      title: team.title,
      project_description: team.project_description ?? '',
      repository_url: team.repository_url ?? '',
      status: team.status,
    })
  }, [open, team, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateTeam.mutateAsync({
        title: values.title.trim(),
        project_description: emptyToNull(values.project_description),
        repository_url: emptyToNull(values.repository_url),
        status: values.status,
      })
      onOpenChange(false)
    } catch {
      // Ошибка показана тостом в src/api/client.ts.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать команду</DialogTitle>
          <DialogDescription>
            При переводе в «Сформирована» или «Архив» все открытые вакансии закроются.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Название"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />

          <div className="space-y-1.5">
            <label className="text-sm leading-none font-medium" htmlFor="edit-team-description">
              Описание
            </label>
            <Textarea
              id="edit-team-description"
              rows={3}
              className="bg-white"
              {...form.register('project_description')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-team-status">Статус</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(value) =>
                form.setValue('status', value as TeamStatus, { shouldValidate: true })
              }
            >
              <SelectTrigger id="edit-team-status" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TEAM_STATUS_LABELS) as TeamStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {TEAM_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FormField
            label="Репозиторий"
            placeholder="https://github.com/..."
            error={form.formState.errors.repository_url?.message}
            {...form.register('repository_url')}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={updateTeam.isPending}>
              {updateTeam.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
