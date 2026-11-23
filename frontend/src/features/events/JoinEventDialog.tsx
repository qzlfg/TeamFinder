import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useJoinEvent } from './api'

interface JoinEventDialogProps {
  eventId: string
  eventTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Регистрация в мероприятии соло-участником с желаемой ролью. */
export function JoinEventDialog({ eventId, eventTitle, open, onOpenChange }: JoinEventDialogProps) {
  const joinEvent = useJoinEvent(eventId)
  const [desiredRole, setDesiredRole] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      await joinEvent.mutateAsync(desiredRole.trim() || null)
      onOpenChange(false)
      setDesiredRole('')
    } catch {
      // Ошибка уже показана тостом в src/api/client.ts.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Участвовать в мероприятии</DialogTitle>
          <DialogDescription>
            {eventTitle}: вы попадёте в список участников и сможете искать команду.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="desired-role">Желаемая роль</Label>
            <Input
              id="desired-role"
              value={desiredRole}
              onChange={(event) => setDesiredRole(event.target.value)}
              placeholder="Например, Backend-разработчик"
              maxLength={100}
              className="bg-white"
            />
            <p className="text-xs text-zinc-500">Необязательно, но так вас быстрее найдут.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={joinEvent.isPending}>
              {joinEvent.isPending ? 'Регистрируем…' : 'Участвовать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
