import {
  addDays,
  differenceInCalendarDays,
  format,
  parse,
  startOfDay,
  startOfWeek,
} from 'date-fns'

/**
 * Habit logs and task due dates are calendar dates, not instants: "did I drink
 * water on the 6th" is a question about the user's local day. These helpers
 * keep the `yyyy-MM-dd` <-> Date conversion in one place so no component ever
 * reaches for `toISOString()`, which would silently shift the day across UTC.
 */

export type DateKey = string

export function toDateKey(date: Date): DateKey {
  return format(date, 'yyyy-MM-dd')
}

export function fromDateKey(key: DateKey): Date {
  return parse(key, 'yyyy-MM-dd', new Date())
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

/** Weeks run Sunday-first to match the 0 = Sunday weekday numbering in the DB. */
export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 })
}

export function daysBetween(from: Date, to: Date): number {
  return differenceInCalendarDays(to, from)
}

/** Inclusive list of dates from `from` to `to`. */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = []
  let cursor = startOfDay(from)
  const end = startOfDay(to)
  while (cursor <= end) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "in 3 days" / "2 days ago" / "today" — for due dates and activity rows. */
export function relativeDayLabel(date: Date, reference = new Date()): string {
  const delta = differenceInCalendarDays(startOfDay(date), startOfDay(reference))
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta < 7) return format(date, 'EEEE')
  if (delta < 0) return `${Math.abs(delta)} days ago`
  return format(date, 'MMM d')
}

export function formatTimeRange(start: Date, end: Date): string {
  const sameMeridiem = format(start, 'a') === format(end, 'a')
  const startFmt = sameMeridiem ? 'h:mm' : 'h:mm a'
  return `${format(start, startFmt)}–${format(end, 'h:mm a')}`
}

/** Minutes rendered as "1h 25m" / "45m". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total}m`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** Seconds rendered as a clock — "24:59". */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
