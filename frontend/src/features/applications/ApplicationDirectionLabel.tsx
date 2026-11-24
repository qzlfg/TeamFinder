import { ArrowDownLeft, ArrowUpRight, MessageSquareText } from 'lucide-react'

import { APPLICATION_DIRECTION_LABELS, type ApplicationDirection } from '@/lib/labels'
import { cn } from '@/lib/utils'

const DIRECTION_ICONS: Record<ApplicationDirection, typeof ArrowUpRight> = {
  apply: ArrowUpRight,
  invite: ArrowDownLeft,
}

interface ApplicationDirectionLabelProps {
  direction: ApplicationDirection
  hasCoverLetter?: boolean
  className?: string
}

/** Компактная подпись направления заявки со стрелкой и индикатором письма. */
export function ApplicationDirectionLabel({
  direction,
  hasCoverLetter = false,
  className,
}: ApplicationDirectionLabelProps) {
  const Icon = DIRECTION_ICONS[direction]

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-zinc-700', className)}>
      <Icon className="size-3.5 text-zinc-400" aria-hidden="true" />
      {APPLICATION_DIRECTION_LABELS[direction]}
      {hasCoverLetter ? (
        <span title="Есть сопроводительное письмо" className="inline-flex items-center">
          <MessageSquareText className="size-3.5 text-zinc-400" aria-hidden="true" />
          <span className="sr-only">Есть сопроводительное письмо</span>
        </span>
      ) : null}
    </span>
  )
}
