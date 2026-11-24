import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { client, unwrap } from '@/api/client'
import type { components } from '@/api/schema'
import type { EventType } from '@/lib/labels'

export type EventRead = components['schemas']['EventRead']
export type EventCreate = components['schemas']['EventCreate']

export interface EventsFilter {
  q?: string
  type?: EventType
}

/** Список мероприятий: полнотекстовый поиск при непустом запросе, иначе фильтры. */
export async function fetchEvents({ q, type }: EventsFilter): Promise<EventRead[]> {
  const search = q?.trim() ?? ''

  if (search.length > 0) {
    const result = await client.GET('/api/v1/events/search', {
      params: { query: { q: search } },
    })
    const events = unwrap(result)
    return type ? events.filter((event) => event.event_type === type) : events
  }

  const result = await client.GET('/api/v1/events', {
    params: {
      query: {
        event_type: type ? [type] : undefined,
        limit: 50,
      },
    },
  })

  return unwrap(result)
}

export function useEvents(filter: EventsFilter) {
  return useQuery({
    queryKey: ['events', filter],
    queryFn: () => fetchEvents(filter),
    staleTime: 30_000,
  })
}

/** Одиночное мероприятие — для заголовка команды и деталей. */
export function useEvent(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ['events', 'detail', eventId],
    queryFn: async () => {
      const result = await client.GET('/api/v1/events/{event_id}', {
        params: { path: { event_id: eventId as string } },
      })
      return unwrap(result)
    },
    enabled: Boolean(eventId),
    staleTime: 60_000,
  })
}

/** POST /events — доступно администратору и ментору. */
export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: EventCreate) => {
      const result = await client.POST('/api/v1/events', { body: payload })
      return unwrap(result)
    },
    onSuccess: (event) => {
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Мероприятие создано', { description: event.title })
    },
  })
}

export type EventParticipantRead = components['schemas']['EventParticipantRead']

/** Команды конкретного мероприятия. */
export function useEventTeams(eventId: string) {
  return useQuery({
    queryKey: ['events', 'teams', eventId],
    queryFn: async () => {
      const result = await client.GET('/api/v1/events/{event_id}/teams', {
        params: { path: { event_id: eventId }, query: { limit: 50 } },
      })
      return unwrap(result)
    },
    enabled: Boolean(eventId),
  })
}

/** Открытые вакансии всех команд мероприятия. */
export function useEventVacancies(eventId: string) {
  return useQuery({
    queryKey: ['events', 'vacancies', eventId],
    queryFn: async () => {
      const result = await client.GET('/api/v1/events/{event_id}/vacancies', {
        params: { path: { event_id: eventId }, query: { limit: 50 } },
      })
      return unwrap(result)
    },
    enabled: Boolean(eventId),
  })
}

/** Участники мероприятия в заданном статусе (searching / in_team). */
export function useEventParticipants(eventId: string, status: 'searching' | 'in_team') {
  return useQuery({
    queryKey: ['events', 'participants', eventId, status],
    queryFn: async () => {
      const result = await client.GET('/api/v1/events/{event_id}/participants', {
        params: { path: { event_id: eventId }, query: { status, limit: 100 } },
      })
      return unwrap(result)
    },
    enabled: Boolean(eventId),
  })
}

/** Регистрация соло-участником мероприятия. */
export function useJoinEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (desiredRole: string | null) => {
      const result = await client.POST('/api/v1/events/{event_id}/participants', {
        params: { path: { event_id: eventId } },
        body: { desired_role: desiredRole },
      })
      return unwrap(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Вы участвуете в мероприятии', {
        description: 'Теперь можно откликаться на вакансии и создать команду.',
      })
    },
  })
}

/** Выход из мероприятия (пока не в команде). */
export function useLeaveEvent(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await client.DELETE('/api/v1/events/{event_id}/participants/me', {
        params: { path: { event_id: eventId } },
      })
      unwrap(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Вы больше не участвуете в мероприятии')
    },
  })
}
