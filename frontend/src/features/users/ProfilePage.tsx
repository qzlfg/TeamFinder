import { ExternalLink, Pencil } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/shared/PageHeader'
import { SkillBadge } from '@/components/shared/SkillBadge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChangeEmailDialog } from '@/features/auth/ChangeEmailDialog'
import { useSession } from '@/features/auth/session'
import { formatDate, getInitials } from '@/lib/format'
import { USER_ROLE_LABELS } from '@/lib/labels'
import { EditProfileDialog } from './EditProfileDialog'
import { SkillsEditor } from './SkillsEditor'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 last:border-b-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-right text-sm text-zinc-900">{value}</span>
    </div>
  )
}

/** Профиль текущего пользователя: просмотр и редактирование анкеты и навыков. */
export function ProfilePage() {
  const { data: user, isPending } = useSession()
  const [editOpen, setEditOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  if (isPending || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const skills = user.skills ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Профиль"
        description="Ваши данные видят другие участники в каталоге."
        actions={
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Редактировать
          </Button>
        }
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
                  {user.first_name} {user.last_name}
                </CardTitle>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="truncate text-sm text-zinc-500">{user.email}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-blue-600 hover:text-blue-700"
                    onClick={() => setEmailOpen(true)}
                  >
                    Изменить
                  </Button>
                </div>
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
              <p className="text-sm text-zinc-400">Добавьте короткое описание о себе.</p>
            )}

            <div>
              <InfoRow label="Факультет" value={user.faculty ?? '—'} />
              <InfoRow label="Курс" value={user.course ? `${user.course}` : '—'} />
              <InfoRow label="Группа" value={user.group_name ?? '—'} />
              <InfoRow
                label="Telegram"
                value={user.telegram_username ? `@${user.telegram_username}` : '—'}
              />
              <InfoRow label="В TeamFinder с" value={formatDate(user.created_at)} />
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

        <Card className="gap-4 py-5 shadow-none">
          <CardHeader className="flex items-center justify-between px-5">
            <CardTitle className="text-sm font-semibold text-zinc-950">Навыки</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
              onClick={() => setSkillsOpen(true)}
            >
              Изменить
            </Button>
          </CardHeader>
          <CardContent className="px-5">
            {skills.length === 0 ? (
              <p className="text-sm text-zinc-500">Навыки пока не добавлены.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {skills.map((skill) => (
                  <SkillBadge key={skill.id} skill={skill} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ChangeEmailDialog open={emailOpen} onOpenChange={setEmailOpen} />
      <EditProfileDialog user={user} open={editOpen} onOpenChange={setEditOpen} />
      <SkillsEditor user={user} open={skillsOpen} onOpenChange={setSkillsOpen} />
    </div>
  )
}
