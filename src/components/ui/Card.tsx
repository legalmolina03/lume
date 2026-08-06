import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-surface p-4 ${className}`}
    >
      {children}
    </section>
  )
}

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-3 flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {action}
    </header>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm text-muted">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted/80">{hint}</p>}
      {action}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
    >
      {message}
    </p>
  )
}
