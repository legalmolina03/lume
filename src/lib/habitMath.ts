import { addDays, isAfter, startOfDay } from 'date-fns'
import type { Habit, HabitLog } from './types'
import { eachDay, fromDateKey, toDateKey, weekStart } from './dates'
import type { DateKey } from './dates'

/**
 * Whether a habit is scheduled on a given day.
 *
 * `x_per_week` habits are never scheduled on a *particular* day — you pick
 * which days to do them — so they count as available every day and their
 * streak is measured in weeks rather than days (see `computeStreaks`).
 */
export function isHabitDueOn(habit: Habit, date: Date): boolean {
  switch (habit.frequency_type) {
    case 'daily':
      return true
    case 'weekly_days':
      return habit.target_days.includes(date.getDay())
    case 'x_per_week':
      return true
  }
}

/** Whether a log satisfies the habit's goal (checkbox tick, or numeric target). */
export function isLogSatisfied(habit: Habit, log: HabitLog | undefined): boolean {
  if (!log) return false
  if (habit.goal_type === 'numeric') {
    return (log.value ?? 0) >= (habit.goal_target ?? 0)
  }
  return log.completed
}

export interface Streaks {
  current: number
  longest: number
  /** 'days' for daily/weekly_days habits, 'weeks' for x_per_week. */
  unit: 'days' | 'weeks'
}

/**
 * Streaks over the habit's own schedule, not over the calendar: skipping a
 * Wednesday on a Tue/Thu habit must not break anything.
 *
 * The in-progress period (today, or the current week) never breaks a streak —
 * you still have time to do it — but it only extends the streak once met.
 */
export function computeStreaks(
  habit: Habit,
  logs: HabitLog[],
  today = new Date(),
): Streaks {
  const byDate = new Map<DateKey, HabitLog>()
  for (const log of logs) byDate.set(log.date, log)

  const satisfiedOn = (date: Date) =>
    isLogSatisfied(habit, byDate.get(toDateKey(date)))

  if (habit.frequency_type === 'x_per_week') {
    return weeklyCountStreaks(habit, logs, today, satisfiedOn)
  }

  const start = earliestRelevantDay(habit, logs, today)
  const scheduled = eachDay(start, today).filter((d) => isHabitDueOn(habit, d))

  let longest = 0
  let run = 0
  for (const day of scheduled) {
    if (satisfiedOn(day)) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }

  // Walk backwards for the current streak, forgiving only the newest period.
  let current = 0
  for (let i = scheduled.length - 1; i >= 0; i -= 1) {
    const day = scheduled[i]
    if (satisfiedOn(day)) {
      current += 1
      continue
    }
    const isToday = toDateKey(day) === toDateKey(today)
    if (isToday) continue // still open — doesn't break the streak
    break
  }

  return { current, longest, unit: 'days' }
}

function weeklyCountStreaks(
  habit: Habit,
  logs: HabitLog[],
  today: Date,
  satisfiedOn: (date: Date) => boolean,
): Streaks {
  const target = habit.times_per_week ?? 1
  const start = weekStart(earliestRelevantDay(habit, logs, today))
  const currentWeek = weekStart(today)

  const weeks: { start: Date; hits: number }[] = []
  for (let w = start; !isAfter(w, currentWeek); w = addDays(w, 7)) {
    let hits = 0
    for (const day of eachDay(w, addDays(w, 6))) {
      if (isAfter(startOfDay(day), startOfDay(today))) break
      if (satisfiedOn(day)) hits += 1
    }
    weeks.push({ start: w, hits })
  }

  let longest = 0
  let run = 0
  for (const week of weeks) {
    if (week.hits >= target) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }

  let current = 0
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    if (weeks[i].hits >= target) {
      current += 1
      continue
    }
    const isCurrentWeek = i === weeks.length - 1
    if (isCurrentWeek) continue // week still in progress
    break
  }

  return { current, longest, unit: 'weeks' }
}

/** Start scanning from whichever came first: creation, or the oldest log. */
function earliestRelevantDay(
  habit: Habit,
  logs: HabitLog[],
  today: Date,
): Date {
  let earliest = startOfDay(new Date(habit.created_at))
  for (const log of logs) {
    const day = fromDateKey(log.date)
    if (day < earliest) earliest = day
  }
  return earliest > today ? startOfDay(today) : earliest
}

/** How many times this week an `x_per_week` habit has been satisfied. */
export function weeklyProgress(
  habit: Habit,
  logs: HabitLog[],
  today = new Date(),
): { done: number; target: number } {
  const byDate = new Map<DateKey, HabitLog>()
  for (const log of logs) byDate.set(log.date, log)

  const start = weekStart(today)
  let done = 0
  for (const day of eachDay(start, today)) {
    if (isLogSatisfied(habit, byDate.get(toDateKey(day)))) done += 1
  }
  return { done, target: habit.times_per_week ?? 1 }
}
