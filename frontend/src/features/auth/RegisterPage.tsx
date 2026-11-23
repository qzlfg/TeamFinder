import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { AuthLayout } from './AuthLayout'
import { type RegisterRequest, useRegister } from './session'

const registerSchema = z.object({
  first_name: z.string().min(1, 'Укажите имя').max(100, 'Максимум 100 символов'),
  last_name: z.string().min(1, 'Укажите фамилию').max(100, 'Максимум 100 символов'),
  email: z.email('Введите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов').max(72, 'Максимум 72 символа'),
  faculty: z.string().max(255, 'Максимум 255 символов').optional(),
  telegram_username: z
    .string()
    .max(32, 'Максимум 32 символа')
    .optional()
    .refine((value) => !value || value.length >= 5, 'Минимум 5 символов'),
})

type RegisterValues = z.infer<typeof registerSchema>

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      faculty: '',
      telegram_username: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: RegisterRequest = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: values.email.trim(),
      password: values.password,
      faculty: optional(values.faculty),
      telegram_username: optional(values.telegram_username),
    }

    try {
      await register.mutateAsync(payload)
      await navigate({ to: '/events', replace: true })
    } catch {
      // Тост с ошибкой уже показан middleware в src/api/client.ts.
    }
  })

  return (
    <AuthLayout
      title="Регистрация"
      description="Профиль участника появится в каталоге и позволит откликаться на вакансии."
      footer={
        <span>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:underline">
            Войти
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Имя"
            autoComplete="given-name"
            placeholder="Максим"
            error={form.formState.errors.first_name?.message}
            {...form.register('first_name')}
          />
          <FormField
            label="Фамилия"
            autoComplete="family-name"
            placeholder="Иванов"
            error={form.formState.errors.last_name?.message}
            {...form.register('last_name')}
          />
        </div>

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />

        <FormField
          label="Пароль"
          type="password"
          autoComplete="new-password"
          placeholder="Минимум 8 символов"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Факультет"
            placeholder="Необязательно"
            error={form.formState.errors.faculty?.message}
            {...form.register('faculty')}
          />
          <FormField
            label="Telegram"
            placeholder="username"
            hint="Виден только тиммейтам"
            error={form.formState.errors.telegram_username?.message}
            {...form.register('telegram_username')}
          />
        </div>

        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? 'Создаём аккаунт…' : 'Создать аккаунт'}
        </Button>
      </form>
    </AuthLayout>
  )
}
