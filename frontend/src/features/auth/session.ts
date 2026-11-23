import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { client, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type CurrentUser = components['schemas']['UserPrivateRead']
export type LoginRequest = components['schemas']['LoginRequest']
export type RegisterRequest = components['schemas']['UserCreate']
export type EmailChangeRequest = components['schemas']['EmailChangeRequest']

/** Пробный запрос сессии: 401 ожидаем и превращаем в `null`. */
async function fetchSession(): Promise<CurrentUser | null> {
  const result = await client.GET('/api/v1/users/me', {
    headers: { 'x-session-probe': '1' },
  })

  if (result.response.status === 401) {
    return null
  }

  return unwrap(result)
}

export const sessionQueryOptions = queryOptions({
  queryKey: ['session'] as const,
  queryFn: fetchSession,
  staleTime: 60_000,
  retry: false,
})

export function useSession() {
  return useQuery(sessionQueryOptions)
}

/** Авторизация по email и паролю; JWT приходит в HttpOnly Cookie. */
export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: LoginRequest) => {
      const result = await client.POST('/api/v1/auth/login', { body: values })
      return unwrap(result)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, data.user)
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

/** Регистрация: бэкенд сразу выставляет Cookie и возвращает профиль. */
export function useRegister() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: RegisterRequest) => {
      const result = await client.POST('/api/v1/auth/register', { body: values })
      return unwrap(result)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, data.user)
    },
  })
}

/** Выход: отзыв refresh-токена и очистка Cookie. */
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await client.POST('/api/v1/auth/logout')
    },
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(sessionQueryOptions.queryKey, null)
    },
  })
}

/** Смена почты с подтверждением текущего пароля; сервер ротирует cookie. */
export function useChangeEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: EmailChangeRequest) => {
      const result = await client.POST('/api/v1/auth/change-email', { body: values })
      return unwrap(result)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, data.user)
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Почта изменена')
    },
  })
}
