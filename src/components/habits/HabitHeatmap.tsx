import { addDays, format, startOfDay, subDays } from 'date-fns'
import type { Habit, HabitLog } from '../../lib/types'
import { isHabitDueOn, isLogSatisfied } from '../../lib/habitMath'
import { toDateKey, weekStart } from '../../lib/dates'

const WEEKS = 26 // ~6 months — fits a phone without horizontal scrolling pain

/**
 * GitHub-contributions-style history (Section 4). Columns are weeks, rows are
 * weekdays. Days the habit isn't scheduled on are drawn faintly rather than
 * omitted, so a Tue/Thu habit still reads as a grid instead of a dot cloud.
 */
export function HabitHeatmap({
  habit,
  logs,
}: {
  habit: Habit
  logs: HabitLog[]
}) {
  const today = startOfDay(new Date())
  const firstColumn = weekStart(subDays(today, (WEEKS - 1) * 7))

  const byDate = new Map<string, HabitLog>()
  for (const log of logs) byDate.set(log.date, log)

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstColumn, w * 7 + d)),
  )

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]">
        {columns.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => {
              const future = day > today
              const scheduled = isHabitDueOn(habit, day)
              const done = isLogSatisfied(habit, byDate.get(toDateKey(day)))

              return (
                <span
                  key={day.toISOString()}
                  title={`${format(day, 'EEE d MMM yyyy')}${
                    future ? '' : done ? ' — done' : scheduled ? ' — missed' : ''
                  }`}
                  style={
                    done
                      ? { backgroundColor: habit.color }
                      : undefined
                  }
                  className={`h-[11px] w-[11px] rounded-[3px] ${
                    done
                      ? ''
                      : future
                        ? 'bg-surface-2/40'
                        : scheduled
                          ? 'bg-surface-2'
                          : 'bg-surface-2/40'
                  }`}
                />
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
        <span>{format(firstColumn, 'MMM yyyy')}</span>
        <span className="ml-auto flex items-center gap-1">
          Less
          <span className="h-[9px] w-[9px] rounded-[2px] bg-surface-2" />
          <span
            className="h-[9px] w-[9px] rounded-[2px] opacity-50"
            style={{ backgroundColor: habit.color }}
          />
          <span
            className="h-[9px] w-[9px] rounded-[2px]"
            style={{ backgroundColor: habit.color }}
          />
          More
        </span>
      </div>
    </div>
  )
}
