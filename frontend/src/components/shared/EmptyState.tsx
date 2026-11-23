import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
}

/** Пустое состояние списка с целевым действием. */
export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-950">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
