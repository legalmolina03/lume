import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { endOfDay, format, startOfDay } from 'date-fns'
import { MapPin, Play, Plus } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { isHabitDueOn, isLogSatisfied } from '../lib/habitMath'
import { expandOccurrences } from '../lib/recurrence'
import { formatTimeRange, fromDateKey, todayKey } from '../lib/dates'
import type { Task } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Card, EmptyState, SectionHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { HabitCheck } from '../components/habits/HabitCheck'
import { TaskCard } from '../components/tasks/TaskCard'
import { TaskEditor } from '../components/tasks/TaskEditor'

/** How many tasks the dashboard shows once pinned ones are accounted for. */
const TOP_TASK_COUNT = 6

export function DashboardPage() {
  const { habits, habitLogs, tasks, events, lifeAreaById, loading } = useData()
  const { settings } = useSettings()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [editing, setEditing] = useState<Task | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [focusMinutes, setFocusMinutes] = useState(25)

  const today = todayKey()
  const now = new Date()

  // Keyed off the date string rather than `now`, so these don't recompute on
  // every render just because `new Date()` is a fresh object each time.
  const dueHabits = useMemo(
    () => habits.filter((h) => !h.archived && isHabitDueOn(h, fromDateKey(today))),
    [habits, today],
  )

  const logsToday = useMemo(
    () => new Map(habitLogs.filter((l) => l.date === today).map((l) => [l.habit_id, l])),
    [habitLogs, today],
  )

  const habitsDone = dueHabits.filter((h) =>
    isLogSatisfied(h, logsToday.get(h.id)),
  ).length

  /**
   * Pinned tasks always come first, in the order the user set (Section 4);
   * everything else falls back to the soonest due date, undated last.
   */
  const topTasks = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'open')
    const pinned = open
      .filter((t) => t.pinned)
      .sort((a, b) => (a.pinned_order ?? 0) - (b.pinned_order ?? 0))
    const rest = open
      .filter((t) => !t.pinned)
      .sort((a, b) => {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
      })
    return [...pinned, ...rest].slice(0, TOP_TASK_COUNT)
  }, [tasks])

  const todaysEvents = useMemo(() => {
    const day = fromDateKey(today)
    return expandOccurrences(events, startOfDay(day), endOfDay(day))
  }, [events, today])

  const greeting = `${timeGreeting(now)}${
    user?.email ? `, ${user.email.split('@')[0]}` : ''
  }`

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">{greeting}</h1>
        <p className="text-xs text-muted">{format(now, 'EEEE d MMMM')}</p>
      </div>

      {/* Front and centre, per Section 4 — one tap from anything else. */}
      <Card className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() => navigate(`/focus?minutes=${focusMinutes}`)}
          className="grow sm:grow-0"
        >
          <Play size={15} />
          Start focus session
        </Button>

        <label className="flex items-center gap-2 text-xs text-muted">
          <Input
            type="number"
            min={1}
            max={240}
            value={focusMinutes}
            onChange={(e) =>
              setFocusMinutes(
                Math.min(240, Math.max(1, Number(e.target.value) || 1)),
              )
            }
            className="w-20"
          />
          minutes
        </label>

        {settings && (
          <span className="text-[11px] text-muted">
            Default {settings.default_pomodoro_minutes}/
            {settings.default_break_minutes}
          </span>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Today's habits"
          hint={
            dueHabits.length > 0
              ? `${habitsDone} of ${dueHabits.length} done`
              : undefined
          }
          action={
            <Button size="sm" onClick={() => navigate('/habits')}>
              All habits
            </Button>
          }
        />

        {dueHabits.length === 0 ? (
          <EmptyState
            title="Nothing scheduled today."
            hint="Habits you set for other days will show up on those days."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {dueHabits.map((habit) => {
              const log = logsToday.get(habit.id)
              const done = isLogSatisfied(habit, log)
              return (
                <li
                  key={habit.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2"
                >
                  <span
                    aria-hidden
                    className="h-7 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      done ? 'text-muted' : 'font-medium'
                    }`}
                  >
                    {habit.name}
                  </span>
                  <HabitCheck habit={habit} log={log} date={today} />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Top tasks"
          hint="Pinned first, then soonest due"
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null)
                setEditorOpen(true)
              }}
            >
              <Plus size={14} />
              New
            </Button>
          }
        />

        {topTasks.length === 0 ? (
          <EmptyState title="Nothing open." hint="Enjoy it, or add something." />
        ) : (
          <ul className="flex flex-col gap-2">
            {topTasks.map((task) => (
              <li key={task.id}>
                <TaskCard
                  task={task}
                  onEdit={(t) => {
                    setEditing(t)
                    setEditorOpen(true)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Today's schedule"
          hint={todaysEvents.length > 0 ? `${todaysEvents.length}` : undefined}
          action={
            <Button size="sm" onClick={() => navigate('/calendar')}>
              Calendar
            </Button>
          }
        />

        {todaysEvents.length === 0 ? (
          <EmptyState title="Nothing on the calendar today." />
        ) : (
          <ul className="flex flex-col gap-2">
            {todaysEvents.map((o) => {
              const area = lifeAreaById(o.event.life_area_id)
              const past = o.end < now
              return (
                <li
                  key={o.key}
                  className={`flex items-center gap-3 rounded-xl border border-border px-3 py-2 ${
                    past ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-7 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: area?.color ?? 'var(--border)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.event.title}</p>
                    <p className="flex items-center gap-2 text-[11px] text-muted">
                      {formatTimeRange(o.start, o.end)}
                      {o.event.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={10} />
                          {o.event.location}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <TaskEditor
        open={editorOpen}
        task={editing}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  )
}

function timeGreeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
