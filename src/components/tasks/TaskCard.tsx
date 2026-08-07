import { Bell, Check, Pin, PinOff } from 'lucide-react'
import { format, isBefore, parse, startOfDay } from 'date-fns'
import type { Task } from '../../lib/types'
import { fromDateKey, relativeDayLabel } from '../../lib/dates'
import { useData } from '../../context/DataContext'
import { LifeAreaChip, PriorityIcon } from '../Signals'
import { IconButton } from '../ui/Button'

export function isOverdue(task: Task, today = new Date()): boolean {
  if (task.status === 'done' || !task.due_date) return false
  return isBefore(fromDateKey(task.due_date), startOfDay(today))
}

/** `14:30:00` from Postgres rendered as `2:30 PM`. */
export function formatClockTime(time: string): string {
  return format(parse(time.slice(0, 5), 'HH:mm', new Date()), 'h:mm a')
}

/** First non-empty line, trimmed — a preview, not the whole note. */
export function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim())?.trim() ?? ''
}

/**
 * Three signals, three channels (Section 9a): the life-area colour is the left
 * stripe and the chip, the priority is the flag's fill level, and overdue is a
 * pulsing red edge that overrides both.
 */
export function TaskCard({
  task,
  onEdit,
  showPin = true,
}: {
  task: Task
  onEdit?: (task: Task) => void
  showPin?: boolean
}) {
  const { lifeAreaById, projectById, setTaskDone, setTaskPinned } = useData()
  const area = lifeAreaById(task.life_area_id)
  const project = projectById(task.project_id)
  const overdue = isOverdue(task)
  const done = task.status === 'done'

  return (
    <div
      className={`relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface-2/50 py-2.5 pr-2 pl-3.5 ${
        overdue ? 'overdue-edge' : ''
      }`}
    >
      {!overdue && area && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] rounded-full"
          style={{ backgroundColor: area.color }}
        />
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${task.title}" ${done ? 'not done' : 'done'}`}
        onClick={() => void setTaskDone(task.id, !done)}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
          done
            ? 'border-accent bg-accent text-accent-contrast'
            : 'border-border text-transparent hover:border-accent'
        }`}
      >
        <Check size={13} strokeWidth={3} />
      </button>

      <button
        type="button"
        onClick={() => onEdit?.(task)}
        disabled={!onEdit}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <p
          className={`truncate text-sm ${done ? 'text-muted line-through' : 'font-medium'}`}
        >
          {task.title}
        </p>
        {/* First line of the notes: enough to recognise a task without
            opening it, and nothing more. */}
        {task.description && (
          <p className="mt-0.5 truncate text-[11px] text-muted/90">
            {firstLine(task.description)}
          </p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          {task.due_date && (
            <span className={overdue ? 'font-medium text-danger' : ''}>
              {relativeDayLabel(fromDateKey(task.due_date))}
              {task.due_time && ` · ${formatClockTime(task.due_time)}`}
            </span>
          )}
          {task.remind_minutes_before !== null && (
            <span
              className="inline-flex items-center gap-1"
              title="Reminder set"
              aria-label="Reminder set"
            >
              <Bell size={10} />
            </span>
          )}
          {project && <span>{project.name}</span>}
          {area && <LifeAreaChip area={area} />}
        </div>
      </button>

      <PriorityIcon priority={task.priority} />

      {showPin && !done && (
        <IconButton
          aria-label={task.pinned ? 'Unpin task' : 'Pin task'}
          onClick={() => void setTaskPinned(task.id, !task.pinned).catch(() => {})}
          className={task.pinned ? 'text-accent' : ''}
        >
          {task.pinned ? <Pin size={15} /> : <PinOff size={15} />}
        </IconButton>
      )}
    </div>
  )
}
