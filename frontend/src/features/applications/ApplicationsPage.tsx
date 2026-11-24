import { Inbox, MessageSquare } from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ApplicationRead,
  useMyApplications,
  useSetApplicationStatus,
} from '@/features/applications/api'
import { formatDateTime } from '@/lib/format'
import { APPLICATION_DIRECTION_LABELS, type ApplicationStatus } from '@/lib/labels'

const ACTIVE_STATUSES: ApplicationStatus[] = ['pending', 'in_discussion']

/** Иконка с поповером для просмотра сопроводительного письма. */
function CoverLetterCell({ letter }: { letter: string | null }) {
  if (!letter) {
    return <span className="text-xs text-zinc-400">—</span>
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-zinc-400 hover:text-zinc-900"
          aria-label="Показать сопроводительное письмо"
        >
          <MessageSquare className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          Сопроводительное письмо
        </p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{letter}</p>
      </PopoverContent>
    </Popover>
  )
}

/** Мои отклики и приглашения: отзыв отклика и ответ на приглашение. */
export function ApplicationsPage() {
  const { data, isPending, isError, error, refetch } = useMyApplications()
  const setStatus = useSetApplicationStatus()

  const updateStatus = (application: ApplicationRead, status: ApplicationStatus) => {
    setStatus.mutate({ applicationId: application.id, status })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Заявки"
        description="Ваши отклики на вакансии и приглашения от лидеров команд."
      />

      {isPending ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Заявок нет"
          description="Откликнитесь на открытую вакансию в карточке команды — заявка появится здесь."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Направление</TableHead>
                <TableHead>Вакансия</TableHead>
                <TableHead>Письмо</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Создана</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((application) => {
                const isActive = ACTIVE_STATUSES.includes(application.status)

                return (
                  <TableRow key={application.id} className="hover:bg-zinc-100/80">
                    <TableCell className="font-medium text-zinc-950">
                      {APPLICATION_DIRECTION_LABELS[application.direction]}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500 tabular-nums">
                      {application.vacancy_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <CoverLetterCell letter={application.cover_letter} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={application.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-zinc-500 tabular-nums">
                      {formatDateTime(application.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isActive ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : application.direction === 'apply' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={setStatus.isPending}
                          onClick={() => updateStatus(application, 'cancelled')}
                        >
                          Отозвать
                        </Button>
                      ) : (
                        <span className="inline-flex gap-1">
                          <Button
                            size="sm"
                            disabled={setStatus.isPending}
                            onClick={() => updateStatus(application, 'accepted')}
                          >
                            Принять
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={setStatus.isPending}
                            onClick={() => updateStatus(application, 'rejected')}
                          >
                            Отклонить
                          </Button>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
