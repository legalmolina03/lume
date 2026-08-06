import { addDays, isAfter, isBefore, set, startOfDay } from 'date-fns'
import type { CalendarEvent, EventOccurrence, RecurrenceRule } from './types'
import { WEEKDAY_LABELS, fromDateKey, toDateKey } from './dates'

/**
 * Expands events into concrete occurrences inside a window.
 *
 * The recurrence model is the simple one settled in Section 9/10 — daily,
 * weekly on chosen weekdays, or monthly on a date — so this is a day-by-day
 * scan rather than an RRULE engine. Each occurrence keeps the base event's
 * time of day and duration.
 */
export function expandOccurrences(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventOccurrence[] {
  const out: EventOccurrence[] = []

  for (const event of events) {
    const baseStart = new Date(event.start_datetime)
    const baseEnd = new Date(event.end_datetime)
    const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime())

    if (!event.recurring || !event.recurrence_rule) {
      if (baseStart <= rangeEnd && baseEnd >= rangeStart) {
        out.push({
          event,
          start: baseStart,
          end: baseEnd,
          key: `${event.id}:${toDateKey(baseStart)}`,
        })
      }
      continue
    }

    const rule = event.recurrence_rule
    const until = rule.until ? startOfDay(fromDateKey(rule.until)) : null

    // Never emit an occurrence before the event itself begins.
    let cursor = startOfDay(
      isBefore(rangeStart, baseStart) ? baseStart : rangeStart,
    )
    const scanEnd = startOfDay(rangeEnd)

    while (!isAfter(cursor, scanEnd)) {
      if (until && isAfter(cursor, until)) break

      if (matchesRule(rule, cursor, baseStart)) {
        const start = set(cursor, {
          hours: baseStart.getHours(),
          minutes: baseStart.getMinutes(),
          seconds: 0,
          milliseconds: 0,
        })
        const end = new Date(start.getTime() + durationMs)
        if (start <= rangeEnd && end >= rangeStart) {
          out.push({
            event,
            start,
            end,
            key: `${event.id}:${toDateKey(start)}`,
          })
        }
      }

      cursor = addDays(cursor, 1)
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

function matchesRule(
  rule: RecurrenceRule,
  day: Date,
  baseStart: Date,
): boolean {
  switch (rule.freq) {
    case 'daily':
      return true
    case 'weekly':
      return rule.days.includes(day.getDay())
    case 'monthly':
      // Months without the target date (e.g. the 31st in April) are skipped
      // rather than clamped, so "the 31st" never silently becomes the 30th.
      return day.getDate() === (rule.day_of_month || baseStart.getDate())
  }
}

/** Human-readable summary of a rule, for event cards and the editor. */
export function describeRecurrence(rule: RecurrenceRule | null): string {
  if (!rule) return 'Does not repeat'

  const suffix = rule.until
    ? ` until ${toDateKey(fromDateKey(rule.until))}`
    : ''

  switch (rule.freq) {
    case 'daily':
      return `Every day${suffix}`
    case 'weekly': {
      if (rule.days.length === 0) return `Weekly${suffix}`
      const names = [...rule.days]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_LABELS[d])
      return `Weekly on ${names.join(', ')}${suffix}`
    }
    case 'monthly':
      return `Monthly on the ${ordinal(rule.day_of_month)}${suffix}`
  }
}

function ordinal(n: number): string {
  const rem10 = n % 10
  const rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n}st`
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`
  return `${n}th`
}
