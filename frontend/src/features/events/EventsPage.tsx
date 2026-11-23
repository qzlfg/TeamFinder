import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session'
import { useEvents } from '@/features/events/api'
import { CreateEventDialog } from '@/features/events/CreateEventDialog'
import { EventCard } from '@/features/events/EventCard'
import { EventFilters } from '@/features/events/EventFilters'
import { useDebouncedValue } from '@/lib/use-debounced-value'

function EventsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((card) => (
        <div key={card} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

/** Витрина мероприятий: поиск, фильтр по типу и три состояния загрузки. */
export function EventsPage() {
  const { q = '', type } = useSearch({ from: '/events' })
  const navigate = useNavigate({ from: '/events' })
  const { data: session } = useSession()

  const [query, setQuery] = useState(q)
  const [createOpen, setCreateOpen] = useState(false)
  const debouncedQuery = useDebouncedValue(query, 300)

  const canCreate = session?.role === 'admin' || session?.role === 'mentor'

  useEffect(() => {
    setQuery(q)
  }, [q])

  useEffect(() => {
    if (debouncedQuery === q) {
      return
    }

    void navigate({
      to: '/events',
      search: (previous) => ({ ...previous, q: debouncedQuery.trim() || undefined }),
      replace: true,
    })
  }, [debouncedQuery, q, navigate])

  const { data, isPending, isError, error, refetch } = useEvents({ q, type })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Мероприятия"
        description="Хакатоны, курсы, дипломы и пет-проекты: выберите событие и соберите команду."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Создать мероприятие
            </Button>
          ) : null
        }
      />

      <EventFilters
        query={query}
        type={type}
        onQueryChange={setQuery}
        onTypeChange={(nextType) => {
          void navigate({
            to: '/events',
            search: (previous) => ({ ...previous, type: nextType }),
            replace: true,
          })
        }}
      />

      {isPending ? (
        <EventsGridSkeleton />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Ничего не найдено"
          description={
            q
              ? `По запросу «${q}» мероприятий нет. Попробуйте изменить фильтры.`
              : 'Пока нет ни одного мероприятия.'
          }
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery('')
                void navigate({ to: '/events', search: {}, replace: true })
              }}
            >
              Сбросить фильтры
            </Button>
          }
        />
      ) : (
        <>
          <p className="font-mono text-xs text-zinc-500 tabular-nums">Найдено: {data.length}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </>
      )}

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
