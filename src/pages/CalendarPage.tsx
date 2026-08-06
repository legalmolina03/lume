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
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat } from 'lucide-react'
import { useData } from '../context/DataContext'
import { expandOccurrences, describeRecurrence } from '../lib/recurrence'
import { formatTimeRange } from '../lib/dates'
import type { CalendarEvent, EventOccurrence } from '../lib/types'
import { Button, IconButton } from '../components/ui/Button'
import { Card, EmptyState } from '../components/ui/Card'
import { Segmented } from '../components/ui/Field'
import { EventEditor } from '../components/calendar/EventEditor'

type View = 'day' | 'week' | 'month'

export function CalendarPage() {
  const { events, lifeAreaById } = useData()
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

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
    () => expandOccurrences(events, rangeStart, rangeEnd),
    [events, rangeStart, rangeEnd],
  )

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

          <div className="ml-auto flex items-center gap-2">
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

        {view === 'day' && (
          <DayList
            occurrences={occurrences}
            onSelect={openEditor}
            colorOf={(o) => lifeAreaById(o.event.life_area_id)?.color ?? null}
          />
        )}

        {view === 'week' && (
          <WeekGrid
            start={rangeStart}
            occurrences={occurrences}
            onSelect={openEditor}
            colorOf={(o) => lifeAreaById(o.event.life_area_id)?.color ?? null}
            onPickDay={(day) => {
              setCursor(day)
              setView('day')
            }}
          />
        )}

        {view === 'month' && (
          <MonthGrid
            cursor={cursor}
            start={rangeStart}
            end={rangeEnd}
            occurrences={occurrences}
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

function DayList({
  occurrences,
  onSelect,
  colorOf,
}: {
  occurrences: EventOccurrence[]
  onSelect: (event: CalendarEvent) => void
  colorOf: (o: EventOccurrence) => string | null
}) {
  if (occurrences.length === 0) {
    return <EmptyState title="Nothing scheduled." hint="Add an event to plan the day." />
  }

  return (
    <ul className="flex flex-col gap-2">
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

function WeekGrid({
  start,
  occurrences,
  onSelect,
  onPickDay,
  colorOf,
}: {
  start: Date
  occurrences: EventOccurrence[]
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
  onPickDay,
  colorOf,
}: {
  cursor: Date
  start: Date
  end: Date
  occurrences: EventOccurrence[]
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
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
