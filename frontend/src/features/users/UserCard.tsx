import { Link } from '@tanstack/react-router'
import { SkillBadge } from '@/components/shared/SkillBadge'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UserPublicRead } from '@/features/users/api'
import { getInitials } from '@/lib/format'
import { USER_ROLE_LABELS } from '@/lib/labels'

interface UserCardProps {
  user: UserPublicRead
}

/** Карточка участника в каталоге: без Telegram, переход в публичный профиль. */
export function UserCard({ user }: UserCardProps) {
  const skills = user.skills ?? []

  return (
    <Card className="h-full gap-4 py-5 shadow-none">
      <CardHeader className="gap-3 px-5">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="border border-zinc-200 bg-zinc-100 font-mono text-xs text-zinc-600">
              {getInitials(user.first_name, user.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-semibold">
              <Link
                to="/users/$userId"
                params={{ userId: user.id }}
                className="text-zinc-950 hover:text-blue-600"
              >
                {user.first_name} {user.last_name}
              </Link>
            </CardTitle>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {[user.faculty, user.course ? `${user.course} курс` : null]
                .filter(Boolean)
                .join(' · ') || USER_ROLE_LABELS[user.role]}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 border-zinc-200 text-zinc-500">
            {USER_ROLE_LABELS[user.role]}
          </Badge>
        </div>

        {user.bio ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">{user.bio}</p>
        ) : null}
      </CardHeader>

      <CardContent className="mt-auto space-y-3 px-5">
        <div className="flex flex-wrap gap-1">
          {skills.length === 0 ? (
            <span className="text-xs text-zinc-400">Навыки не указаны</span>
          ) : (
            skills.slice(0, 4).map((skill) => <SkillBadge key={skill.id} skill={skill} />)
          )}
        </div>

        <Link
          to="/users/$userId"
          params={{ userId: user.id }}
          className="inline-block text-xs font-medium text-blue-600 hover:underline"
        >
          Открыть профиль
        </Link>
      </CardContent>
    </Card>
  )
}
