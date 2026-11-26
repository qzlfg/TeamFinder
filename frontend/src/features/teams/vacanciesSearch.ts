import { z } from 'zod'

const skillIdsSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined
    }

    const raw = Array.isArray(value) ? value : [value]
    const ids = raw
      .flatMap((item) => String(item).split(','))
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)

    return ids.length > 0 ? ids : undefined
  }, z.array(z.number().int().positive()).optional())
  .catch(undefined)

const booleanSchema = z
  .preprocess((value) => {
    if (typeof value === 'boolean') {
      return value
    }

    if (value === 'true' || value === '1') {
      return true
    }

    if (value === 'false' || value === '0') {
      return false
    }

    return undefined
  }, z.boolean().optional())
  .catch(undefined)

/** Фильтры витрины вакансий хранятся в URL. */
export const vacanciesSearchSchema = z.object({
  skill_id: skillIdsSchema,
  event_id: z.string().uuid().optional().catch(undefined),
  only_pet_projects: booleanSchema,
})

export type VacanciesSearch = z.infer<typeof vacanciesSearchSchema>
