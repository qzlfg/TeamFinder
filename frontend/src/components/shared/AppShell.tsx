import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Briefcase, CalendarDays, Inbox, LogOut, Menu, User, Users, X } from 'lucide-react'

import { useNotificationsStream } from '@/api/sse'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout, useSession } from '@/features/auth/session'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

const NAV_ITEMS = [
  { to: '/events', label: 'Мероприятия', icon: CalendarDays },
  { to: '/teams', label: 'Команды', icon: Users },
  { to: '/vacancies', label: 'Вакансии', icon: Briefcase },
  { to: '/applications', label: 'Заявки', icon: Inbox },
  { to: '/users', label: 'Участники', icon: User },
] as const

/** Каркас приватной части приложения: сайдбар, шапка, контент. */
export function AppShell() {
  const { data: user } = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)

  useNotificationsStream(Boolean(user))

  const currentSection = NAV_ITEMS.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  )

  const handleLogout = async () => {
    await logout.mutateAsync()
    await navigate({ to: '/login', replace: true })
  }

  return (
    <div className="flex min-h-svh bg-zinc-50">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Закрыть навигацию"
          className="fixed inset-0 z-40 bg-zinc-950/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform md:static md:z-auto md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
          <Link
            to="/events"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-950"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-zinc-900 text-xs font-semibold text-white">
              TF
            </span>
            TeamFinder
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-zinc-500 md:hidden"
            aria-label="Закрыть меню"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item === currentSection
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'border-zinc-200 bg-white font-medium text-zinc-950'
                    : 'border-transparent text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-900',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-zinc-500 md:hidden"
              aria-label="Открыть меню"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="truncate text-sm font-medium text-zinc-950">
              {currentSection?.label ?? 'TeamFinder'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell enabled={Boolean(user)} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-zinc-100/80">
                  <Avatar className="size-7">
                    <AvatarFallback className="border border-zinc-200 bg-zinc-100 font-mono text-xs text-zinc-600">
                      {user ? getInitials(user.first_name, user.last_name) : '—'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm text-zinc-700 sm:block">
                    {user ? `${user.first_name} ${user.last_name}` : 'Гость'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
                  {user?.email ?? 'Сессия не найдена'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">Профиль</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={logout.isPending}
                  onClick={() => {
                    void handleLogout()
                  }}
                >
                  <LogOut className="size-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
