import { zodResolver } from '@hookform/resolvers/zod'
import { Mail } from 'lucide-react'
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
import { useChangeEmail } from './session'

const changeEmailSchema = z.object({
  new_email: z.email('Введите корректный email'),
  current_password: z.string().min(1, 'Введите текущий пароль'),
})

type ChangeEmailValues = z.infer<typeof changeEmailSchema>

interface ChangeEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Смена почты: требует текущий пароль и ротирует HttpOnly cookie. */
export function ChangeEmailDialog({ open, onOpenChange }: ChangeEmailDialogProps) {
  const changeEmail = useChangeEmail()

  const form = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { new_email: '', current_password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await changeEmail.mutateAsync({
        new_email: values.new_email.trim(),
        current_password: values.current_password,
      })
      onOpenChange(false)
      form.reset()
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          form.setError('current_password', { message: 'Неверный пароль' })
          return
        }

        if (error.status === 400 || error.status === 409) {
          form.setError('new_email', { message: error.message })
        }
      }
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить почту</DialogTitle>
          <DialogDescription>
            Новый адрес будет использоваться для входа. После смены остальные сессии завершатся.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label="Новая почта"
            type="email"
            autoComplete="email"
            placeholder="new@example.com"
            error={form.formState.errors.new_email?.message}
            {...form.register('new_email')}
          />

          <FormField
            label="Текущий пароль"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={form.formState.errors.current_password?.message}
            {...form.register('current_password')}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={changeEmail.isPending}>
              <Mail className="size-4" />
              {changeEmail.isPending ? 'Меняем…' : 'Изменить почту'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
