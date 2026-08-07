import {
  CalendarDays,
  CheckSquare,
  History,
  Repeat,
  Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DEFAULT_SECTION_ORDER } from './types'
import type { SectionKey } from './types'

/**
 * One description of each section, read by the nav, the hub and the dashboard.
 *
 * Before this existed the same five entries were spelled out separately in
 * three components, which is why the radial ring and the header could drift
 * apart. Ordering is a user setting, so nothing here hardcodes a sequence.
 */
export interface SectionMeta {
  key: SectionKey
  label: string
  path: string
  Icon: LucideIcon
  /** One line explaining the section on the hub. */
  blurb: string
}

export const SECTIONS: Record<SectionKey, SectionMeta> = {
  habits: {
    key: 'habits',
    label: 'Habits',
    path: '/habits',
    Icon: Repeat,
    blurb: 'Recurring things you want to do consistently',
  },
  tasks: {
    key: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    Icon: CheckSquare,
    blurb: 'One-off things with deadlines',
  },
  focus: {
    key: 'focus',
    label: 'Focus',
    path: '/focus',
    Icon: Timer,
    blurb: 'Timer, session notes and history',
  },
  calendar: {
    key: 'calendar',
    label: 'Calendar',
    path: '/calendar',
    Icon: CalendarDays,
    blurb: 'Events and deadlines by day, week or month',
  },
  activity: {
    key: 'activity',
    label: 'Activity',
    path: '/activity',
    Icon: History,
    blurb: 'Everything you have logged, in one feed',
  },
}

/**
 * A stored order, repaired.
 *
 * A saved array can go stale — an unknown key from an older build, or a
 * section missing because it was added after the row was written. Unknown keys
 * are dropped and missing ones appended, so the app never renders a partial
 * menu just because the setting is out of date.
 */
export function resolveSectionOrder(stored: string[] | null | undefined): SectionKey[] {
  const known = new Set(DEFAULT_SECTION_ORDER)
  const seen = new Set<SectionKey>()
  const out: SectionKey[] = []

  for (const key of stored ?? []) {
    if (known.has(key as SectionKey) && !seen.has(key as SectionKey)) {
      out.push(key as SectionKey)
      seen.add(key as SectionKey)
    }
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) out.push(key)
  }
  return out
}
