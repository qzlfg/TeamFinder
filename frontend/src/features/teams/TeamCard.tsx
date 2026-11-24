import { Link, useNavigate } from '@tanstack/react-router'
import { FileText, GitBranch, Users } from 'lucide-react'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TeamRead } from '@/features/teams/api'
import { formatDate, pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'

interface TeamCardProps {
  team: TeamRead
  isMyTeam?: boolean
  isLeader?: boolean
}

/** Карточка команды: статус, описание и переход к деталям. */
export function TeamCard({ team, isMyTeam = false, isLeader = false }: TeamCardProps) {
  const navigate = useNavigate()
  const isMine = isMyTeam || isLeader

  return (
    <Card
      className={cn(
        'h-full cursor-pointer gap-4 py-5 shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300',
        isMine && 'border-blue-200 bg-blue-50/20',
      )}
      onClick={() => {
        void navigate({ to: '/teams/$teamId', params: { teamId: team.id } })
      }}
    >
      <CardHeader className="gap-3 px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={team.status} />
            {isMine ? (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                {isLeader ? 'Вы лидер' : 'Моя команда'}
              </Badge>
            ) : null}
          </div>
          <span className="shrink-0 font-mono text-xs text-zinc-400 tabular-nums">
            {formatDate(team.created_at)}
          </span>
        </div>
        <CardTitle className="text-base leading-snug font-semibold">
          <Link
            to="/teams/$teamId"
            params={{ teamId: team.id }}
            className="text-zinc-950 hover:text-blue-600"
            onClick={(event) => event.stopPropagation()}
          >
            {team.title}
          </Link>
        </CardTitle>
        {team.project_description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">
            {team.project_description}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="mt-auto space-y-3 px-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            <span className="font-mono text-zinc-700 tabular-nums">{team.members_count}</span>
            {pluralize(team.members_count, 'участник', 'участника', 'участников')}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" />
            <span className="font-mono text-zinc-700 tabular-nums">
              {team.open_vacancies_count}
            </span>
            {pluralize(team.open_vacancies_count, 'вакансия', 'вакансии', 'вакансий')}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          {team.repository_url ? (
            <a
              href={team.repository_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
              onClick={(event) => event.stopPropagation()}
            >
              <GitBranch className="size-3.5" />
              Репозиторий
            </a>
          ) : (
            <span className="text-xs text-zinc-400">Без репозитория</span>
          )}

          <Link
            to="/teams/$teamId"
            params={{ teamId: team.id }}
            className="text-xs font-medium text-blue-600 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Открыть
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
