import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Settings } from 'lucide-react'
import { endOfDay, startOfDay, startOfWeek, subDays } from 'date-fns'
import { useData } from '../context/DataContext'
import { useSettings } from '../context/SettingsContext'
import { SECTIONS, resolveSectionOrder } from '../lib/sections'
import { isHabitDueOn, isLogSatisfied } from '../lib/habitMath'
import { expandOccurrences } from '../lib/recurrence'
import { fromDateKey, formatDuration, todayKey } from '../lib/dates'
import { isOverdue } from '../components/tasks/TaskCard'
import type { SectionKey } from '../lib/types'
import { Card } from '../components/ui/Card'

/**
 * The hub: every section in one place, each with a line of live state.
 *
 * The point is that it answers "what needs me?" without opening anything. A
 * grid of five identical buttons would just be the navigation menu again, so
 * each tile carries the one number that would have made you go and look.
 */
export function OverviewPage() {
  const { habits, habitLogs, tasks, events, focusSessions } = useData()
  const { settings } = useSettings()

  const order = resolveSectionOrder(settings?.section_order)
  const today = todayKey()

  const summaries = useMemo<Record<SectionKey, { headline: string; detail: string }>>(
    () => {
      const day = fromDateKey(today)

      const dueHabits = habits.filter((h) => !h.archived && isHabitDueOn(h, day))
      const logsToday = new Map(
        habitLogs.filter((l) => l.date === today).map((l) => [l.habit_id, l]),
      )
      const habitsDone = dueHabits.filter((h) =>
        isLogSatisfied(h, logsToday.get(h.id)),
      ).length

      const open = tasks.filter((t) => t.status === 'open')
      const overdue = open.filter((t) => isOverdue(t)).length

      const todaysEvents = expandOccurrences(
        events,
        startOfDay(day),
        endOfDay(day),
      )

      const weekStart = startOfWeek(day, { weekStartsOn: 0 })
      const focusThisWeek = focusSessions
        .filter((s) => new Date(s.started_at) >= weekStart)
        .reduce((total, s) => total + Number(s.duration_minutes), 0)

      const since = subDays(day, 7)
      const recent =
        habitLogs.filter((l) => fromDateKey(l.date) >= since && l.completed).length +
        tasks.filter(
          (t) => t.completed_at && new Date(t.completed_at) >= since,
        ).length +
        focusSessions.filter((s) => new Date(s.started_at) >= since).length

      return {
        habits: {
          headline:
            dueHabits.length === 0
              ? 'Nothing due'
              : `${habitsDone} of ${dueHabits.length} done`,
          detail:
            dueHabits.length === 0
              ? 'No habits scheduled today'
              : habitsDone === dueHabits.length
                ? 'All clear for today'
                : `${dueHabits.length - habitsDone} still to log`,
        },
        tasks: {
          headline: open.length === 0 ? 'Nothing open' : `${open.length} open`,
          detail:
            overdue > 0
              ? `${overdue} overdue`
              : open.length === 0
                ? 'Inbox zero'
                : 'Nothing overdue',
        },
        focus: {
          headline:
            focusThisWeek > 0 ? formatDuration(focusThisWeek) : 'No sessions',
          detail: focusThisWeek > 0 ? 'focused this week' : 'Start one today',
        },
        calendar: {
          headline:
            todaysEvents.length === 0
              ? 'Clear today'
              : `${todaysEvents.length} today`,
          detail:
            todaysEvents.length > 0
              ? todaysEvents[0].event.title
              : 'Nothing scheduled',
        },
        activity: {
          headline: `${recent} logged`,
          detail: 'in the last 7 days',
        },
      }
    },
    [habits, habitLogs, tasks, events, focusSessions, today],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Everything</h1>
          <p className="text-xs text-muted">
            Reorder these under Settings → Sections.
          </p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-text"
        >
          <Settings size={14} />
          Settings
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((key) => {
          const section = SECTIONS[key]
          const summary = summaries[key]
          return (
            <Link key={key} to={section.path} className="group">
              <Card className="h-full transition-colors group-hover:border-accent">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <section.Icon size={17} strokeWidth={1.7} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-semibold">{section.label}</h2>
                      <ChevronRight
                        size={14}
                        className="text-muted transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                    <p className="mt-1 truncate text-sm">{summary.headline}</p>
                    <p className="truncate text-[11px] text-muted">
                      {summary.detail}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
