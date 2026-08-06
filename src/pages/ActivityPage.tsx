import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns'
import { CalendarDays, CheckSquare, Repeat, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { toDateKey } from '../lib/dates'
import type { ActivityEntry, ActivityKind } from '../lib/types'
import { Card, EmptyState, ErrorBanner, SectionHeader } from '../components/ui/Card'
import { Field, Input, Segmented, Select } from '../components/ui/Field'
import { LifeAreaChip } from '../components/Signals'

type RangePreset = '7d' | '30d' | 'month' | 'custom'

const KIND_META: Record<ActivityKind, { label: string; Icon: LucideIcon }> = {
  habit: { label: 'Habit', Icon: Repeat },
  task: { label: 'Task', Icon: CheckSquare },
  focus: { label: 'Focus', Icon: Timer },
  event: { label: 'Event', Icon: CalendarDays },
}

function rangeFor(preset: RangePreset, from: string, to: string) {
  const now = new Date()
  switch (preset) {
    case '7d':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) }
    case '30d':
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) }
    case 'month':
      return { start: startOfMonth(now), end: endOfDay(now) }
    case 'custom':
      return {
        start: startOfDay(new Date(`${from}T00:00`)),
        end: endOfDay(new Date(`${to}T00:00`)),
      }
  }
}

/**
 * The unified "proof of work" feed (Section 4a). It reads the `activity_log`
 * view rather than stitching four client-side lists together, so a habit tick,
 * a finished task, a focus session and a past event are already interleaved and
 * filtered by the database.
 */
export function ActivityPage() {
  const { lifeAreas, lifeAreaById } = useData()

  const [preset, setPreset] = useState<RangePreset>('30d')
  const [from, setFrom] = useState(() => toDateKey(subDays(new Date(), 29)))
  const [to, setTo] = useState(() => toDateKey(new Date()))
  const [areaFilter, setAreaFilter] = useState('')
  const [kindFilter, setKindFilter] = useState<ActivityKind | ''>('')

  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { start, end } = useMemo(
    () => rangeFor(preset, from, to),
    [preset, from, to],
  )

  const load = useCallback(async () => {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Check the date range.')
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase
      .from('activity_log')
      .select('*')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(500)

    if (areaFilter) query = query.eq('life_area_id', areaFilter)
    if (kindFilter) query = query.eq('kind', kindFilter)

    const { data, error: err } = await query
    if (err) setError(err.message)
    else setEntries(data ?? [])
    setLoading(false)
  }, [start, end, areaFilter, kindFilter])

  useEffect(() => {
    void load()
  }, [load])

  // Grouped by day so the feed reads as a diary rather than a flat list.
  const days = useMemo(() => {
    const groups: { day: Date; items: ActivityEntry[] }[] = []
    for (const entry of entries) {
      const when = new Date(entry.occurred_at)
      const last = groups[groups.length - 1]
      if (last && isSameDay(last.day, when)) last.items.push(entry)
      else groups.push({ day: when, items: [entry] })
    }
    return groups
  }, [entries])

  const counts = useMemo(() => {
    const out: Record<ActivityKind, number> = {
      habit: 0,
      task: 0,
      focus: 0,
      event: 0,
    }
    for (const entry of entries) out[entry.kind] += 1
    return out
  }, [entries])

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader
          title="Activity"
          hint={`${entries.length} entries`}
        />

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Range">
            <Segmented<RangePreset>
              label="Date range"
              value={preset}
              onChange={setPreset}
              options={[
                { value: '7d', label: '7 days' },
                { value: '30d', label: '30 days' },
                { value: 'month', label: 'This month' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </Field>

          {preset === 'custom' && (
            <>
              <Field label="From">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="To">
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </>
          )}

          <Field label="Life area">
            <Select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value="">All areas</option>
              {lifeAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type">
            <Select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as ActivityKind | '')}
            >
              <option value="">Everything</option>
              {(Object.keys(KIND_META) as ActivityKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_META[kind].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-[11px] text-muted">
          {(Object.keys(KIND_META) as ActivityKind[]).map((kind) => {
            const { label, Icon } = KIND_META[kind]
            return (
              <span key={kind} className="inline-flex items-center gap-1.5">
                <Icon size={12} />
                {counts[kind]} {label.toLowerCase()}
                {counts[kind] === 1 ? '' : 's'}
              </span>
            )
          })}
        </div>
      </Card>

      <ErrorBanner message={error} />

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : days.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing logged in this range."
            hint="Tick off a habit, finish a task or run a focus session and it lands here."
          />
        </Card>
      ) : (
        days.map(({ day, items }) => (
          <Card key={day.toISOString()}>
            <p className="mb-2 text-xs font-semibold text-muted">
              {format(day, 'EEEE d MMMM')}
            </p>
            <ul className="flex flex-col gap-1.5">
              {items.map((entry) => {
                const { Icon, label } = KIND_META[entry.kind]
                const area = lifeAreaById(entry.life_area_id)
                return (
                  <li
                    key={`${entry.kind}-${entry.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2/60"
                  >
                    <Icon size={14} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {entry.title}
                    </span>
                    {entry.detail && (
                      <span className="shrink-0 text-[11px] text-muted">
                        {entry.detail}
                      </span>
                    )}
                    {area && <LifeAreaChip area={area} />}
                    <span className="w-10 shrink-0 text-right text-[11px] text-muted">
                      {entry.kind === 'habit'
                        ? label
                        : format(new Date(entry.occurred_at), 'HH:mm')}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}
