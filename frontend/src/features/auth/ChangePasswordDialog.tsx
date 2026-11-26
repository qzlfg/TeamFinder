import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ApiError } from '@/api/client'
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
import { useChangePassword } from './session'

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Введите текущий пароль'),
    new_password: z.string().min(8, 'Минимум 8 символов').max(72, 'Максимум 72 символа'),
    confirm_password: z.string().min(1, 'Повторите новый пароль'),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: 'Пароли не совпадают',
    path: ['confirm_password'],
  })

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Смена пароля: текущий пароль и подтверждение нового. */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const changePassword = useChangePassword()

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      onOpenChange(false)
      form.reset()
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          form.setError('current_password', { message: 'Неверный пароль' })
          return
        }

        if (error.status === 400) {
          form.setError('new_password', { message: error.message })
        }
      }
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить пароль</DialogTitle>
          <DialogDescription>
            После смены пароля остальные сессии будут завершены.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Текущий пароль"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={form.formState.errors.current_password?.message}
            {...form.register('current_password')}
          />

          <FormField
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            placeholder="Минимум 8 символов"
            error={form.formState.errors.new_password?.message}
            {...form.register('new_password')}
          />

          <FormField
            label="Повторите новый пароль"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={form.formState.errors.confirm_password?.message}
            {...form.register('confirm_password')}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={changePassword.isPending}>
              <KeyRound className="size-4" />
              {changePassword.isPending ? 'Меняем…' : 'Изменить пароль'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
