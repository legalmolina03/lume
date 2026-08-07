import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Brief confirmations with an optional undo.
 *
 * Completing a task makes it vanish from the list, which is the point — but a
 * disappearing row is also indistinguishable from a misfire. The toast says
 * what happened and offers the way back, so getting things out of the way
 * doesn't require being careful.
 */
interface Toast {
  id: number
  message: string
  undo?: () => void | Promise<void>
}

interface ToastValue {
  show: (message: string, undo?: () => void | Promise<void>) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const VISIBLE_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, undo?: () => void | Promise<void>) => {
      const id = nextId.current++
      setToasts((prev) => [...prev.slice(-2), { id, message, undo }])
      window.setTimeout(() => dismiss(id), VISIBLE_MS)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {/* Above the radial ring, and clear of the home indicator. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[55] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-lg"
          >
            <span className="min-w-0 flex-1 truncate text-xs">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  void toast.undo?.()
                  dismiss(toast.id)
                }}
                className="shrink-0 text-xs font-semibold text-accent"
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  // A missing provider should not take a page down over a confirmation.
  return ctx ?? { show: () => {} }
}
