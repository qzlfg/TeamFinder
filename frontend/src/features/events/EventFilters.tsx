import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EventType } from '@/lib/labels'
import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER } from '@/lib/labels'
import { CHIP_TRIGGER_CLASS } from '@/lib/styles'

interface EventFiltersProps {
  query: string
  type?: EventType
  onQueryChange: (query: string) => void
  onTypeChange: (type?: EventType) => void
}

/** Панель фильтров: поиск по названию и тип мероприятия. */
export function EventFilters({ query, type, onQueryChange, onTypeChange }: EventFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по названию"
          aria-label="Поиск мероприятий"
          className="bg-white pl-8"
        />
      </div>

      <Tabs
        value={type ?? 'all'}
        onValueChange={(value) => onTypeChange(value === 'all' ? undefined : (value as EventType))}
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="all" className={CHIP_TRIGGER_CLASS}>
            Все
          </TabsTrigger>
          {EVENT_TYPE_ORDER.map((eventType) => (
            <TabsTrigger key={eventType} value={eventType} className={CHIP_TRIGGER_CLASS}>
              {EVENT_TYPE_LABELS[eventType]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
