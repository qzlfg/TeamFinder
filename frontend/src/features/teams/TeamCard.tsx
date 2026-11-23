import { Link, useNavigate } from '@tanstack/react-router'
import { GitBranch } from 'lucide-react'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TeamRead } from '@/features/teams/api'
import { formatDate } from '@/lib/format'

interface TeamCardProps {
  team: TeamRead
}

/** Карточка команды: статус, описание и переход к деталям. */
export function TeamCard({ team }: TeamCardProps) {
  const navigate = useNavigate()

  return (
    <Card
      className="h-full cursor-pointer gap-4 py-5 shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"
      onClick={() => {
        void navigate({ to: '/teams/$teamId', params: { teamId: team.id } })
      }}
    >
      <CardHeader className="gap-3 px-5">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={team.status} />
          <span className="font-mono text-xs text-zinc-400 tabular-nums">
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

      <CardContent className="mt-auto flex items-center justify-between gap-3 px-5">
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
      </CardContent>
    </Card>
  )
}
