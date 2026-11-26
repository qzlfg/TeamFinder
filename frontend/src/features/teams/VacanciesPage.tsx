import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Rocket, SearchX } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplyDialog } from '@/features/applications/ApplyDialog'
import { useSession } from '@/features/auth/session'
import { type EventRead, useEvents } from '@/features/events/api'
import { useMyTeams, useTeams, useVacancies, type VacancyRead } from '@/features/teams/api'
import { VacancySkillsList } from '@/features/teams/VacancySkillsList'
import { type SkillRead, useSkills } from '@/features/users/api'
import { cn } from '@/lib/utils'
import type { VacanciesSearch } from './vacanciesSearch'

interface VacancyFiltersProps {
  skills: SkillRead[]
  events: EventRead[]
  selectedSkillIds: number[]
  eventId?: string
  onlyPetProjects: boolean
  hasFilters: boolean
  onToggleSkill: (skillId: number) => void
  onEventChange: (eventId: string | undefined) => void
  onTogglePetProjects: () => void
  onReset: () => void
}

function VacancyFilters({
  skills,
  events,
  selectedSkillIds,
  eventId,
  onlyPetProjects,
  hasFilters,
  onToggleSkill,
  onEventChange,
  onTogglePetProjects,
  onReset,
}: VacancyFiltersProps) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="space-y-4 px-5 py-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Навыки</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skills.length === 0 ? (
                <span className="text-xs text-zinc-500">Справочник навыков пуст.</span>
              ) : (
                skills.map((skill) => {
                  const active = selectedSkillIds.includes(skill.id)

                  return (
                    <button
                      key={skill.id}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs transition-colors',
                        active
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                      )}
                      onClick={() => onToggleSkill(skill.id)}
                    >
                      {skill.name}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="vacancy-event">Мероприятие</Label>
              <Select
                value={eventId ?? 'all'}
                onValueChange={(value) => onEventChange(value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="vacancy-event" className="w-full bg-white">
                  <SelectValue placeholder="Все мероприятия" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все мероприятия</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={onlyPetProjects}
                className={cn(
                  'h-8 gap-1.5 bg-white',
                  onlyPetProjects && 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50',
                )}
                onClick={onTogglePetProjects}
              >
                <Rocket className="size-3.5" />
                Только пет-проекты
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!hasFilters}
                onClick={onReset}
              >
                Сбросить
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function VacanciesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((card) => (
        <div key={card} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-6 w-full" />
        </div>
      ))}
    </div>
  )
}

/** Общая витрина открытых вакансий с фильтрами и откликом. */
export function VacanciesPage() {
  const { skill_id, event_id, only_pet_projects } = useSearch({ from: '/vacancies' })
  const navigate = useNavigate({ from: '/vacancies' })
  const { data: session } = useSession()
  const { data: skills = [] } = useSkills()
  const { data: events = [] } = useEvents({})

  const skillIds = skill_id ?? []
  const onlyPetProjects = Boolean(only_pet_projects)
  const isMember = session?.role === 'member'

  const myTeamsQuery = useMyTeams(undefined, isMember)
  const { data: teams = [] } = useTeams()
  const { data, isPending, isError, error, refetch } = useVacancies({
    skillIds,
    eventId: event_id,
    onlyPetProjects,
  })

  const myTeamIds = new Set((myTeamsQuery.data ?? []).map((team) => team.id))
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const userSkillIds = new Set((session?.skills ?? []).map((skill) => skill.id))

  const [applyVacancy, setApplyVacancy] = useState<VacancyRead | null>(null)
  const [applyTeamTitle, setApplyTeamTitle] = useState('')

  const hasFilters = skillIds.length > 0 || Boolean(event_id) || onlyPetProjects

  const updateSearch = (patch: Partial<VacanciesSearch>) => {
    void navigate({
      to: '/vacancies',
      search: (previous) => ({ ...previous, ...patch }),
      replace: true,
    })
  }

  const toggleSkill = (skillId: number) => {
    const next = skillIds.includes(skillId)
      ? skillIds.filter((id) => id !== skillId)
      : [...skillIds, skillId]

    updateSearch({ skill_id: next.length > 0 ? next : undefined })
  }

  const resetFilters = () => {
    void navigate({ to: '/vacancies', search: {}, replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Вакансии"
        description="Открытые роли в командах мероприятий и пет-проектах."
      />

      <VacancyFilters
        skills={skills}
        events={events}
        selectedSkillIds={skillIds}
        eventId={event_id}
        onlyPetProjects={onlyPetProjects}
        hasFilters={hasFilters}
        onToggleSkill={toggleSkill}
        onEventChange={(nextEventId) => updateSearch({ event_id: nextEventId })}
        onTogglePetProjects={() =>
          updateSearch({ only_pet_projects: onlyPetProjects ? undefined : true })
        }
        onReset={resetFilters}
      />

      {isPending ? (
        <VacanciesSkeleton />
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={hasFilters ? 'Ничего не найдено' : 'Открытых вакансий нет'}
          description={
            hasFilters
              ? 'По выбранным фильтрам вакансий нет. Попробуйте изменить условия.'
              : 'Как только команды откроют вакансии, они появятся здесь.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="font-mono text-xs text-zinc-500 tabular-nums">Найдено: {data.length}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((vacancy) => {
              const team = teamById.get(vacancy.team_id)
              const inTeam = myTeamIds.has(vacancy.team_id)
              const canApply = isMember && !inTeam

              return (
                <Card key={vacancy.id} className="h-full gap-4 py-5 shadow-none">
                  <CardHeader className="gap-3 px-5">
                    <CardTitle className="text-base leading-snug font-semibold text-zinc-950">
                      {vacancy.title}
                    </CardTitle>
                    <span className="w-fit rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
                      {vacancy.required_role}
                    </span>
                    <p className="line-clamp-3 text-sm leading-relaxed text-zinc-500">
                      {vacancy.description}
                    </p>
                  </CardHeader>

                  <CardContent className="mt-auto space-y-3 px-5">
                    <VacancySkillsList skills={vacancy.skills} userSkillIds={userSkillIds} />

                    <div className="flex items-center justify-between gap-3">
                      <Link
                        to="/teams/$teamId"
                        params={{ teamId: vacancy.team_id }}
                        className="min-w-0 truncate text-xs font-medium text-blue-600 hover:underline"
                      >
                        {team?.title ?? 'Команда'}
                      </Link>

                      {canApply ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setApplyVacancy(vacancy)
                            setApplyTeamTitle(team?.title ?? 'Команда')
                          }}
                        >
                          Откликнуться
                        </Button>
                      ) : inTeam ? (
                        <span className="text-xs text-zinc-500">Ваша команда</span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {applyVacancy ? (
        <ApplyDialog
          vacancy={applyVacancy}
          teamTitle={applyTeamTitle}
          open={Boolean(applyVacancy)}
          onOpenChange={(open) => {
            if (!open) {
              setApplyVacancy(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
