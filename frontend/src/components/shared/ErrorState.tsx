import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

/** Состояние ошибки загрузки с кнопкой повтора. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-950">Не удалось загрузить данные</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        {message ?? 'Проверьте соединение и попробуйте ещё раз.'}
      </p>
      {onRetry ? (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Повторить
        </Button>
      ) : null}
    </div>
  )
}
