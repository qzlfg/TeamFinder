import { Plus, Users } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/features/auth/session'
import { useMyTeams, useTeams } from '@/features/teams/api'
import { CreateTeamDialog } from '@/features/teams/CreateTeamDialog'
import { TeamCard } from '@/features/teams/TeamCard'
import type { TeamStatus } from '@/lib/labels'
import { TEAM_STATUS_LABELS } from '@/lib/labels'
import { CHIP_TRIGGER_CLASS } from '@/lib/styles'
import { cn } from '@/lib/utils'

const STATUS_TABS: { value: TeamStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'recruiting', label: TEAM_STATUS_LABELS.recruiting },
  { value: 'formed', label: TEAM_STATUS_LABELS.formed },
  { value: 'archived', label: TEAM_STATUS_LABELS.archived },
]

/** Каталог команд мероприятий и пет-проектов. */
export function TeamsPage() {
  const [status, setStatus] = useState<TeamStatus | 'all'>('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const { data: session } = useSession()

  const canUseMyTeams = session?.role === 'member'
  const myTeamsQuery = useMyTeams(undefined, canUseMyTeams)
  const { data, isPending, isError, error, refetch } = useTeams(
    status === 'all' ? undefined : status,
  )

  const canCreate = session?.role === 'member' && status !== 'archived'
  const myTeams = myTeamsQuery.data ?? []
  const myTeamsForStatus =
    status === 'all' ? myTeams : myTeams.filter((team) => team.status === status)
  const myTeamIds = new Set(myTeams.map((team) => team.id))
  const teams = onlyMine ? myTeamsForStatus : (data ?? [])

  const isListPending = onlyMine ? myTeamsQuery.isPending : isPending
  const isListError = onlyMine ? myTeamsQuery.isError : isError
  const listError = onlyMine ? myTeamsQuery.error : error

  const retry = () => {
    if (onlyMine) {
      void myTeamsQuery.refetch()
      return
    }

    void refetch()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Команды"
        description="Команды мероприятий и независимые пет-проекты с открытыми вакансиями."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Создать команду
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(value) => setStatus(value as TeamStatus | 'all')}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={CHIP_TRIGGER_CLASS}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {canUseMyTeams ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={onlyMine}
            className={cn(
              'h-8 gap-1.5 bg-white',
              onlyMine && 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50',
            )}
            onClick={() => setOnlyMine((value) => !value)}
          >
            <Users className="size-3.5" />
            Мои команды
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                onlyMine ? 'text-blue-600' : 'text-zinc-400',
              )}
            >
              {myTeamsForStatus.length}
            </span>
          </Button>
        ) : null}
      </div>

      {isListPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <div key={card} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : isListError ? (
        <ErrorState
          message={listError instanceof Error ? listError.message : undefined}
          onRetry={retry}
        />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title={onlyMine ? 'Своих команд пока нет' : 'Команд пока нет'}
          description={
            onlyMine
              ? status === 'all'
                ? 'Вы ещё не создавали команду и не вступали в неё.'
                : 'Среди ваших команд нет команд с этим статусом.'
              : 'Создайте первую команду и откройте вакансии для поиска напарников.'
          }
          action={
            onlyMine ? (
              <Button
                variant="outline"
                onClick={() => {
                  setOnlyMine(false)
                  setStatus('all')
                }}
              >
                Показать все команды
              </Button>
            ) : canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Создать команду
              </Button>
            ) : status === 'all' ? undefined : (
              <Button variant="outline" onClick={() => setStatus('all')}>
                Показать все команды
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isMyTeam={myTeamIds.has(team.id)}
              isLeader={team.leader_id === session?.id}
            />
          ))}
        </div>
      )}

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
