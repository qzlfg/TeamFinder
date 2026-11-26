import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  lazyRouteComponent,
  Outlet,
  redirect,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'

import { AppShell } from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { sessionQueryOptions } from '@/features/auth/session'
import { eventsSearchSchema } from '@/features/events/search'
import { vacanciesSearchSchema } from '@/features/teams/vacanciesSearch'
import { queryClient } from '@/lib/query-client'

interface RouterContext {
  queryClient: QueryClient
}

const PUBLIC_PATHS = new Set(['/login', '/register'])

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (PUBLIC_PATHS.has(pathname)) {
    return <Outlet />
  }

  return <AppShell />
}

function RoutePending() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-50">
      <Skeleton className="h-8 w-40" />
    </div>
  )
}

function RouteError() {
  const router = useRouter()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-zinc-50 px-6 text-center">
      <h1 className="text-lg font-semibold text-zinc-950">Не удалось загрузить приложение</h1>
      <p className="text-sm text-zinc-500">Проверьте соединение с сервером и повторите попытку.</p>
      <Button variant="outline" onClick={() => void router.invalidate()}>
        Повторить
      </Button>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-zinc-50 px-6 text-center">
      <p className="font-mono text-xs text-zinc-400 tabular-nums">404</p>
      <h1 className="text-lg font-semibold text-zinc-950">Страница не найдена</h1>
      <Button asChild variant="outline">
        <Link to="/events">К мероприятиям</Link>
      </Button>
    </div>
  )
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    if (PUBLIC_PATHS.has(location.pathname)) {
      return
    }

    const user = await context.queryClient.ensureQueryData(sessionQueryOptions)

    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: RootLayout,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/events' })
  },
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: lazyRouteComponent(() => import('@/features/auth/LoginPage'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: lazyRouteComponent(() => import('@/features/auth/RegisterPage'), 'RegisterPage'),
})

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events',
  validateSearch: (search) => eventsSearchSchema.parse(search),
  component: lazyRouteComponent(() => import('@/features/events/EventsPage'), 'EventsPage'),
})

const eventDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/events/$eventId',
  component: lazyRouteComponent(
    () => import('@/features/events/EventDetailPage'),
    'EventDetailPage',
  ),
})

const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teams',
  component: lazyRouteComponent(() => import('@/features/teams/TeamsPage'), 'TeamsPage'),
})

const teamDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teams/$teamId',
  component: lazyRouteComponent(() => import('@/features/teams/TeamDetailPage'), 'TeamDetailPage'),
})

const vacanciesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vacancies',
  validateSearch: (search) => vacanciesSearchSchema.parse(search),
  component: lazyRouteComponent(() => import('@/features/teams/VacanciesPage'), 'VacanciesPage'),
})

const applicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/applications',
  component: lazyRouteComponent(
    () => import('@/features/applications/ApplicationsPage'),
    'ApplicationsPage',
  ),
})

const userProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users/$userId',
  component: lazyRouteComponent(
    () => import('@/features/users/UserProfilePage'),
    'UserProfilePage',
  ),
})

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  component: lazyRouteComponent(() => import('@/features/users/UsersPage'), 'UsersPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: lazyRouteComponent(() => import('@/features/users/ProfilePage'), 'ProfilePage'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  eventsRoute,
  eventDetailRoute,
  teamsRoute,
  teamDetailRoute,
  vacanciesRoute,
  applicationsRoute,
  userProfileRoute,
  usersRoute,
  profileRoute,
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
