import { Plus, Users } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/features/auth/session'
import { useTeams } from '@/features/teams/api'
import { CreateTeamDialog } from '@/features/teams/CreateTeamDialog'
import { TeamCard } from '@/features/teams/TeamCard'
import type { TeamStatus } from '@/lib/labels'
import { TEAM_STATUS_LABELS } from '@/lib/labels'
import { CHIP_TRIGGER_CLASS } from '@/lib/styles'

const STATUS_TABS: { value: TeamStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'recruiting', label: TEAM_STATUS_LABELS.recruiting },
  { value: 'formed', label: TEAM_STATUS_LABELS.formed },
  { value: 'archived', label: TEAM_STATUS_LABELS.archived },
]

/** Каталог команд мероприятий и пет-проектов. */
export function TeamsPage() {
  const [status, setStatus] = useState<TeamStatus | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const { data: session } = useSession()
  const { data, isPending, isError, error, refetch } = useTeams(
    status === 'all' ? undefined : status,
  )

  const canCreate = session?.role === 'member' && status !== 'archived'

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

      <Tabs value={status} onValueChange={(value) => setStatus(value as TeamStatus | 'all')}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={CHIP_TRIGGER_CLASS}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <div key={card} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Команд пока нет"
          description="Создайте первую команду и откройте вакансии для поиска напарников."
          action={
            canCreate ? (
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
          {data.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
