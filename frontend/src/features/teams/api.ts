import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { client, unwrap } from '@/api/client'
import type { components } from '@/api/schema'
import type { TeamStatus, VacancyStatus } from '@/lib/labels'

export type TeamRead = components['schemas']['TeamRead']
export type TeamMemberDetailRead = components['schemas']['TeamMemberDetailRead']
export type VacancyRead = components['schemas']['VacancyRead']
export type TeamCreate = components['schemas']['TeamCreate']
export type TeamUpdate = components['schemas']['TeamUpdate']
export type VacancyCreate = components['schemas']['VacancyCreate']
export type VacancyUpdate = components['schemas']['VacancyUpdate']
export type ApplicationRead = components['schemas']['ApplicationRead']

async function fetchTeams(status?: TeamStatus): Promise<TeamRead[]> {
  const result = await client.GET('/api/v1/teams', {
    params: { query: { status: status ? [status] : undefined, limit: 50 } },
  })

  return unwrap(result)
}

export function useTeams(status?: TeamStatus) {
  return useQuery({
    queryKey: ['teams', { status }],
    queryFn: () => fetchTeams(status),
    staleTime: 30_000,
  })
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['teams', 'detail', teamId],
    queryFn: async () => {
      const result = await client.GET('/api/v1/teams/{team_id}', {
        params: { path: { team_id: teamId } },
      })
      return unwrap(result)
    },
    enabled: Boolean(teamId),
  })
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMemberDetailRead[]> {
  const result = await client.GET('/api/v1/teams/{team_id}/members', {
    params: { path: { team_id: teamId } },
  })

  return unwrap(result)
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['teams', 'members', teamId],
    queryFn: () => fetchTeamMembers(teamId),
    enabled: Boolean(teamId),
  })
}

export function useTeamVacancies(teamId: string, status: VacancyStatus = 'open') {
  return useQuery({
    queryKey: ['teams', 'vacancies', teamId, status],
    queryFn: async () => {
      const result = await client.GET('/api/v1/teams/{team_id}/vacancies', {
        params: { path: { team_id: teamId }, query: { status, limit: 50 } },
      })
      return unwrap(result)
    },
    enabled: Boolean(teamId),
  })
}

/** Входящие отклики и исходящие приглашения команды (только лидер/админ). */
export function useTeamApplications(teamId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['applications', 'team', teamId],
    queryFn: async () => {
      const result = await client.GET('/api/v1/applications/teams/{team_id}', {
        params: { path: { team_id: teamId }, query: { limit: 50 } },
        headers: { 'x-silent-error': '1' },
      })
      return unwrap(result)
    },
    enabled: enabled && Boolean(teamId),
  })
}

/** POST /teams — создание команды мероприятия или пет-проекта. */
export function useCreateTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: TeamCreate) => {
      const result = await client.POST('/api/v1/teams', { body: payload })
      return unwrap(result)
    },
    onSuccess: (team) => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Команда создана', { description: team.title })
    },
  })
}

export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: TeamUpdate) => {
      const result = await client.PATCH('/api/v1/teams/{team_id}', {
        params: { path: { team_id: teamId } },
        body: payload,
      })
      return unwrap(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Команда обновлена')
    },
  })
}

export function useCreateVacancy(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: VacancyCreate) => {
      const result = await client.POST('/api/v1/teams/{team_id}/vacancies', {
        params: { path: { team_id: teamId } },
        body: payload,
      })
      return unwrap(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Вакансия открыта')
    },
  })
}

export function useUpdateVacancy(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ vacancyId, payload }: { vacancyId: string; payload: VacancyUpdate }) => {
      const result = await client.PATCH('/api/v1/vacancies/{vacancy_id}', {
        params: { path: { vacancy_id: vacancyId } },
        body: payload,
      })
      return unwrap(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams', 'vacancies', teamId] })
      toast.success('Вакансия обновлена')
    },
  })
}

export function useDeleteVacancy(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vacancyId: string) => {
      await client.DELETE('/api/v1/vacancies/{vacancy_id}', {
        params: { path: { vacancy_id: vacancyId } },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams', 'vacancies', teamId] })
      toast.success('Вакансия удалена')
    },
  })
}

export function useLeaveTeam(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await client.DELETE('/api/v1/teams/{team_id}/members/me', {
        params: { path: { team_id: teamId } },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success('Вы покинули команду')
    },
  })
}

export function useRemoveTeamMember(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      await client.DELETE('/api/v1/teams/{team_id}/members/{user_id}', {
        params: { path: { team_id: teamId, user_id: userId } },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success('Участник исключён')
    },
  })
}

/** DELETE /teams/{id} — расформирование команды лидером или админом. */
export function useDeleteTeam(teamId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await client.DELETE('/api/v1/teams/{team_id}', {
        params: { path: { team_id: teamId } },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success('Команда удалена')
    },
  })
}
