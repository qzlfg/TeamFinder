import { useQueries } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { CalendarDays, Plus, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplyDialog } from '@/features/applications/ApplyDialog'
import { useSession } from '@/features/auth/session'
import {
  useEvent,
  useEventParticipants,
  useEventTeams,
  useEventVacancies,
  useLeaveEvent,
} from '@/features/events/api'
import { JoinEventDialog } from '@/features/events/JoinEventDialog'
import type { VacancyRead } from '@/features/teams/api'
import { fetchTeamMembers, useDeleteTeam, useLeaveTeam } from '@/features/teams/api'
import { CreateTeamDialog } from '@/features/teams/CreateTeamDialog'
import { TeamCard } from '@/features/teams/TeamCard'
import { useUsers } from '@/features/users/api'
import { formatDate, getInitials } from '@/lib/format'
import type { ParticipantStatus } from '@/lib/labels'
import { EVENT_TYPE_LABELS, PARTICIPANT_STATUS_LABELS } from '@/lib/labels'

interface ParticipantRowProps {
  participantId: string
  fullName: string
  desiredRole: string | null
  status: ParticipantStatus
}

function ParticipantRow({ participantId, fullName, desiredRole, status }: ParticipantRowProps) {
  const [firstName = '', lastName = ''] = fullName.split(' ')

  return (
    <li className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-100/60">
      <Link
        to="/users/$userId"
        params={{ userId: participantId }}
        className="group flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar className="size-8">
          <AvatarFallback className="border border-zinc-200 bg-zinc-100 font-mono text-xs text-zinc-600">
            {getInitials(firstName, lastName)}
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
  const { data: users = [] } = useUsers('')
  const leaveEvent = useLeaveEvent(eventId)

  const teamsForMembership = teamsQuery.data ?? []
  const memberQueries = useQueries({
    queries: teamsForMembership.map((team) => ({
      queryKey: ['teams', 'members', team.id],
      queryFn: () => fetchTeamMembers(team.id),
      staleTime: 30_000,
    })),
  })
  const myTeam = teamsForMembership.find((_team, index) =>
    memberQueries[index]?.data?.some((member) => member.user.id === session?.id),
  )
  const isMyTeamLeader = Boolean(myTeam && myTeam.leader_id === session?.id)
  const leaveTeam = useLeaveTeam(myTeam?.id ?? '')
  const deleteTeam = useDeleteTeam(myTeam?.id ?? '')

  const [joinOpen, setJoinOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
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
  const participants = [...(searchingQuery.data ?? []), ...(inTeamQuery.data ?? [])]
  const usersById = new Map(users.map((user) => [user.id, user]))
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const myParticipation = participants.find(
    (participant) => participant.participant_id === session?.id,
  )

  const deadlinePassed = event.registration_deadline
    ? new Date(event.registration_deadline).getTime() < Date.now()
    : false
  const canParticipate = event.is_active && !deadlinePassed
  const isPlatformMember = session?.role === 'member'
  const canJoin = isPlatformMember && canParticipate && !myParticipation
  const canLeave = Boolean(myParticipation && (myParticipation.status === 'searching' || myTeam))
  const canCreateTeam = isPlatformMember && canParticipate && myParticipation?.status !== 'in_team'

  const openApplyDialog = (vacancy: VacancyRead) => {
    setApplyTeamTitle(teamById.get(vacancy.team_id)?.title ?? 'Команда')
    setApplyVacancy(vacancy)
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
              <Button
                variant="outline"
                disabled={leaveEvent.isPending}
                onClick={() => {
                  if (myParticipation?.status === 'searching') {
                    leaveEvent.mutate()
                    return
                  }

                  setLeaveOpen(true)
                }}
              >
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
                  {teams.map((team) => (
                    <TeamCard key={team.id} team={team} />
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

                  return (
                    <li
                      key={vacancy.id}
                      className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-950">{vacancy.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {vacancy.required_role} ·{' '}
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
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                          {vacancy.description}
                        </p>
                      </div>

                      {isPlatformMember && canParticipate ? (
                        <Button size="sm" onClick={() => openApplyDialog(vacancy)}>
                          Откликнуться
                        </Button>
                      ) : null}
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
                    {searching.map((participant) => {
                      const user = usersById.get(participant.participant_id)
                      const fullName = user
                        ? `${user.first_name} ${user.last_name}`
                        : `Участник ${participant.participant_id.slice(0, 8)}`

                      return (
                        <ParticipantRow
                          key={participant.id}
                          participantId={participant.participant_id}
                          fullName={fullName}
                          desiredRole={participant.desired_role}
                          status={participant.status}
                        />
                      )
                    })}
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
                    {inTeam.map((participant) => {
                      const user = usersById.get(participant.participant_id)
                      const fullName = user
                        ? `${user.first_name} ${user.last_name}`
                        : `Участник ${participant.participant_id.slice(0, 8)}`

                      return (
                        <ParticipantRow
                          key={participant.id}
                          participantId={participant.participant_id}
                          fullName={fullName}
                          desiredRole={participant.desired_role}
                          status={participant.status}
                        />
                      )
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
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
                  {myTeam ? (
                    <span className="mt-1 block">
                      Моя команда:{' '}
                      <Link
                        to="/teams/$teamId"
                        params={{ teamId: myTeam.id }}
                        className="font-medium underline underline-offset-2"
                      >
                        {myTeam.title}
                      </Link>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Покинуть мероприятие?"
        description={
          myTeam
            ? isMyTeamLeader
              ? `Вы лидер команды «${myTeam.title}». Команда будет удалена, а вы выйдете из мероприятия.`
              : `Вы состоите в команде «${myTeam.title}». Вы покинете команду и мероприятие.`
            : 'Вы выйдете из списка участников мероприятия.'
        }
        confirmLabel="Покинуть"
        destructive
        isPending={leaveEvent.isPending || leaveTeam.isPending || deleteTeam.isPending}
        onConfirm={async () => {
          try {
            if (myTeam) {
              if (isMyTeamLeader) {
                await deleteTeam.mutateAsync()
              } else {
                await leaveTeam.mutateAsync()
              }
            }

            await leaveEvent.mutateAsync()
            setLeaveOpen(false)
          } catch {
            // Ошибка уже показана тостом в src/api/client.ts.
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
