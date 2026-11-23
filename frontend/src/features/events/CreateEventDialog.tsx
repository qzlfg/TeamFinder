import { zodResolver } from '@hookform/resolvers/zod'
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
import type { EventType } from '@/lib/labels'
import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER } from '@/lib/labels'
import { useCreateEvent } from './api'

const eventSchema = z
  .object({
    title: z.string().min(1, 'Укажите название').max(255, 'Максимум 255 символов'),
    description: z.string().min(1, 'Добавьте описание'),
    event_type: z.enum([
      'hackathon',
      'academic_course',
      'ctf_jam',
      'startup_grant',
      'diploma',
      'pet_project',
    ]),
    min_team_size: z.number().int().min(1, 'Минимум 1').max(100, 'Максимум 100'),
    max_team_size: z.number().int().min(1, 'Минимум 1').max(100, 'Максимум 100'),
    registration_deadline: z.string().optional(),
  })
  .refine((values) => values.max_team_size >= values.min_team_size, {
    message: 'Максимум не может быть меньше минимума',
    path: ['max_team_size'],
  })

type EventValues = z.infer<typeof eventSchema>

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Создание мероприятия администратором или ментором. */
export function CreateEventDialog({ open, onOpenChange }: CreateEventDialogProps) {
  const createEvent = useCreateEvent()

  const form = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      event_type: 'hackathon',
      min_team_size: 2,
      max_team_size: 5,
      registration_deadline: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const deadline = values.registration_deadline
      ? new Date(values.registration_deadline).toISOString()
      : null

    try {
      await createEvent.mutateAsync({
        title: values.title.trim(),
        description: values.description.trim(),
        event_type: values.event_type,
        min_team_size: values.min_team_size,
        max_team_size: values.max_team_size,
        registration_deadline: deadline,
      })
      onOpenChange(false)
      form.reset()
    } catch {
      // Ошибка показана тостом в src/api/client.ts.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новое мероприятие</DialogTitle>
          <DialogDescription>
            Мероприятие появится в витрине, а участники смогут создавать в нём команды.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Название"
            placeholder="Хакатон TeamFinder 2026"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />

          <div className="space-y-1.5">
            <Label htmlFor="event-type">Тип</Label>
            <Select
              value={form.watch('event_type')}
              onValueChange={(value) =>
                form.setValue('event_type', value as EventType, { shouldValidate: true })
              }
            >
              <SelectTrigger id="event-type" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_ORDER.map((eventType) => (
                  <SelectItem key={eventType} value={eventType}>
                    {EVENT_TYPE_LABELS[eventType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm leading-none font-medium" htmlFor="event-description">
              Описание
            </label>
            <Textarea
              id="event-description"
              rows={3}
              placeholder="Формат, тематика, призы"
              className="bg-white"
              {...form.register('description')}
            />
            {form.formState.errors.description?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Мин. размер команды"
              type="number"
              min={1}
              max={100}
              error={form.formState.errors.min_team_size?.message}
              {...form.register('min_team_size', { valueAsNumber: true })}
            />
            <FormField
              label="Макс. размер команды"
              type="number"
              min={1}
              max={100}
              error={form.formState.errors.max_team_size?.message}
              {...form.register('max_team_size', { valueAsNumber: true })}
            />
          </div>

          <FormField
            label="Дедлайн регистрации"
            type="datetime-local"
            hint="Необязательно"
            error={form.formState.errors.registration_deadline?.message}
            {...form.register('registration_deadline')}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? 'Создаём…' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
