import { Search, User } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsers } from '@/features/users/api'
import { UserCard } from '@/features/users/UserCard'
import { useDebouncedValue } from '@/lib/use-debounced-value'

/** Каталог участников: поиск по имени/навыкам и переход в публичный профиль. */
export function UsersPage() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const { data, isPending, isError, error, refetch } = useUsers(debouncedQuery)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Участники"
        description="Найдите людей по имени, факультету или навыкам и пригласите в команду."
      />

      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск участников"
          aria-label="Поиск участников"
          className="bg-white pl-8"
        />
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((card) => (
            <div key={card} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={User}
          title="Участники не найдены"
          description={
            debouncedQuery
              ? `По запросу «${debouncedQuery}» никого нет. Попробуйте другой запрос.`
              : 'В каталоге пока нет участников.'
          }
          action={
            debouncedQuery ? (
              <Button variant="outline" onClick={() => setQuery('')}>
                Очистить поиск
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  )
}
