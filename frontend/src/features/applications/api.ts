import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { client, unwrap } from '@/api/client'
import type { components } from '@/api/schema'
import type { ApplicationStatus } from '@/lib/labels'

export type ApplicationRead = components['schemas']['ApplicationRead']
export type ApplicationApplyCreate = components['schemas']['ApplicationApplyCreate']

async function fetchMyApplications(): Promise<ApplicationRead[]> {
  const result = await client.GET('/api/v1/applications/me', {
    params: { query: { limit: 50 } },
  })

  return unwrap(result)
}

export function useMyApplications() {
  return useQuery({
    queryKey: ['applications', 'me'],
    queryFn: fetchMyApplications,
    staleTime: 15_000,
  })
}

/** POST /applications/apply — отклик студента на открытую вакансию. */
export function useApplyToVacancy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: ApplicationApplyCreate) => {
      const result = await client.POST('/api/v1/applications/apply', { body: payload })
      return unwrap(result)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      toast.success('Отклик отправлен', {
        description: 'Лидер команды увидит его в списке заявок.',
      })
    },
  })
}

/** PATCH /applications/{id}/status — конечный автомат статусов. */
export function useSetApplicationStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      applicationId,
      status,
    }: {
      applicationId: string
      status: ApplicationStatus
    }) => {
      const result = await client.PATCH('/api/v1/applications/{application_id}/status', {
        params: { path: { application_id: applicationId } },
        body: { status },
      })
      return unwrap(result)
    },
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['session'] })

      if (application.status === 'accepted') {
        toast.success('Заявка принята', { description: 'Участник добавлен в команду.' })
        return
      }

      toast.success('Статус заявки обновлён')
    },
  })
}
