import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

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
import type { VacancyRead } from '@/features/teams/api'
import { useApplyToVacancy } from './api'

const applySchema = z.object({
  cover_letter: z.string().max(1000, 'Максимум 1000 символов').optional(),
})

type ApplyValues = z.infer<typeof applySchema>

interface ApplyDialogProps {
  vacancy: VacancyRead
  teamTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Отклик на вакансию с сопроводительным письмом. */
export function ApplyDialog({ vacancy, teamTitle, open, onOpenChange }: ApplyDialogProps) {
  const applyToVacancy = useApplyToVacancy()

  const form = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    defaultValues: { cover_letter: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const coverLetter = values.cover_letter?.trim()

    try {
      await applyToVacancy.mutateAsync({
        vacancy_id: vacancy.id,
        cover_letter: coverLetter ? coverLetter : null,
      })
      onOpenChange(false)
      form.reset()
    } catch {
      // Ошибка показана тостом в src/api/client.ts.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отклик на вакансию</DialogTitle>
          <DialogDescription>
            {teamTitle} · {vacancy.title} ({vacancy.required_role})
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-1.5">
            <label className="text-sm leading-none font-medium" htmlFor="cover-letter">
              Сопроводительное письмо
            </label>
            <Textarea
              id="cover-letter"
              rows={5}
              placeholder="Почему вам интересна роль и что можете предложить команде"
              className="bg-white"
              {...form.register('cover_letter')}
            />
            {form.formState.errors.cover_letter?.message ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.cover_letter.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={applyToVacancy.isPending}>
              {applyToVacancy.isPending ? 'Отправляем…' : 'Отправить отклик'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
