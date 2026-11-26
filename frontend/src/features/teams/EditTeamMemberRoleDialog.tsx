import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TeamMemberDetailRead } from './api'
import { useUpdateTeamMemberRole } from './api'

const roleSchema = z.object({
  role_name: z.string().trim().min(1, 'Укажите роль').max(255, 'Максимум 255 символов'),
})

type RoleValues = z.infer<typeof roleSchema>

interface EditTeamMemberRoleDialogProps {
  teamId: string
  member: TeamMemberDetailRead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Изменение проектной роли участника внутри команды. */
export function EditTeamMemberRoleDialog({
  teamId,
  member,
  open,
  onOpenChange,
}: EditTeamMemberRoleDialogProps) {
  const updateRole = useUpdateTeamMemberRole(teamId)
  const form = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { role_name: '' },
  })

  useEffect(() => {
    if (!open || !member) {
      return
    }

    form.reset({ role_name: member.role_name })
  }, [open, member, form])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!member) {
      return
    }

    try {
      await updateRole.mutateAsync({
        userId: member.user.id,
        roleName: values.role_name.trim(),
      })
      onOpenChange(false)
    } catch {
      // Ошибка уже показана тостом в src/api/client.ts.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить роль</DialogTitle>
          <DialogDescription>
            {member
              ? `Проектная роль ${member.user.first_name} ${member.user.last_name} в команде.`
              : 'Проектная роль участника в команде.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Роль"
            placeholder="Например, Frontend"
            error={form.formState.errors.role_name?.message}
            {...form.register('role_name')}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={updateRole.isPending || !member}>
              {updateRole.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
