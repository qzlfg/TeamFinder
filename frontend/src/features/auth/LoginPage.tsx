import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { AuthLayout } from './AuthLayout'
import { useLogin, useSession } from './session'

const loginSchema = z.object({
  email: z.email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { data: user } = useSession()
  const login = useLogin()

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (user) {
      void navigate({ to: '/events', replace: true })
    }
  }, [user, navigate])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      await navigate({ to: '/events', replace: true })
    } catch {
      // Тост с ошибкой уже показан middleware в src/api/client.ts.
    }
  })

  return (
    <AuthLayout
      title="Вход в TeamFinder"
      description="Соберите команду под хакатон, курсовой или пет-проект."
      footer={
        <span>
          Нет аккаунта?{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:underline">
            Зарегистрироваться
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
          autoComplete="current-password"
          placeholder="••••••••"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </AuthLayout>
  )
}
