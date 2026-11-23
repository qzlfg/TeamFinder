import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps extends ComponentProps<'input'> {
  label: string
  error?: string
  hint?: string
}

/** Инпут с подписью, подсказкой и сообщением об ошибке валидации. */
export function FormField({ label, error, hint, className, id, ...props }: FormFieldProps) {
  const fieldId = id ?? props.name

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn('bg-white', className)}
        {...props}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  )
}
