import { Link, useParams } from '@tanstack/react-router'
import { ExternalLink, MessageCircle } from 'lucide-react'

import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { SkillBadge } from '@/components/shared/SkillBadge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserProfile } from '@/features/users/api'
import { getInitials } from '@/lib/format'
import { USER_ROLE_LABELS } from '@/lib/labels'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 last:border-b-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-right text-sm text-zinc-900">{value}</span>
    </div>
  )
}

/** Публичный профиль участника: контакты раскрывает бэкенд через can_view_contacts. */
export function UserProfilePage() {
  const { userId } = useParams({ from: '/users/$userId' })
  const { data: user, isPending, isError, error, refetch } = useUserProfile(userId)

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={error instanceof Error ? error.message : 'Участник не найден'}
          onRetry={() => void refetch()}
        />
        <div className="text-center">
          <Button asChild variant="outline">
            <Link to="/users">К участникам</Link>
          </Button>
        </div>
      </div>
    )
  }

  const fullName = `${user.first_name} ${user.last_name}`
  const skills = user.skills ?? []

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-zinc-500">
        <Link to="/users" className="hover:text-zinc-900">
          Участники
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-zinc-700">{fullName}</span>
      </nav>

      <PageHeader
        title={fullName}
        description={`${USER_ROLE_LABELS[user.role]}${user.faculty ? ` · ${user.faculty}` : ''}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-4 py-5 shadow-none lg:col-span-2">
          <CardHeader className="px-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="border border-zinc-200 bg-zinc-100 font-mono text-sm text-zinc-600">
                  {getInitials(user.first_name, user.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="truncate text-lg font-semibold text-zinc-950">
                  {fullName}
                </CardTitle>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {user.faculty ?? 'Факультет не указан'}
                  {user.course ? ` · ${user.course} курс` : ''}
                </p>
              </div>
              <Badge variant="outline" className="ml-auto border-zinc-200 text-zinc-600">
                {USER_ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-5">
            {user.bio ? (
              <p className="text-sm leading-relaxed text-zinc-600">{user.bio}</p>
            ) : (
              <p className="text-sm text-zinc-400">Участник пока не заполнил описание.</p>
            )}

            <div>
              <InfoRow label="Факультет" value={user.faculty ?? '—'} />
              <InfoRow label="Курс" value={user.course ? `${user.course}` : '—'} />
              {user.can_view_contacts && user.group_name ? (
                <InfoRow label="Группа" value={user.group_name} />
              ) : null}
            </div>

            {user.github_url || user.portfolio_url ? (
              <div className="flex flex-wrap gap-3">
                {user.github_url ? (
                  <a
                    href={user.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    GitHub
                  </a>
                ) : null}
                {user.portfolio_url ? (
                  <a
                    href={user.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    Портфолио
                  </a>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="gap-4 py-5 shadow-none">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-semibold text-zinc-950">Навыки</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              {skills.length === 0 ? (
                <p className="text-sm text-zinc-500">Навыки не указаны.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {skills.map((skill) => (
                    <SkillBadge key={skill.id} skill={skill} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-4 py-5 shadow-none">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-semibold text-zinc-950">Контакты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5">
              {user.can_view_contacts ? (
                user.telegram_username ? (
                  <a
                    href={`https://t.me/${user.telegram_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-sm text-blue-600 hover:underline"
                  >
                    <MessageCircle className="size-4" />@{user.telegram_username}
                  </a>
                ) : (
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Участник не указал Telegram.
                  </p>
                )
              ) : (
                <p className="text-xs leading-relaxed text-zinc-500">
                  Telegram откроется, если вы в одной команде, вы администратор или между вами есть
                  активная заявка.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
