import { useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { CalendarDays, Plus, UserPlus, Users } from 'lucide-react'
import { type ReactNode, useState } from 'react'

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
import { type ApplicationRead, useMyApplications } from '@/features/applications/api'
import { useSession } from '@/features/auth/session'
import {
  useEvent,
  useEventParticipants,
  useEventTeams,
  useEventVacancies,
  useLeaveEvent,
} from '@/features/events/api'
import { JoinEventDialog } from '@/features/events/JoinEventDialog'
import type { TeamRead, VacancyRead } from '@/features/teams/api'
import { deleteTeamRequest, leaveTeamRequest, useMyTeams } from '@/features/teams/api'
import { CreateTeamDialog } from '@/features/teams/CreateTeamDialog'
import { TeamCard } from '@/features/teams/TeamCard'
import { VacancySkillsList } from '@/features/teams/VacancySkillsList'
import type { UserPublicRead } from '@/features/users/api'
import { formatDate, getInitials } from '@/lib/format'
import type { ParticipantStatus } from '@/lib/labels'
import { EVENT_TYPE_LABELS, PARTICIPANT_STATUS_LABELS } from '@/lib/labels'

interface ParticipantRowProps {
  participantId: string
  user: UserPublicRead
  desiredRole: string | null
  status: ParticipantStatus
}

function ParticipantRow({ participantId, user, desiredRole, status }: ParticipantRowProps) {
  const fullName = `${user.first_name} ${user.last_name}`

  return (
    <li className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-100/60">
      <Link
        to="/users/$userId"
        params={{ userId: participantId }}
        className="group flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar className="size-8">
          <AvatarFallback className="border border-zinc-200 bg-zinc-100 font-mono text-xs text-zinc-600">
            {getInitials(user.first_name, user.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-950 group-hover:text-blue-600">
            {fullName}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {desiredRole ? `Роль: ${desiredRole}` : 'Роль не указана'}
          </p>
        </div>
      </Link>
      <Badge variant="outline" className="border-zinc-200 font-medium text-zinc-600">
        {PARTICIPANT_STATUS_LABELS[status]}
      </Badge>
    </li>
  )
}

/** Детальная страница мероприятия: команды, вакансии и участники. */
export function EventDetailPage() {
  const { eventId } = useParams({ from: '/events/$eventId' })
  const { data: session } = useSession()

  const eventQuery = useEvent(eventId)
  const teamsQuery = useEventTeams(eventId)
  const vacanciesQuery = useEventVacancies(eventId)
  const searchingQuery = useEventParticipants(eventId, 'searching')
  const inTeamQuery = useEventParticipants(eventId, 'in_team')
  const leaveEvent = useLeaveEvent(eventId)
  const myApplicationsQuery = useMyApplications()

  const queryClient = useQueryClient()

  const participantsForMembership = [...(searchingQuery.data ?? []), ...(inTeamQuery.data ?? [])]
  const myParticipation = participantsForMembership.find(
    (participant) => participant.participant_id === session?.id,
  )
  const ledTeam = teamsQuery.data?.find((team) => team.leader_id === session?.id)
  const myTeamsQuery = useMyTeams(eventId, session?.role === 'member')
  const myTeam = myTeamsQuery.data?.find((team) => team.event_id === eventId) ?? ledTeam

  const [joinOpen, setJoinOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState<TeamRead | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [applyVacancy, setApplyVacancy] = useState<VacancyRead | null>(null)
  const [applyTeamTitle, setApplyTeamTitle] = useState('')

  if (eventQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={eventQuery.error instanceof Error ? eventQuery.error.message : undefined}
          onRetry={() => void eventQuery.refetch()}
        />
        <div className="text-center">
          <Button asChild variant="outline">
            <Link to="/events">К мероприятиям</Link>
          </Button>
        </div>
      </div>
    )
  }

  const event = eventQuery.data
  const teams = teamsQuery.data ?? []
  const vacancies = vacanciesQuery.data ?? []
  const participants = participantsForMembership
  const userSkillIds = new Set((session?.skills ?? []).map((skill) => skill.id))
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const activeApplicationsByVacancy = new Map<string, ApplicationRead>()
  for (const application of myApplicationsQuery.data ?? []) {
    if (application.status === 'pending' || application.status === 'in_discussion') {
      activeApplicationsByVacancy.set(application.vacancy_id, application)
    }
  }
  const sortedTeams = myTeam
    ? [...teams].sort((a, b) => {
        if (a.id === myTeam.id) return -1
        if (b.id === myTeam.id) return 1
        return 0
      })
    : teams
  const isMyTeamLeader = Boolean(myTeam && myTeam.leader_id === session?.id)

  const deadlinePassed = event.registration_deadline
    ? new Date(event.registration_deadline).getTime() < Date.now()
    : false
  const canParticipate = event.is_active && !deadlinePassed
  const isPlatformMember = session?.role === 'member'
  const canJoin = isPlatformMember && canParticipate && !myParticipation
  const canLeave = Boolean(myParticipation)
  const isLeaveTargetLeader = Boolean(leaveTarget && leaveTarget.leader_id === session?.id)
  const canCreateTeam = isPlatformMember && canParticipate && myParticipation?.status !== 'in_team'

  const openApplyDialog = (vacancy: VacancyRead) => {
    setApplyTeamTitle(teamById.get(vacancy.team_id)?.title ?? 'Команда')
    setApplyVacancy(vacancy)
  }

  const handleLeaveClick = () => {
    if (myParticipation?.status === 'searching') {
      leaveEvent.mutate()
      return
    }

    setLeaveTarget(myTeam ?? null)
    setLeaveOpen(true)
  }

  const searching = searchingQuery.data ?? []
  const inTeam = inTeamQuery.data ?? []

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-zinc-500">
        <Link to="/events" className="hover:text-zinc-900">
          Мероприятия
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-zinc-700">{event.title}</span>
      </nav>

      <PageHeader
        title={event.title}
        description={event.description}
        actions={
          <>
            {canJoin ? (
              <Button onClick={() => setJoinOpen(true)}>
                <UserPlus className="size-4" />
                Участвовать
              </Button>
            ) : null}

            {canLeave ? (
              <Button variant="outline" disabled={leaveEvent.isPending} onClick={handleLeaveClick}>
                Покинуть мероприятие
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <CardTitle className="text-sm font-semibold text-zinc-950">
                Команды · <span className="font-mono tabular-nums">{teams.length}</span>
              </CardTitle>
              {canCreateTeam && teams.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                  onClick={() => setTeamOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Создать
                </Button>
              ) : null}
            </CardHeader>

            <CardContent className="px-5 py-4">
              {teamsQuery.isPending ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : teams.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Команд пока нет"
                  description="Станьте первым, кто соберёт команду под это мероприятие."
                  action={
                    canCreateTeam ? (
                      <Button onClick={() => setTeamOpen(true)}>
                        <Plus className="size-4" />
                        Создать команду
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sortedTeams.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      isMyTeam={team.id === myTeam?.id}
                      isLeader={team.leader_id === session?.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b border-zinc-200 px-5 py-4">
              <CardTitle className="text-sm font-semibold text-zinc-950">
                Открытые вакансии ·{' '}
                <span className="font-mono tabular-nums">{vacancies.length}</span>
              </CardTitle>
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
                {vacancies.map((vacancy) => {
                  const team = teamById.get(vacancy.team_id)
                  const application = activeApplicationsByVacancy.get(vacancy.id)
                  const isMyTeamVacancy = vacancy.team_id === myTeam?.id

                  let action: ReactNode = null

                  if (isMyTeamVacancy) {
                    action = (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/teams/$teamId" params={{ teamId: vacancy.team_id }}>
                          Управлять →
                        </Link>
                      </Button>
                    )
                  } else if (myParticipation?.status === 'in_team') {
                    action = <span className="text-xs text-zinc-500">Вы уже в команде</span>
                  } else if (application) {
                    action =
                      application.direction === 'invite' ? (
                        <Link
                          to="/applications"
                          className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Вас пригласили →
                        </Link>
                      ) : (
                        <StatusBadge status={application.status} />
                      )
                  } else if (isPlatformMember && canParticipate) {
                    action = (
                      <Button size="sm" onClick={() => openApplyDialog(vacancy)}>
                        Откликнуться
                      </Button>
                    )
                  }

                  return (
                    <li
                      key={vacancy.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-950">{vacancy.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
                            {vacancy.required_role}
                          </span>
                          <span aria-hidden="true">·</span>
                          {team ? (
                            <Link
                              to="/teams/$teamId"
                              params={{ teamId: team.id }}
                              className="text-blue-600 hover:underline"
                            >
                              {team.title}
                            </Link>
                          ) : (
                            'Команда'
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                          {vacancy.description}
                        </p>
                        <VacancySkillsList skills={vacancy.skills} userSkillIds={userSkillIds} />
                      </div>

                      {action}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b border-zinc-200 px-5 py-4">
              <CardTitle className="text-sm font-semibold text-zinc-950">
                Участники · <span className="font-mono tabular-nums">{participants.length}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5 px-5 py-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Ищут команду · <span className="font-mono tabular-nums">{searching.length}</span>
                </p>
                {searchingQuery.isPending ? (
                  <Skeleton className="mt-2 h-12 w-full" />
                ) : searching.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">Пока никто не ищет команду.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                    {searching.map((participant) => (
                      <ParticipantRow
                        key={participant.id}
                        participantId={participant.participant_id}
                        user={participant.user}
                        desiredRole={participant.desired_role}
                        status={participant.status}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  В команде · <span className="font-mono tabular-nums">{inTeam.length}</span>
                </p>
                {inTeamQuery.isPending ? (
                  <Skeleton className="mt-2 h-12 w-full" />
                ) : inTeam.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">Пока никто не в команде.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                    {inTeam.map((participant) => (
                      <ParticipantRow
                        key={participant.id}
                        participantId={participant.participant_id}
                        user={participant.user}
                        desiredRole={participant.desired_role}
                        status={participant.status}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {myTeam ? (
            <Card className="gap-4 py-5 shadow-none">
              <CardHeader className="px-5">
                <CardTitle className="text-sm font-semibold text-zinc-950">Моя команда</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/teams/$teamId"
                    params={{ teamId: myTeam.id }}
                    className="min-w-0 truncate text-sm font-medium text-zinc-950 hover:text-blue-600"
                  >
                    {myTeam.title}
                  </Link>
                  <StatusBadge status={myTeam.status} />
                </div>
                <p className="text-xs text-zinc-500">
                  Ваша роль: {isMyTeamLeader ? 'Лидер' : 'Участник'}
                </p>
                <Button asChild className="w-full">
                  <Link to="/teams/$teamId" params={{ teamId: myTeam.id }}>
                    Управлять командой
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="gap-3 py-5 shadow-none">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-semibold text-zinc-950">О мероприятии</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Тип</span>
                <Badge variant="secondary">{EVENT_TYPE_LABELS[event.event_type]}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Статус</span>
                <Badge
                  variant="outline"
                  className={
                    event.is_active
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                  }
                >
                  {event.is_active ? 'Активно' : 'Завершено'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Размер команды</span>
                <span className="font-mono text-zinc-900 tabular-nums">
                  {event.min_team_size}–{event.max_team_size}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Дедлайн</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-zinc-900 tabular-nums">
                  <CalendarDays className="size-3.5 text-zinc-400" />
                  {formatDate(event.registration_deadline)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">Создано</span>
                <span className="font-mono text-zinc-900 tabular-nums">
                  {formatDate(event.created_at)}
                </span>
              </div>
              {myParticipation ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Вы участвуете: {PARTICIPANT_STATUS_LABELS[myParticipation.status].toLowerCase()}
                  {myParticipation.desired_role ? ` · ${myParticipation.desired_role}` : ''}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={(open) => {
          setLeaveOpen(open)
          if (!open) {
            setLeaveTarget(null)
          }
        }}
        title="Покинуть мероприятие?"
        description={
          leaveTarget
            ? isLeaveTargetLeader
              ? `Вы лидер команды «${leaveTarget.title}». Команда будет удалена, а вы выйдете из мероприятия.`
              : `Вы состоите в команде «${leaveTarget.title}». Вы покинете команду и мероприятие.`
            : 'Вы выйдете из списка участников мероприятия.'
        }
        confirmLabel="Покинуть"
        destructive
        isPending={leaving || leaveEvent.isPending}
        onConfirm={async () => {
          setLeaving(true)
          try {
            if (leaveTarget) {
              if (isLeaveTargetLeader) {
                await deleteTeamRequest(leaveTarget.id)
              } else {
                await leaveTeamRequest(leaveTarget.id)
              }

              void queryClient.invalidateQueries({ queryKey: ['teams'] })
              void queryClient.invalidateQueries({ queryKey: ['session'] })
            }

            await leaveEvent.mutateAsync()
            setLeaveOpen(false)
            setLeaveTarget(null)
          } catch {
            // Ошибка уже показана тостом в src/api/client.ts.
          } finally {
            setLeaving(false)
          }
        }}
      />

      <JoinEventDialog
        eventId={event.id}
        eventTitle={event.title}
        open={joinOpen}
        onOpenChange={setJoinOpen}
      />

      <CreateTeamDialog open={teamOpen} onOpenChange={setTeamOpen} initialEventId={event.id} />

      {applyVacancy ? (
        <ApplyDialog
          vacancy={applyVacancy}
          teamTitle={applyTeamTitle}
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
