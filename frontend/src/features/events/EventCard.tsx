import { Link } from '@tanstack/react-router'
import { CalendarDays, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EventRead } from '@/features/events/api'
import { formatDate } from '@/lib/format'
import { EVENT_TYPE_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

interface EventCardProps {
  event: EventRead
}

/** Карточка мероприятия: клик по всей карточке открывает детальную страницу. */
export function EventCard({ event }: EventCardProps) {
  const isFinished = !event.is_active

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="group block h-full rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      <Card
        className={cn(
          'h-full gap-4 py-5 shadow-none transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-zinc-300 group-hover:shadow-sm',
          isFinished && 'opacity-70',
        )}
      >
        <CardHeader className="gap-3 px-5">
          <div className="flex items-start justify-between gap-3">
            <Badge variant="secondary" className="font-medium">
              {EVENT_TYPE_LABELS[event.event_type]}
            </Badge>
            {isFinished ? (
              <Badge variant="outline" className="border-zinc-200 text-zinc-500">
                Завершено
              </Badge>
            ) : null}
          </div>
          <CardTitle className="text-base leading-snug font-semibold text-zinc-950 group-hover:text-blue-600">
            {event.title}
          </CardTitle>
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">{event.description}</p>
        </CardHeader>

        <CardContent className="mt-auto space-y-2 px-5">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Users className="size-3.5 shrink-0" />
            <span>
              Команда:{' '}
              <span className="font-mono text-zinc-700 tabular-nums">
                {event.min_team_size}–{event.max_team_size}
              </span>{' '}
              чел.
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <CalendarDays className="size-3.5 shrink-0" />
            <span>
              Дедлайн:{' '}
              <span className="font-mono text-zinc-700 tabular-nums">
                {formatDate(event.registration_deadline)}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
