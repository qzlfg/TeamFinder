import { Link } from '@tanstack/react-router'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApplicationDirectionLabel } from './ApplicationDirectionLabel'
import { type ApplicationAction, type ApplicationRead, isActiveApplication } from './api'

interface ApplicationDetailDialogProps {
  application: ApplicationRead | null
  onOpenChange: (open: boolean) => void
  onAction: (status: ApplicationAction) => void
  isPending?: boolean
}

/** Детальный просмотр заявки с полным письмом и действиями по статусу. */
export function ApplicationDetailDialog({
  application,
  onOpenChange,
  onAction,
  isPending = false,
}: ApplicationDetailDialogProps) {
  if (!application) {
    return null
  }

  const isActive = isActiveApplication(application.status)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base leading-snug">
            {application.vacancy_title}
          </DialogTitle>
          <DialogDescription>Заявка на вакансию</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
            {application.vacancy_required_role}
          </span>
          <span className="text-xs text-zinc-400" aria-hidden="true">
            ·
          </span>
          <Link
            to="/teams/$teamId"
            params={{ teamId: application.team_id }}
            className="text-xs text-blue-600 hover:underline"
          >
            {application.team_title}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Направление</p>
            <ApplicationDirectionLabel
              direction={application.direction}
              hasCoverLetter={Boolean(application.cover_letter)}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Статус</p>
            <StatusBadge status={application.status} />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Создана</p>
            <p className="font-mono text-xs text-zinc-500 tabular-nums">
              {formatDateTime(application.created_at)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Обновлена</p>
            <p className="font-mono text-xs text-zinc-500 tabular-nums">
              {formatDateTime(application.updated_at)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Сопроводительное письмо
          </p>
          <div
            className={cn(
              'rounded-md border border-zinc-200 p-3 text-sm leading-relaxed whitespace-pre-wrap',
              application.cover_letter ? 'bg-zinc-50 text-zinc-700' : 'bg-white text-zinc-500',
            )}
          >
            {application.cover_letter ?? 'Без сопроводительного письма'}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>

          {isActive ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {application.direction === 'apply' ? (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() => onAction('cancelled')}
                >
                  Отозвать
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={isPending}
                    onClick={() => onAction('rejected')}
                  >
                    Отклонить
                  </Button>
                  <Button disabled={isPending} onClick={() => onAction('accepted')}>
                    Принять
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
