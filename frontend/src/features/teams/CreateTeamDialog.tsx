import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
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
import { useEvents } from '@/features/events/api'
import { EVENT_TYPE_LABELS } from '@/lib/labels'
import { useCreateTeam } from './api'

const teamSchema = z.object({
  title: z.string().min(1, 'Укажите название').max(255, 'Максимум 255 символов'),
  project_description: z.string().optional(),
  repository_url: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^https?:\/\/\S+$/.test(value),
      'Ссылка должна начинаться с http:// или https://',
    ),
  event_id: z.string().optional(),
})

type TeamValues = z.infer<typeof teamSchema>

interface CreateTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEventId?: string
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Создание команды: мероприятие выбирается из активных событий, иначе пет-проект. */
export function CreateTeamDialog({ open, onOpenChange, initialEventId }: CreateTeamDialogProps) {
  const navigate = useNavigate()
  const createTeam = useCreateTeam()
  const { data: events = [] } = useEvents({})
  const isEventLocked = Boolean(initialEventId)

  const form = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      title: '',
      project_description: '',
      repository_url: '',
      event_id: initialEventId ?? '',
    },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    form.reset({
      title: '',
      project_description: '',
      repository_url: '',
      event_id: initialEventId ?? '',
    })
  }, [open, initialEventId, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const team = await createTeam.mutateAsync({
        title: values.title.trim(),
        project_description: emptyToNull(values.project_description),
        repository_url: emptyToNull(values.repository_url),
        event_id: initialEventId ?? (values.event_id ? values.event_id : null),
        status: 'recruiting',
      })

      onOpenChange(false)
      form.reset()
      await navigate({ to: '/teams/$teamId', params: { teamId: team.id } })
    } catch {
      // Ошибка показана тостом в src/api/client.ts.
    }
  })

  const activeEvents = events.filter((event) => event.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая команда</DialogTitle>
          <DialogDescription>
            {isEventLocked
              ? 'Вы станете лидером команды в этом мероприятии и автоматически попадёте в список участников.'
              : 'Вы станете лидером. Для команды мероприятия вы автоматически попадёте в его список участников.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Название"
            placeholder="Например, TeamFinder"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />

          <div className="space-y-1.5">
            <label className="text-sm leading-none font-medium" htmlFor="team-description">
              Описание проекта
            </label>
            <Textarea
              id="team-description"
              rows={3}
              placeholder="Идея, стек, чего не хватает команде"
              className="bg-white"
              {...form.register('project_description')}
            />
          </div>

          {isEventLocked ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="team-event">Мероприятие</Label>
              <Select
                value={form.watch('event_id') || 'none'}
                onValueChange={(value) =>
                  form.setValue('event_id', value === 'none' ? '' : value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="team-event" className="w-full bg-white">
                  <SelectValue placeholder="Пет-проект" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Пет-проект (без мероприятия)</SelectItem>
                  {activeEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} · {EVENT_TYPE_LABELS[event.event_type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            <Button type="submit" disabled={createTeam.isPending}>
              {createTeam.isPending ? 'Создаём…' : 'Создать команду'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
