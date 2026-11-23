import createClient, { type Middleware } from 'openapi-fetch'
import { toast } from 'sonner'

import type { paths } from './schema'

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

/** Ошибка API с человекочитаемым сообщением и HTTP-статусом. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Публичные маршруты, на которых 401 не должен редиректить и шуметь тостом. */
const AUTH_ENDPOINTS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  // 401 здесь означает неверный текущий пароль, а не истёкшую сессию.
  '/api/v1/auth/change-email',
])

interface ValidationIssue {
  loc?: unknown
  msg?: unknown
}

/** Достаёт сообщение об ошибке из ответа бэкенда (`DomainException` / `422`). */
export function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const { detail } = body as { detail: unknown }

    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const issue = detail[0] as ValidationIssue
      const field = Array.isArray(issue.loc)
        ? issue.loc.filter((part) => part !== 'body' && typeof part === 'string').join('.')
        : ''

      if (typeof issue.msg === 'string') {
        return field ? `${field}: ${issue.msg}` : issue.msg
      }
    }
  }

  if (status === 401) return 'Требуется вход в аккаунт'
  if (status === 403) return 'Недостаточно прав для этого действия'
  if (status === 404) return 'Запись не найдена'
  if (status === 409) return 'Конфликт данных, обновите страницу'
  if (status === 429) return 'Слишком много запросов, попробуйте позже'
  if (status >= 500) return 'Ошибка сервера. Попробуйте позже'
  return 'Не удалось выполнить запрос'
}

function parsePath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

const errorMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (response.ok) {
      return response
    }

    const path = parsePath(request.url)
    const isSessionProbe = request.headers.get('x-session-probe') === '1'
    const isSilent = request.headers.get('x-silent-error') === '1'
    const isAuthEndpoint = AUTH_ENDPOINTS.has(path)
    const shouldNotify = !isSessionProbe && !isSilent

    const body = await response
      .clone()
      .json()
      .catch(() => null)

    const message = extractErrorMessage(body, response.status)

    if (response.status === 401) {
      if (!isSessionProbe && !isAuthEndpoint && typeof window !== 'undefined') {
        if (window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      }

      if (shouldNotify) {
        toast.error(message)
      }

      return response
    }

    if (shouldNotify) {
      toast.error(message)
    }

    return response
  },
}

let refreshPromise: Promise<boolean> | null = null

/**
 * Обновление access-токена по refresh-cookie.
 * Одна общая попытка на все параллельные 401, чтобы не плодить ротации.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

/**
 * fetch с прозрачным продлением сессии: при 401 один раз обновляем токен
 * и повторяем исходный запрос с уже новыми HttpOnly-cookie.
 */
async function authFetch(input: Request): Promise<Response> {
  const path = parsePath(input.url)
  const canRefresh = !AUTH_ENDPOINTS.has(path)
  const retryRequest = canRefresh ? input.clone() : null

  let response = await fetch(input)

  if (response.status === 401 && retryRequest) {
    const refreshed = await refreshSession()

    if (refreshed) {
      response = await fetch(retryRequest)
    }
  }

  return response
}

/** Единый клиент API: cookies (HttpOnly JWT) передаются с каждым запросом. */
export const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  fetch: authFetch,
})

client.use(errorMiddleware)

/** Достаёт данные из ответа или бросает типизированную ошибку. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(
      extractErrorMessage(result.error, result.response.status),
      result.response.status,
    )
  }

  return result.data as T
}
