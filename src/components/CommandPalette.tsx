import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Grid2x2, Settings as SettingsIcon } from 'lucide-react'
import { SECTIONS, resolveSectionOrder } from '../lib/sections'
import { useSettings } from '../context/SettingsContext'
import { useData } from '../context/DataContext'

/**
 * Ctrl/Cmd-K to go anywhere or open anything.
 *
 * Deliberately keyboard-first and invisible until summoned: the brief was to
 * keep the app calm, and a palette adds no permanent chrome. It searches your
 * own tasks and habits too, so "that physics thing" is one fuzzy guess away
 * rather than a trip through Tasks and a scroll.
 */
interface Command {
  id: string
  label: string
  hint?: string
  Icon: LucideIcon
  run: () => void
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { tasks, habits } = useData()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
        setCursor(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => {
      setOpen(false)
      navigate(path)
    }

    const sections = resolveSectionOrder(settings?.section_order).map((key) => {
      const s = SECTIONS[key]
      return {
        id: `go-${key}`,
        label: s.label,
        hint: s.blurb,
        Icon: s.Icon,
        run: go(s.path),
      }
    })

    const fixed: Command[] = [
      { id: 'go-hub', label: 'Everything', hint: 'All sections', Icon: Grid2x2, run: go('/menu') },
      {
        id: 'go-settings',
        label: 'Settings',
        hint: 'Appearance, areas, reminders',
        Icon: SettingsIcon,
        run: go('/settings'),
      },
    ]

    // Your own content, so the palette answers "where was that?" as well as
    // "where do I go?". Capped because a palette that scrolls is a list.
    const openTasks = tasks
      .filter((t) => t.status === 'open')
      .slice(0, 20)
      .map((t) => ({
        id: `task-${t.id}`,
        label: t.title,
        hint: 'Task',
        Icon: SECTIONS.tasks.Icon,
        run: go('/tasks'),
      }))

    const activeHabits = habits
      .filter((h) => !h.archived)
      .slice(0, 20)
      .map((h) => ({
        id: `habit-${h.id}`,
        label: h.name,
        hint: 'Habit',
        Icon: SECTIONS.habits.Icon,
        run: go('/habits'),
      }))

    return [...sections, ...fixed, ...openTasks, ...activeHabits]
  }, [navigate, settings, tasks, habits])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 8)
    return commands
      .filter((c) => c.label.toLowerCase().includes(q))
      .slice(0, 10)
  }, [commands, query])

  useEffect(() => setCursor(0), [query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, results.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              }
              if (e.key === 'Enter') results[cursor]?.run()
            }}
            placeholder="Jump to a section, task or habit…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted/70"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted">No matches.</p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto p-1.5">
            {results.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={c.run}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    i === cursor ? 'bg-accent-soft text-accent' : 'text-text'
                  }`}
                >
                  <c.Icon size={15} strokeWidth={1.7} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.label}</span>
                  {c.hint && (
                    <span className="shrink-0 text-[11px] text-muted">{c.hint}</span>
                  )}
                  {i === cursor && (
                    <CornerDownLeft size={13} className="shrink-0 text-muted" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
