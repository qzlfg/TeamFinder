import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { CalendarDays, GitBranch, Pencil, Plus, Trash2, UserMinus, Users } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplyDialog } from '@/features/applications/ApplyDialog'
import { useSetApplicationStatus } from '@/features/applications/api'
import { useSession } from '@/features/auth/session'
import { useEvent } from '@/features/events/api'
import type { ApplicationRead, VacancyRead } from '@/features/teams/api'
import {
  useDeleteTeam,
  useDeleteVacancy,
  useLeaveTeam,
  useRemoveTeamMember,
  useTeam,
  useTeamApplications,
  useTeamMembers,
  useTeamVacancies,
  useUpdateVacancy,
} from '@/features/teams/api'
import { CreateVacancyDialog } from '@/features/teams/CreateVacancyDialog'
import { EditTeamDialog } from '@/features/teams/EditTeamDialog'
import { formatDate, getInitials } from '@/lib/format'
import {
  APPLICATION_DIRECTION_LABELS,
  type ApplicationStatus,
  USER_ROLE_LABELS,
} from '@/lib/labels'

const ACTIVE_STATUSES: ApplicationStatus[] = ['pending', 'in_discussion']

/** Детальная страница команды: состав, вакансии и заявки для лидера. */
export function TeamDetailPage() {
  const { teamId } = useParams({ from: '/teams/$teamId' })
  const navigate = useNavigate()
  const { data: session } = useSession()

  const teamQuery = useTeam(teamId)
  const membersQuery = useTeamMembers(teamId)
  const vacanciesQuery = useTeamVacancies(teamId)
  const team = teamQuery.data

  const isLeader = Boolean(team && session && team.leader_id === session.id)
  const canManage = isLeader || session?.role === 'admin'
  const isMember =
    membersQuery.isSuccess &&
    (membersQuery.data.some((member) => member.user.id === session?.id) ?? false)
  const canApply = session?.role === 'member' && !isMember && team?.status === 'recruiting'

  const applicationsQuery = useTeamApplications(teamId, canManage)
  const eventQuery = useEvent(team?.event_id)

  const deleteTeam = useDeleteTeam(teamId)
  const updateVacancy = useUpdateVacancy(teamId)
  const deleteVacancy = useDeleteVacancy(teamId)
  const removeMember = useRemoveTeamMember(teamId)
  const leaveTeam = useLeaveTeam(teamId)
  const setApplicationStatus = useSetApplicationStatus()

  const [editOpen, setEditOpen] = useState(false)
  const [vacancyOpen, setVacancyOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [applyVacancy, setApplyVacancy] = useState<VacancyRead | null>(null)

  if (teamQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (teamQuery.isError || !team) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={teamQuery.error instanceof Error ? teamQuery.error.message : undefined}
          onRetry={() => void teamQuery.refetch()}
        />
        <div className="text-center">
          <Button asChild variant="outline">
            <Link to="/teams">К списку команд</Link>
          </Button>
        </div>
      </div>
    )
  }

  const members = membersQuery.data ?? []
  const vacancies = vacanciesQuery.data ?? []
  const applications = applicationsQuery.data ?? []
  const leader = members.find((member) => member.user.id === team.leader_id)

  const vacancyTitle = (vacancyId: string) =>
    vacancies.find((vacancy) => vacancy.id === vacancyId)?.title ??
    `вакансия ${vacancyId.slice(0, 8)}`

  const handleApplication = (application: ApplicationRead, status: ApplicationStatus) => {
    setApplicationStatus.mutate({ applicationId: application.id, status })
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-zinc-500">
        <Link to="/teams" className="hover:text-zinc-900">
          Команды
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-zinc-700">{team.title}</span>
      </nav>

      <PageHeader
        title={team.title}
        description={team.project_description ?? 'Описание проекта пока не заполнено.'}
        actions={
          <>
            {canManage ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Редактировать
              </Button>
            ) : null}

            {canManage ? (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Удалить
              </Button>
            ) : null}

            {canManage && team.status === 'recruiting' ? (
              <Button onClick={() => setVacancyOpen(true)}>
                <Plus className="size-4" />
                Вакансия
              </Button>
            ) : null}

            {isMember && !isLeader ? (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={leaveTeam.isPending}
                onClick={async () => {
                  await leaveTeam.mutateAsync()
                  await navigate({ to: '/teams' })
                }}
              >
                Покинуть команду
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="gap-4 py-5 shadow-none">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-semibold text-zinc-950">О команде</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 text-sm text-zinc-600">
              <p className="leading-relaxed">
                {team.project_description ?? 'Лидер ещё не добавил описание проекта.'}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  Создана {formatDate(team.created_at)}
                </span>
                {team.repository_url ? (
                  <a
                    href={team.repository_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline"
                  >
                    <GitBranch className="size-3.5" />
                    Репозиторий
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <CardTitle className="text-sm font-semibold text-zinc-950">
                Вакансии · <span className="font-mono tabular-nums">{vacancies.length}</span>
              </CardTitle>
              {canManage && team.status === 'recruiting' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                  onClick={() => setVacancyOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Добавить
                </Button>
              ) : null}
            </CardHeader>

            {vacanciesQuery.isPending ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : vacancies.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">Открытых вакансий нет.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {vacancies.map((vacancy) => (
                  <li
                    key={vacancy.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-950">{vacancy.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{vacancy.required_role}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                        {vacancy.description}
                      </p>
                    </div>

                    {canManage ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateVacancy.isPending}
                          onClick={() =>
                            updateVacancy.mutate({
                              vacancyId: vacancy.id,
                              payload: { status: 'closed' },
                            })
                          }
                        >
                          Закрыть
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-zinc-400 hover:text-destructive"
                          aria-label="Удалить вакансию"
                          disabled={deleteVacancy.isPending}
                          onClick={() => deleteVacancy.mutate(vacancy.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : canApply ? (
                      <Button size="sm" onClick={() => setApplyVacancy(vacancy)}>
                        Откликнуться
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canManage ? (
            <Card className="gap-0 py-0 shadow-none">
              <CardHeader className="border-b border-zinc-200 px-5 py-4">
                <CardTitle className="text-sm font-semibold text-zinc-950">
                  Заявки · <span className="font-mono tabular-nums">{applications.length}</span>
                </CardTitle>
              </CardHeader>

              {applicationsQuery.isPending ? (
                <div className="space-y-2 p-5">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : applicationsQuery.isError ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">
                  Не удалось загрузить заявки.
                </p>
              ) : applications.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">
                  Пока нет входящих откликов.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {applications.map((application) => {
                    const isActive = ACTIVE_STATUSES.includes(application.status)

                    return (
                      <li
                        key={application.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-950">
                            {APPLICATION_DIRECTION_LABELS[application.direction]} ·{' '}
                            <span className="font-mono text-xs text-zinc-500">
                              {application.user_id.slice(0, 8)}
                            </span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {vacancyTitle(application.vacancy_id)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={application.status} />

                          {isActive && application.direction === 'apply' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={setApplicationStatus.isPending}
                                onClick={() => handleApplication(application, 'in_discussion')}
                              >
                                В обсуждение
                              </Button>
                              <Button
                                size="sm"
                                disabled={setApplicationStatus.isPending}
                                onClick={() => handleApplication(application, 'accepted')}
                              >
                                Принять
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={setApplicationStatus.isPending}
                                onClick={() => handleApplication(application, 'rejected')}
                              >
                                Отклонить
                              </Button>
                            </>
                          ) : null}

                          {isActive && application.direction === 'invite' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={setApplicationStatus.isPending}
                              onClick={() => handleApplication(application, 'cancelled')}
                            >
                              Отозвать
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="gap-3 py-5 shadow-none">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-semibold text-zinc-950">Сводка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Статус</span>
                <StatusBadge status={team.status} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Мероприятие</span>
                {team.event_id ? (
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: team.event_id }}
                    className="max-w-40 truncate text-right font-medium text-blue-600 hover:underline"
                  >
                    {eventQuery.data?.title ?? 'Открыть мероприятие'}
                  </Link>
                ) : (
                  <span className="text-zinc-900">Пет-проект</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Лидер</span>
                <span className="max-w-40 truncate text-right text-zinc-900">
                  {leader ? `${leader.user.first_name} ${leader.user.last_name}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Участников</span>
                <span className="font-mono text-zinc-900 tabular-nums">{members.length}</span>
              </div>
              {session ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500">Ваша роль</span>
                  <span className="text-zinc-900">
                    {isLeader ? 'Лидер' : isMember ? 'Участник' : USER_ROLE_LABELS[session.role]}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <CardTitle className="text-sm font-semibold text-zinc-950">
                Состав · <span className="font-mono tabular-nums">{members.length}</span>
              </CardTitle>
              <Users className="size-4 text-zinc-400" />
            </CardHeader>

            {membersQuery.isPending ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : members.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">
                В команде пока никого нет.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {members.map((member) => (
                  <li
                    key={member.user.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-100/60"
                  >
                    <Link
                      to="/users/$userId"
                      params={{ userId: member.user.id }}
                      className="group flex min-w-0 flex-1 items-center gap-3"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="border border-zinc-200 bg-zinc-100 font-mono text-xs text-zinc-600">
                          {getInitials(member.user.first_name, member.user.last_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-950 group-hover:text-blue-600">
                          {member.user.first_name} {member.user.last_name}
                          {member.user.id === team.leader_id ? (
                            <Badge variant="outline" className="border-zinc-200 text-zinc-500">
                              Лидер
                            </Badge>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {member.role_name} · с {formatDate(member.joined_at)}
                        </p>
                      </div>
                    </Link>

                    {canManage && member.user.id !== team.leader_id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-zinc-400 hover:text-destructive"
                        aria-label="Исключить участника"
                        disabled={removeMember.isPending}
                        onClick={() => removeMember.mutate(member.user.id)}
                      >
                        <UserMinus className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!isMember && !canManage ? (
            <EmptyState
              icon={Users}
              title="Хотите в команду?"
              description="Откликнитесь на открытую вакансию — лидер увидит заявку и свяжется с вами."
            />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Удалить команду?"
        description={`Команда «${team.title}» будет расформирована: участники вернутся в поиск, вакансии и заявки удалятся.`}
        confirmLabel="Удалить команду"
        destructive
        isPending={deleteTeam.isPending}
        onConfirm={async () => {
          try {
            await deleteTeam.mutateAsync()
            await navigate({ to: '/teams' })
          } catch {
            // Ошибка уже показана тостом в src/api/client.ts.
          }
        }}
      />

      <EditTeamDialog team={team} open={editOpen} onOpenChange={setEditOpen} />
      <CreateVacancyDialog teamId={teamId} open={vacancyOpen} onOpenChange={setVacancyOpen} />

      {applyVacancy ? (
        <ApplyDialog
          vacancy={applyVacancy}
          teamTitle={team.title}
          open={Boolean(applyVacancy)}
          onOpenChange={(open) => {
            if (!open) {
              setApplyVacancy(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
