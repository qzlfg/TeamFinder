import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { client, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type NotificationRead = components['schemas']['NotificationRead']

async function fetchUnreadCount(): Promise<number> {
  const result = await client.GET('/api/v1/notifications/unread-count')
  return unwrap(result).unread_count
}

async function fetchNotifications(): Promise<NotificationRead[]> {
  const result = await client.GET('/api/v1/notifications', {
    params: { query: { limit: 20 } },
  })
  return unwrap(result)
}

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    enabled,
    refetchInterval: 60_000,
  })
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: fetchNotifications,
    enabled,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await client.PATCH('/api/v1/notifications/{notification_id}/read', {
        params: { path: { notification_id: notificationId } },
      })
      return unwrap(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await client.PATCH('/api/v1/notifications/read-all')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
