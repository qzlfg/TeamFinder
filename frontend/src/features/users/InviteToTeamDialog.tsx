import { Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useInviteUser } from '@/features/applications/api'
import { type TeamRead, useTeamVacancies } from '@/features/teams/api'

interface InviteToTeamDialogProps {
  userId: string
  userName: string
  teams: TeamRead[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Приглашение участника в одну из своих команд на открытую вакансию. */
export function InviteToTeamDialog({
  userId,
  userName,
  teams,
  open,
  onOpenChange,
}: InviteToTeamDialogProps) {
  const invite = useInviteUser()
  const [teamId, setTeamId] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [coverLetter, setCoverLetter] = useState('')

  const vacanciesQuery = useTeamVacancies(teamId)
  const vacancies = vacanciesQuery.data ?? []
  const recruitingTeams = teams.filter((team) => team.status === 'recruiting')

  useEffect(() => {
    if (!open) {
      return
    }

    setTeamId('')
    setVacancyId('')
    setCoverLetter('')
  }, [open])

  const onSubmit = async () => {
    if (!teamId || !vacancyId) {
      return
    }

    try {
      await invite.mutateAsync({
        vacancy_id: vacancyId,
        user_id: userId,
        cover_letter: coverLetter.trim() || null,
      })
      onOpenChange(false)
    } catch {
      // Ошибка уже показана тостом в src/api/client.ts.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Пригласить в команду</DialogTitle>
          <DialogDescription>
            Приглашение для {userName}. Выберите команду и открытую вакансию.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-team">Команда</Label>
            <Select
              value={teamId}
              onValueChange={(value) => {
                setTeamId(value)
                setVacancyId('')
              }}
            >
              <SelectTrigger id="invite-team" className="w-full bg-white">
                <SelectValue placeholder="Выберите команду" />
              </SelectTrigger>
              <SelectContent>
                {recruitingTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-vacancy">Вакансия</Label>
            <Select
              value={vacancyId}
              onValueChange={setVacancyId}
              disabled={!teamId || vacanciesQuery.isPending || vacancies.length === 0}
            >
              <SelectTrigger id="invite-vacancy" className="w-full bg-white">
                <SelectValue
                  placeholder={
                    !teamId
                      ? 'Сначала выберите команду'
                      : vacanciesQuery.isPending
                        ? 'Загрузка вакансий…'
                        : vacancies.length === 0
                          ? 'Открытых вакансий нет'
                          : 'Выберите вакансию'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((vacancy) => (
                  <SelectItem key={vacancy.id} value={vacancy.id}>
                    {vacancy.title} · {vacancy.required_role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-message">Сопроводительное сообщение</Label>
            <Textarea
              id="invite-message"
              rows={3}
              maxLength={1000}
              value={coverLetter}
              placeholder="Почему вы хотите видеть этого участника в команде"
              className="bg-white"
              onChange={(event) => setCoverLetter(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={!teamId || !vacancyId || invite.isPending}
            onClick={() => void onSubmit()}
          >
            <Send className="size-4" />
            {invite.isPending ? 'Отправляем…' : 'Отправить приглашение'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
