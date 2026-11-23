import { z } from 'zod'

import type { EventType } from '@/lib/labels'

/** Фильтры витрины мероприятий хранятся в URL (типизированные search-параметры). */
export const eventsSearchSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  type: z
    .enum(['hackathon', 'academic_course', 'ctf_jam', 'startup_grant', 'diploma', 'pet_project'])
    .optional()
    .catch(undefined),
})

export type EventsSearch = {
  q?: string
  type?: EventType
}
