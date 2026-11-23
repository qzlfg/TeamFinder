import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

/** Каркас публичных экранов входа и регистрации. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-zinc-50">
      <header className="flex h-14 items-center border-b border-zinc-200 bg-white px-6">
        <Link to="/events" className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <span className="flex size-6 items-center justify-center rounded-md bg-zinc-900 text-xs font-semibold text-white">
            TF
          </span>
          TeamFinder
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>

          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">{children}</div>

          <div className="mt-6 text-sm text-zinc-500">{footer}</div>
        </div>
      </main>
    </div>
  )
}
