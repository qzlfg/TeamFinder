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
import { Textarea } from '@/components/ui/textarea'
import type { UserPrivateRead, UserUpdate } from './api'
import { useUpdateProfile } from './api'

const optionalUrl = z
  .string()
  .max(500, 'Максимум 500 символов')
  .optional()
  .refine((value) => !value || z.url().safeParse(value).success, 'Некорректная ссылка')

const profileSchema = z.object({
  first_name: z.string().min(1, 'Укажите имя').max(100, 'Максимум 100 символов'),
  last_name: z.string().min(1, 'Укажите фамилию').max(100, 'Максимум 100 символов'),
  faculty: z.string().max(255, 'Максимум 255 символов').optional(),
  course: z
    .string()
    .optional()
    .refine((value) => !value || /^[1-7]$/.test(value), 'Курс от 1 до 7'),
  group_name: z.string().max(50, 'Максимум 50 символов').optional(),
  bio: z.string().max(1000, 'Максимум 1000 символов').optional(),
  telegram_username: z
    .string()
    .max(32, 'Максимум 32 символа')
    .optional()
    .refine((value) => !value || value.length >= 5, 'Минимум 5 символов'),
  github_url: optionalUrl,
  portfolio_url: optionalUrl,
})

type ProfileValues = z.infer<typeof profileSchema>

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

interface EditProfileDialogProps {
  user: UserPrivateRead
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Диалог редактирования собственной анкеты (PATCH /users/me). */
export function EditProfileDialog({ user, open, onOpenChange }: EditProfileDialogProps) {
  const updateProfile = useUpdateProfile()

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: '', last_name: '' },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    form.reset({
      first_name: user.first_name,
      last_name: user.last_name,
      faculty: user.faculty ?? '',
      course: user.course ? String(user.course) : '',
      group_name: user.group_name ?? '',
      bio: user.bio ?? '',
      telegram_username: user.telegram_username ?? '',
      github_url: user.github_url ?? '',
      portfolio_url: user.portfolio_url ?? '',
    })
  }, [open, user, form])

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: UserUpdate = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      faculty: emptyToNull(values.faculty),
      course: values.course ? Number(values.course) : null,
      group_name: emptyToNull(values.group_name),
      bio: emptyToNull(values.bio),
      telegram_username: emptyToNull(values.telegram_username),
      github_url: emptyToNull(values.github_url),
      portfolio_url: emptyToNull(values.portfolio_url),
    }

    try {
      await updateProfile.mutateAsync(payload)
      onOpenChange(false)
    } catch {
      // Ошибка уже показана тостом в src/api/client.ts.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
          <DialogDescription>
            Данные видны другим участникам в каталоге. Telegram — только тиммейтам.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Имя"
              error={form.formState.errors.first_name?.message}
              {...form.register('first_name')}
            />
            <FormField
              label="Фамилия"
              error={form.formState.errors.last_name?.message}
              {...form.register('last_name')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Факультет"
              placeholder="Необязательно"
              error={form.formState.errors.faculty?.message}
              {...form.register('faculty')}
            />
            <FormField
              label="Курс"
              inputMode="numeric"
              placeholder="1–7"
              error={form.formState.errors.course?.message}
              {...form.register('course')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Группа"
              placeholder="Необязательно"
              error={form.formState.errors.group_name?.message}
              {...form.register('group_name')}
            />
            <FormField
              label="Telegram"
              placeholder="username"
              hint="Без @, от 5 символов"
              error={form.formState.errors.telegram_username?.message}
              {...form.register('telegram_username')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm leading-none font-medium" htmlFor="profile-bio">
              О себе
            </label>
            <Textarea
              id="profile-bio"
              rows={3}
              placeholder="Опыт, интересы, чем можете помочь команде"
              className="bg-white"
              {...form.register('bio')}
            />
            {form.formState.errors.bio?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.bio.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="GitHub"
              placeholder="https://github.com/username"
              error={form.formState.errors.github_url?.message}
              {...form.register('github_url')}
            />
            <FormField
              label="Портфолио"
              placeholder="https://..."
              error={form.formState.errors.portfolio_url?.message}
              {...form.register('portfolio_url')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
