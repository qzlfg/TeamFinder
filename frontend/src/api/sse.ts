import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { API_BASE_URL, refreshSession } from './client'
import type { components } from './schema'

type NotificationRead = components['schemas']['NotificationRead']

/**
 * Подписка на поток уведомлений через SSE.
 * Открывается только для авторизованного пользователя; переподключение —
 * с задержкой, при 401 поток закрывается без тоста.
 */
export function useNotificationsStream(enabled: boolean): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()

    void fetchEventSource(`${API_BASE_URL}/api/v1/notifications/stream`, {
      credentials: 'include',
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
      openWhenHidden: true,
      async onopen(response) {
        if (response.status === 401) {
          const refreshed = await refreshSession()

          if (refreshed) {
            throw new Error('sse-retry')
          }

          throw new Error('unauthorized')
        }

        if (!response.ok) {
          throw new Error(`sse-${response.status}`)
        }
      },
      onmessage(event) {
        if (event.event !== 'notification') {
          return
        }

        let notification: NotificationRead | null = null

        try {
          notification = JSON.parse(event.data) as NotificationRead
        } catch {
          notification = null
        }

        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        void queryClient.invalidateQueries({ queryKey: ['applications'] })
        void queryClient.invalidateQueries({ queryKey: ['teams'] })

        if (notification) {
          toast(notification.title, { description: notification.message })
        }
      },
      onerror(error) {
        if (error instanceof Error && error.message === 'unauthorized') {
          throw error
        }

        if (error instanceof Error && error.message === 'sse-retry') {
          return 1000
        }

        return 5000
      },
    }).catch(() => {
      // Поток закрыт (разлогин, размонтирование или потеря сети) — тихо выходим.
    })

    return () => {
      controller.abort()
    }
  }, [enabled, queryClient])
}
