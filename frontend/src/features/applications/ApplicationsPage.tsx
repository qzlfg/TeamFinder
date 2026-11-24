import { Link } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApplicationDetailDialog } from '@/features/applications/ApplicationDetailDialog'
import { ApplicationDirectionLabel } from '@/features/applications/ApplicationDirectionLabel'
import {
  type ApplicationAction,
  type ApplicationRead,
  isActiveApplication,
  useMyApplications,
  useSetApplicationStatus,
} from '@/features/applications/api'
import { formatDateTime } from '@/lib/format'
import type { ApplicationDirection, ApplicationStatus } from '@/lib/labels'
import { CHIP_TRIGGER_CLASS } from '@/lib/styles'
import { cn } from '@/lib/utils'

type DirectionFilter = ApplicationDirection | 'all'

interface ConfirmState {
  application: ApplicationRead
  status: Extract<ApplicationAction, 'cancelled' | 'rejected'>
}

const DIRECTION_TABS: { value: DirectionFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'apply', label: 'Отклики' },
  { value: 'invite', label: 'Приглашения' },
]

/** Мои отклики и приглашения: фильтры по направлению и действия по статусу. */
export function ApplicationsPage() {
  const { data, isPending, isError, error, refetch } = useMyApplications()
  const setStatus = useSetApplicationStatus()

  const [direction, setDirection] = useState<DirectionFilter>('all')
  const [selected, setSelected] = useState<ApplicationRead | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const applications = data ?? []
  const counts: Record<DirectionFilter, number> = {
    all: applications.length,
    apply: applications.filter((application) => application.direction === 'apply').length,
    invite: applications.filter((application) => application.direction === 'invite').length,
  }
  const filtered =
    direction === 'all'
      ? applications
      : applications.filter((application) => application.direction === direction)

  const requestStatus = (application: ApplicationRead, status: ApplicationStatus) => {
    if (status === 'accepted') {
      setStatus.mutate(
        { applicationId: application.id, status },
        {
          onSuccess: () => {
            setSelected(null)
          },
        },
      )
      return
    }

    if (status === 'cancelled' || status === 'rejected') {
      setSelected(null)
      setConfirm({ application, status })
    }
  }

  const confirmAction = async () => {
    if (!confirm) {
      return
    }

    try {
      await setStatus.mutateAsync({
        applicationId: confirm.application.id,
        status: confirm.status,
      })
      setConfirm(null)
    } catch {
      // Ошибка показывается тостом в src/api/client.ts.
    }
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
      ) : applications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Заявок нет"
          description="Откликнитесь на открытую вакансию в карточке команды — заявка появится здесь."
        />
      ) : (
        <div className="space-y-4">
          <Tabs value={direction} onValueChange={(value) => setDirection(value as DirectionFilter)}>
            <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
              {DIRECTION_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className={CHIP_TRIGGER_CLASS}>
                  {tab.label}
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums',
                      direction === tab.value ? 'text-blue-600' : 'text-zinc-400',
                    )}
                  >
                    {counts[tab.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Заявок нет"
              description="В этой категории пока нет заявок."
              action={
                <Button variant="outline" onClick={() => setDirection('all')}>
                  Показать все заявки
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Вакансия и команда</TableHead>
                    <TableHead>Направление</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Создана</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((application) => {
                    const isActive = isActiveApplication(application.status)

                    return (
                      <TableRow
                        key={application.id}
                        className="cursor-pointer hover:bg-zinc-100/80"
                        onClick={() => setSelected(application)}
                      >
                        <TableCell className="min-w-64 py-3 whitespace-normal">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-zinc-950">
                              {application.vacancy_title}
                            </span>
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
                                onClick={(event) => event.stopPropagation()}
                              >
                                {application.team_title}
                              </Link>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ApplicationDirectionLabel
                            direction={application.direction}
                            hasCoverLetter={Boolean(application.cover_letter)}
                          />
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
                              onClick={(event) => {
                                event.stopPropagation()
                                requestStatus(application, 'cancelled')
                              }}
                            >
                              Отозвать
                            </Button>
                          ) : (
                            <span className="inline-flex gap-1">
                              <Button
                                size="sm"
                                disabled={setStatus.isPending}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  requestStatus(application, 'accepted')
                                }}
                              >
                                Принять
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={setStatus.isPending}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  requestStatus(application, 'rejected')
                                }}
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
      )}

      <ApplicationDetailDialog
        application={selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
          }
        }}
        onAction={(status) => {
          if (selected) {
            requestStatus(selected, status)
          }
        }}
        isPending={setStatus.isPending}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
          }
        }}
        title={confirm?.status === 'cancelled' ? 'Отозвать отклик?' : 'Отклонить приглашение?'}
        description={
          confirm
            ? confirm.status === 'cancelled'
              ? `Отклик на вакансию «${confirm.application.vacancy_title}» будет отменён.`
              : `Приглашение в команду «${confirm.application.team_title}» будет отклонено.`
            : ''
        }
        confirmLabel={confirm?.status === 'cancelled' ? 'Отозвать' : 'Отклонить'}
        destructive
        isPending={setStatus.isPending}
        onConfirm={confirmAction}
      />
    </div>
  )
}
