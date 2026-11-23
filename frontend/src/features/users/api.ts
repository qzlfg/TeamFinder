import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { client, unwrap } from '@/api/client'
import type { components } from '@/api/schema'
import { sessionQueryOptions } from '@/features/auth/session'

export type UserPublicRead = components['schemas']['UserPublicRead']
export type UserProfileRead = components['schemas']['UserProfileRead']
export type UserPrivateRead = components['schemas']['UserPrivateRead']
export type UserUpdate = components['schemas']['UserUpdate']
export type SkillRead = components['schemas']['SkillRead']

async function fetchUsers(query: string): Promise<UserPublicRead[]> {
  const result = await client.GET('/api/v1/users', {
    params: { query: { q: query.trim() || undefined, limit: 50 } },
  })

  return unwrap(result)
}

export function useUsers(query: string) {
  return useQuery({
    queryKey: ['users', { q: query }],
    queryFn: () => fetchUsers(query),
    staleTime: 30_000,
  })
}

async function fetchSkills(): Promise<SkillRead[]> {
  const result = await client.GET('/api/v1/skills')
  return unwrap(result)
}

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
    staleTime: 5 * 60_000,
  })
}

/** PATCH /users/me — частичное обновление анкеты. */
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UserUpdate) => {
      const result = await client.PATCH('/api/v1/users/me', { body: payload })
      return unwrap(result)
    },
    onSuccess: (user) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, user)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Профиль обновлён')
    },
  })
}

/** Добавление навыка из справочника в свой профиль. */
export function useAddSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (skillId: number) => {
      const result = await client.POST('/api/v1/users/me/skills/{skill_id}', {
        params: { path: { skill_id: skillId } },
      })
      return unwrap(result)
    },
    onSuccess: (user) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, user)
      toast.success('Навык добавлен')
    },
  })
}

/** Удаление навыка из своего профиля. */
export function useRemoveSkill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (skillId: number) => {
      await client.DELETE('/api/v1/users/me/skills/{skill_id}', {
        params: { path: { skill_id: skillId } },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Навык удалён')
    },
  })
}

async function fetchUserProfile(userId: string): Promise<UserProfileRead> {
  const result = await client.GET('/api/v1/users/{user_id}', {
    params: { path: { user_id: userId } },
  })

  return unwrap(result)
}

/**
 * Карточка участника: Telegram и группа приходят только при can_view_contacts,
 * бэкенд сам решает, раскрывать ли контакты текущему пользователю.
 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['users', 'profile', userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
  })
}
