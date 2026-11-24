import { useNavigate } from '@tanstack/react-router'
import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from './api'

interface NotificationBellProps {
  enabled: boolean
}

/** Колокольчик в шапке: счётчик непрочитанных и поповер со списком. */
export function NotificationBell({ enabled }: NotificationBellProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { data: unreadCount = 0 } = useUnreadCount(enabled)
  const { data: notifications = [], isLoading, isError, refetch } = useNotifications(enabled)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-zinc-500 hover:text-zinc-900"
          aria-label="Уведомления"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-blue-600 px-1 font-mono text-xs leading-none font-medium text-white tabular-nums">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <span className="text-sm font-medium text-zinc-950">Уведомления</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-blue-600 hover:text-blue-700"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="size-3.5" />
            Прочитать все
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">Не удалось загрузить уведомления</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Повторить
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">Пока нет уведомлений</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-100/80"
                    onClick={() => {
                      if (!notification.is_read) {
                        markRead.mutate(notification.id)
                      }

                      if (notification.action_url) {
                        setOpen(false)
                        void navigate({ to: notification.action_url })
                      }
                    }}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        notification.is_read ? 'bg-transparent' : 'bg-blue-600',
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-950">
                        {notification.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-zinc-500">
                        {notification.message}
                      </span>
                      <span className="mt-1 block font-mono text-xs text-zinc-400 tabular-nums">
                        {formatDateTime(notification.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
