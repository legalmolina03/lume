import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Repeat,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useSettings } from '../context/SettingsContext'
import { expandOccurrences, describeRecurrence } from '../lib/recurrence'
import { formatTimeRange, fromDateKey } from '../lib/dates'
import type {
  CalendarEvent,
  CalendarOverlay,
  EventOccurrence,
  Task,
} from '../lib/types'
import { Button, IconButton } from '../components/ui/Button'
import { Card, EmptyState } from '../components/ui/Card'
import { Segmented } from '../components/ui/Field'
import { EventEditor } from '../components/calendar/EventEditor'
import { TaskEditor } from '../components/tasks/TaskEditor'
import { PriorityIcon } from '../components/Signals'
import { firstLine, formatClockTime } from '../components/tasks/TaskCard'

type View = 'day' | 'week' | 'month'

/** A task with a due date, drawn on the calendar as a deadline marker. */
interface TaskMarker {
  task: Task
  day: Date
}

export function CalendarPage() {
  const { events, tasks, lifeAreaById } = useData()
  const { settings, updateSettings } = useSettings()
  const [view, setView] = useState<View>('week')

  const overlay = settings?.calendar_overlay ?? 'both'
  const vertical = settings?.week_view_vertical ?? true
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (view) {
      case 'day':
        return { rangeStart: startOfDay(cursor), rangeEnd: addDays(startOfDay(cursor), 1) }
      case 'week':
        return {
          rangeStart: startOfWeek(cursor, { weekStartsOn: 0 }),
          rangeEnd: endOfWeek(cursor, { weekStartsOn: 0 }),
        }
      case 'month':
        return {
          rangeStart: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
          rangeEnd: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
        }
    }
  }, [view, cursor])

  const occurrences = useMemo(
    () =>
      overlay === 'tasks' ? [] : expandOccurrences(events, rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd, overlay],
  )

  // Deadlines are as much "what's happening this week" as events are, so the
  // calendar can draw them too. Done tasks are omitted: a calendar is for what
  // still needs doing.
  const taskMarkers = useMemo<TaskMarker[]>(() => {
    if (overlay === 'events') return []
    return tasks
      .filter((t) => t.status === 'open' && t.due_date)
      .map((t) => ({ task: t, day: fromDateKey(t.due_date!) }))
      .filter((m) => m.day >= startOfDay(rangeStart) && m.day <= rangeEnd)
      .sort((a, b) => a.day.getTime() - b.day.getTime())
  }, [tasks, rangeStart, rangeEnd, overlay])

  function shift(direction: 1 | -1) {
    setCursor((prev) => {
      if (view === 'month') return addMonths(prev, direction)
      return addDays(prev, direction * (view === 'week' ? 7 : 1))
    })
  }

  function openEditor(event: CalendarEvent | null) {
    setEditing(event)
    setEditorOpen(true)
  }

  const heading =
    view === 'month'
      ? format(cursor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(rangeStart, 'd MMM')} – ${format(rangeEnd, 'd MMM yyyy')}`
        : format(cursor, 'EEEE d MMMM yyyy')

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <IconButton onClick={() => shift(-1)} aria-label="Previous">
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton onClick={() => shift(1)} aria-label="Next">
              <ChevronRight size={16} />
            </IconButton>
          </div>

          <h2 className="text-sm font-semibold">{heading}</h2>

          <Button size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
            Today
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented<View>
              label="Calendar view"
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
            <Button variant="primary" size="sm" onClick={() => openEditor(null)}>
              <Plus size={14} />
              Event
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Segmented<CalendarOverlay>
            label="Show on calendar"
            value={overlay}
            onChange={(v) =>
              void updateSettings({ calendar_overlay: v }).catch(() => {})
            }
            options={[
              { value: 'both', label: 'Both' },
              { value: 'events', label: 'Events' },
              { value: 'tasks', label: 'Tasks' },
            ]}
          />
          {view === 'week' && (
            <Segmented<'vertical' | 'grid'>
              label="Week layout"
              value={vertical ? 'vertical' : 'grid'}
              onChange={(v) =>
                void updateSettings({ week_view_vertical: v === 'vertical' }).catch(
                  () => {},
                )
              }
              options={[
                { value: 'vertical', label: 'List' },
                { value: 'grid', label: 'Grid' },
              ]}
            />
          )}
        </div>

        {view === 'day' && (
          <DayList
            occurrences={occurrences}
            markers={taskMarkers}
            onSelect={openEditor}
            onSelectTask={setEditingTask}
            colorOf={(o) => lifeAreaById(o.event.life_area_id)?.color ?? null}
            taskColorOf={(id) => lifeAreaById(id)?.color ?? null}
          />
        )}

        {view === 'week' &&
          (vertical ? (
            <WeekList
              start={rangeStart}
              occurrences={occurrences}
              markers={taskMarkers}
              onSelect={openEditor}
              onSelectTask={setEditingTask}
              colorOf={(id) => lifeAreaById(id)?.color ?? null}
            />
          ) : (
            <WeekGrid
              start={rangeStart}
              occurrences={occurrences}
              markers={taskMarkers}
              onSelect={openEditor}
              colorOf={(o) => lifeAreaById(o.event.life_area_id)?.color ?? null}
              onPickDay={(day) => {
                setCursor(day)
                setView('day')
              }}
            />
          ))}

        {view === 'month' && (
          <MonthGrid
            cursor={cursor}
            start={rangeStart}
            end={rangeEnd}
            occurrences={occurrences}
            markers={taskMarkers}
            colorOf={(o) => lifeAreaById(o.event.life_area_id)?.color ?? null}
            onPickDay={(day) => {
              setCursor(day)
              setView('day')
            }}
          />
        )}
      </Card>

      <Card>
        <p className="mb-2 text-xs font-medium text-muted">Life areas</p>
        <LifeAreaLegend />
      </Card>

      <EventEditor
        open={editorOpen}
        event={editing}
        defaultDate={cursor}
        onClose={() => setEditorOpen(false)}
      />

      {/* Tasks drawn on the calendar open the same editor as anywhere else. */}
      <TaskEditor
        open={editingTask !== null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
      />
    </div>
  )
}

/** The colour key that makes the week/month grids readable at a glance. */
function LifeAreaLegend() {
  const { lifeAreas } = useData()

  return (
    <div className="flex flex-wrap gap-3 text-[11px]">
      {lifeAreas.length === 0 ? (
        <span className="text-muted">No life areas yet.</span>
      ) : (
        lifeAreas.map((area) => (
          <span
            key={area.id}
            className="inline-flex items-center gap-1.5 text-muted"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: area.color }}
            />
            {area.name}
          </span>
        ))
      )}
    </div>
  )
}

/** A due task rendered as a calendar row. */
function TaskRow({
  task,
  color,
  onSelect,
  compact = false,
}: {
  task: Task
  color: string | null
  onSelect: (task: Task) => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      title={task.description ? firstLine(task.description) : task.title}
      className={`flex w-full items-center gap-2 rounded-lg border border-dashed border-border text-left transition-colors hover:border-accent ${
        compact ? 'px-1.5 py-1' : 'px-3 py-2'
      }`}
    >
      <CheckSquare
        size={compact ? 10 : 13}
        className="shrink-0"
        style={{ color: color ?? 'var(--muted)' }}
      />
      <span
        className={`min-w-0 flex-1 truncate ${compact ? 'text-[10px]' : 'text-sm'}`}
      >
        {task.title}
      </span>
      {!compact && task.due_time && (
        <span className="shrink-0 text-[11px] text-muted">
          {formatClockTime(task.due_time)}
        </span>
      )}
      <PriorityIcon priority={task.priority} size={compact ? 9 : 12} />
    </button>
  )
}

function DayList({
  occurrences,
  markers,
  onSelect,
  onSelectTask,
  colorOf,
  taskColorOf,
}: {
  occurrences: EventOccurrence[]
  markers: TaskMarker[]
  onSelect: (event: CalendarEvent) => void
  onSelectTask: (task: Task) => void
  colorOf: (o: EventOccurrence) => string | null
  taskColorOf: (id: string | null) => string | null
}) {
  // The range is already the single day, so every marker belongs here.
  if (occurrences.length === 0 && markers.length === 0) {
    return <EmptyState title="Nothing scheduled." hint="Add an event to plan the day." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {markers.map((m) => (
        <li key={`task-${m.task.id}`}>
          <TaskRow
            task={m.task}
            color={taskColorOf(m.task.life_area_id)}
            onSelect={onSelectTask}
          />
        </li>
      ))}
      {occurrences.map((o) => {
        const color = colorOf(o)
        return (
          <li key={o.key}>
            <button
              type="button"
              onClick={() => onSelect(o.event)}
              className="flex w-full items-start gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:border-accent"
            >
              <span
                aria-hidden
                className="mt-0.5 h-full min-h-[2.25rem] w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: color ?? 'var(--border)' }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{o.event.title}</p>
                <p className="text-[11px] text-muted">
                  {formatTimeRange(o.start, o.end)}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                  {o.event.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={10} />
                      {o.event.location}
                    </span>
                  )}
                  {o.event.recurring && (
                    <span className="inline-flex items-center gap-1">
                      <Repeat size={10} />
                      {describeRecurrence(o.event.recurrence_rule)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Week as a vertical list, one day per block.
 *
 * Seven columns on a phone gives each day about fifty pixels, which is enough
 * for a coloured smudge and not enough to read. Stacked, every entry keeps its
 * title and time — you scroll instead of squinting.
 */
function WeekList({
  start,
  occurrences,
  markers,
  onSelect,
  onSelectTask,
  colorOf,
}: {
  start: Date
  occurrences: EventOccurrence[]
  markers: TaskMarker[]
  onSelect: (event: CalendarEvent) => void
  onSelectTask: (task: Task) => void
  colorOf: (id: string | null) => string | null
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = new Date()

  return (
    <div className="flex flex-col gap-2">
      {days.map((day) => {
        const dayEvents = occurrences.filter((o) => isSameDay(o.start, day))
        const dayTasks = markers.filter((m) => isSameDay(m.day, day))
        const isToday = isSameDay(day, today)
        const empty = dayEvents.length === 0 && dayTasks.length === 0

        return (
          <div
            key={day.toISOString()}
            className={`rounded-xl border px-3 py-2 ${
              isToday ? 'border-accent bg-accent-soft/30' : 'border-border'
            }`}
          >
            <div className="mb-1.5 flex items-baseline gap-2">
              <span
                className={`text-xs font-semibold ${isToday ? 'text-accent' : ''}`}
              >
                {format(day, 'EEEE')}
              </span>
              <span className="text-[11px] text-muted">{format(day, 'd MMM')}</span>
              {isToday && (
                <span className="text-[10px] font-medium text-accent">Today</span>
              )}
              {!empty && (
                <span className="ml-auto text-[10px] text-muted">
                  {dayEvents.length + dayTasks.length}
                </span>
              )}
            </div>

            {empty ? (
              <p className="text-[11px] text-muted/70">Nothing scheduled</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {dayTasks.map((m) => (
                  <li key={`t-${m.task.id}`}>
                    <TaskRow
                      task={m.task}
                      color={colorOf(m.task.life_area_id)}
                      onSelect={onSelectTask}
                    />
                  </li>
                ))}
                {dayEvents.map((o) => {
                  const color = colorOf(o.event.life_area_id)
                  return (
                    <li key={o.key}>
                      <button
                        type="button"
                        onClick={() => onSelect(o.event)}
                        className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-accent"
                      >
                        <span
                          aria-hidden
                          className="h-7 w-[3px] shrink-0 rounded-full"
                          style={{ backgroundColor: color ?? 'var(--border)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {o.event.title}
                          </p>
                          <p className="truncate text-[11px] text-muted">
                            {formatTimeRange(o.start, o.end)}
                            {o.event.description &&
                              ` · ${firstLine(o.event.description)}`}
                          </p>
                        </div>
                        {o.event.recurring && (
                          <Repeat size={11} className="shrink-0 text-muted" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WeekGrid({
  start,
  occurrences,
  markers,
  onSelect,
  onPickDay,
  colorOf,
}: {
  start: Date
  occurrences: EventOccurrence[]
  markers: TaskMarker[]
  onSelect: (event: CalendarEvent) => void
  onPickDay: (day: Date) => void
  colorOf: (o: EventOccurrence) => string | null
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = new Date()

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((day) => {
        const dayOccurrences = occurrences.filter((o) => isSameDay(o.start, day))
        return (
          <div
            key={day.toISOString()}
            className={`min-h-28 rounded-xl border p-1.5 ${
              isSameDay(day, today) ? 'border-accent' : 'border-border'
            }`}
          >
            <button
              type="button"
              onClick={() => onPickDay(day)}
              className="mb-1 w-full text-left"
            >
              <span className="block text-[10px] text-muted">
                {format(day, 'EEE')}
              </span>
              <span className="block text-xs font-semibold">
                {format(day, 'd')}
              </span>
            </button>

            <div className="flex flex-col gap-1">
              {dayOccurrences.slice(0, 4).map((o) => {
                const color = colorOf(o)
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => onSelect(o.event)}
                    title={`${o.event.title} — ${formatTimeRange(o.start, o.end)}`}
                    style={{
                      backgroundColor: color
                        ? `color-mix(in oklab, ${color} 22%, transparent)`
                        : 'var(--surface-2)',
                      color: color ?? 'var(--text)',
                    }}
                    className="truncate rounded px-1 py-0.5 text-left text-[10px] font-medium"
                  >
                    {format(o.start, 'HH:mm')} {o.event.title}
                  </button>
                )
              })}
              {markers
                .filter((m) => isSameDay(m.day, day))
                .slice(0, 2)
                .map((m) => (
                  <span
                    key={m.task.id}
                    title={m.task.title}
                    className="truncate rounded border border-dashed border-border px-1 text-left text-[10px] text-muted"
                  >
                    {m.task.title}
                  </span>
                ))}
              {dayOccurrences.length > 4 && (
                <span className="px-1 text-[10px] text-muted">
                  +{dayOccurrences.length - 4} more
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthGrid({
  cursor,
  start,
  end,
  occurrences,
  markers,
  onPickDay,
  colorOf,
}: {
  cursor: Date
  start: Date
  end: Date
  occurrences: EventOccurrence[]
  markers: TaskMarker[]
  onPickDay: (day: Date) => void
  colorOf: (o: EventOccurrence) => string | null
}) {
  const days: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  const today = new Date()

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayOccurrences = occurrences.filter((o) => isSameDay(o.start, day))
          const outside = !isSameMonth(day, cursor)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPickDay(day)}
              className={`flex min-h-16 flex-col gap-1 rounded-lg border p-1 text-left transition-colors hover:border-accent ${
                isSameDay(day, today) ? 'border-accent' : 'border-border'
              } ${outside ? 'opacity-40' : ''}`}
            >
              <span className="text-[11px] font-medium">{format(day, 'd')}</span>
              <span className="flex flex-wrap gap-0.5">
                {dayOccurrences.slice(0, 6).map((o) => (
                  <span
                    key={o.key}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: colorOf(o) ?? 'var(--muted)' }}
                  />
                ))}
                {/* Deadlines are hollow, so an event and a due task never
                    read as the same thing at a glance. */}
                {markers
                  .filter((m) => isSameDay(m.day, day))
                  .slice(0, 4)
                  .map((m) => (
                    <span
                      key={m.task.id}
                      title={m.task.title}
                      className="h-1.5 w-1.5 rounded-full border border-muted"
                    />
                  ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
