import { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import type { Habit, HabitLog } from '../../lib/types'
import { isLogSatisfied } from '../../lib/habitMath'
import { useData } from '../../context/DataContext'

/**
 * The daily check-off control. Checkbox habits get a single tick; numeric ones
 * get a stepper that shows progress toward the target ("5 / 8 glasses").
 *
 * Both write straight through to `habit_logs` — there is no local "unsaved"
 * state to lose, because the whole point of the home screen is one-tap logging.
 */
export function HabitCheck({
  habit,
  log,
  date,
}: {
  habit: Habit
  log: HabitLog | undefined
  date: string
}) {
  const { setHabitLog } = useData()
  const [busy, setBusy] = useState(false)
  const satisfied = isLogSatisfied(habit, log)

  async function write(patch: { completed?: boolean; value?: number | null }) {
    setBusy(true)
    try {
      await setHabitLog(habit.id, date, patch)
    } finally {
      setBusy(false)
    }
  }

  if (habit.goal_type === 'checkbox') {
    return (
      <button
        type="button"
        disabled={busy}
        role="checkbox"
        aria-checked={satisfied}
        aria-label={`Mark ${habit.name} ${satisfied ? 'not done' : 'done'}`}
        onClick={() => void write({ completed: !satisfied })}
        style={satisfied ? { backgroundColor: habit.color, borderColor: habit.color } : undefined}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all disabled:opacity-50 ${
          satisfied ? 'text-white' : 'border-border text-transparent hover:border-accent'
        }`}
      >
        <Check size={17} strokeWidth={2.5} />
      </button>
    )
  }

  const value = log?.value ?? 0
  const target = habit.goal_target ?? 1
  // The habit's own step, so "500 steps a tap" and "one glass a tap" can
  // coexist instead of being guessed from the size of the target.
  const step = Number(habit.step) || 1

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        disabled={busy || value <= 0}
        aria-label={`Decrease ${habit.name}`}
        onClick={() =>
          void write({ value: Math.max(0, value - step), completed: false })
        }
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors hover:text-text disabled:opacity-40"
      >
        <Minus size={14} />
      </button>

      <span
        className="min-w-[4.5rem] text-center text-xs tabular-nums"
        style={satisfied ? { color: habit.color } : undefined}
      >
        <span className="font-semibold">{value}</span>
        <span className="text-muted">
          {' / '}
          {target}
        </span>
        {habit.unit && <span className="text-muted"> {habit.unit}</span>}
      </span>

      <button
        type="button"
        disabled={busy}
        aria-label={`Increase ${habit.name}`}
        onClick={() => {
          const next = value + step
          void write({ value: next, completed: next >= target })
        }}
        style={
          satisfied
            ? { backgroundColor: habit.color, borderColor: habit.color, color: '#fff' }
            : undefined
        }
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors hover:text-text disabled:opacity-40"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
