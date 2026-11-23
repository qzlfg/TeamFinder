import { Badge } from '@/components/ui/badge'
import type { ApplicationStatus, ParticipantStatus, TeamStatus, VacancyStatus } from '@/lib/labels'
import {
  APPLICATION_STATUS_LABELS,
  PARTICIPANT_STATUS_LABELS,
  TEAM_STATUS_LABELS,
  VACANCY_STATUS_LABELS,
} from '@/lib/labels'
import { cn } from '@/lib/utils'

type Status = TeamStatus | VacancyStatus | ApplicationStatus | ParticipantStatus

const STATUS_LABELS: Record<Status, string> = {
  ...TEAM_STATUS_LABELS,
  ...VACANCY_STATUS_LABELS,
  ...APPLICATION_STATUS_LABELS,
  ...PARTICIPANT_STATUS_LABELS,
}

const STATUS_CLASSES: Record<Status, string> = {
  recruiting: 'border-blue-200 bg-blue-50 text-blue-700',
  formed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  archived: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  open: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  closed: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  in_discussion: 'border-blue-200 bg-blue-50 text-blue-700',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelled: 'border-zinc-200 bg-zinc-100 text-zinc-500',
  searching: 'border-blue-200 bg-blue-50 text-blue-700',
  in_team: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

/** Бейдж статуса доменной сущности. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_CLASSES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
