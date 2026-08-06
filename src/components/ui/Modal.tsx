import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

/**
 * Sheet on phones, centred dialog on wider screens. Closes on Escape and on
 * backdrop click; focus moves into the panel on open so keyboard users are not
 * left behind on the page underneath.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface outline-none sm:rounded-2xl"
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <IconButton onClick={onClose} aria-label="Close">
            <X size={16} />
          </IconButton>
        </header>

        <div className="flex flex-col gap-4 p-4">{children}</div>

        {footer && (
          <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
