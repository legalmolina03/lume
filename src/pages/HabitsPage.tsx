import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Flame,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { todayKey } from '../lib/dates'
import { computeStreaks, isHabitDueOn, weeklyProgress } from '../lib/habitMath'
import type { Habit } from '../lib/types'
import { Button, IconButton } from '../components/ui/Button'
import { Card, EmptyState, SectionHeader } from '../components/ui/Card'
import { LifeAreaChip } from '../components/Signals'
import { HabitCheck } from '../components/habits/HabitCheck'
import { HabitEditor } from '../components/habits/HabitEditor'
import { HabitHeatmap } from '../components/habits/HabitHeatmap'

export function HabitsPage() {
  const { habits, habitLogs, lifeAreaById, updateHabit, deleteHabit } = useData()
  const [editing, setEditing] = useState<Habit | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const today = todayKey()
  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  const logsByHabit = useMemo(() => {
    const map = new Map<string, typeof habitLogs>()
    for (const log of habitLogs) {
      const list = map.get(log.habit_id)
      if (list) list.push(log)
      else map.set(log.habit_id, [log])
    }
    return map
  }, [habitLogs])

  function openEditor(habit: Habit | null) {
    setEditing(habit)
    setEditorOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader
          title="Habits"
          hint={`${active.length} active`}
          action={
            <Button variant="primary" size="sm" onClick={() => openEditor(null)}>
              <Plus size={14} />
              New habit
            </Button>
          }
        />

        {active.length === 0 ? (
          <EmptyState
            title="No habits yet."
            hint="Start with one small thing you want to do consistently."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((habit) => {
              const logs = logsByHabit.get(habit.id) ?? []
              const streaks = computeStreaks(habit, logs)
              const log = logs.find((l) => l.date === today)
              const dueToday = isHabitDueOn(habit, new Date())
              const isOpen = expanded === habit.id
              const area = lifeAreaById(habit.life_area_id)

              return (
                <li
                  key={habit.id}
                  className="rounded-xl border border-border bg-surface-2/50"
                >
                  <div className="flex items-center gap-3 p-3">
                    <span
                      aria-hidden
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: habit.color }}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{habit.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                        <span>{frequencyLabel(habit)}</span>
                        {streaks.current > 0 && (
                          <span className="inline-flex items-center gap-1 text-accent">
                            <Flame size={11} />
                            {streaks.current} {streaks.unit === 'weeks' ? 'wk' : 'd'}
                          </span>
                        )}
                        {streaks.longest > 0 && (
                          <span>best {streaks.longest}</span>
                        )}
                        {area && <LifeAreaChip area={area} />}
                      </div>
                    </div>

                    {dueToday ? (
                      <HabitCheck habit={habit} log={log} date={today} />
                    ) : (
                      <span className="text-[11px] text-muted">Not today</span>
                    )}

                    <IconButton
                      onClick={() => setExpanded(isOpen ? null : habit.id)}
                      aria-label={isOpen ? 'Hide history' : 'Show history'}
                      aria-expanded={isOpen}
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </IconButton>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border px-3 py-3">
                      {habit.frequency_type === 'x_per_week' && (
                        <p className="mb-3 text-[11px] text-muted">
                          This week: {weeklyProgress(habit, logs).done} of{' '}
                          {weeklyProgress(habit, logs).target}
                        </p>
                      )}

                      <HabitHeatmap habit={habit} logs={logs} />

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => openEditor(habit)}>
                          <Pencil size={13} />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            void updateHabit(habit.id, { archived: true })
                          }
                        >
                          <Archive size={13} />
                          Archive
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {archived.length > 0 && (
        <Card>
          <SectionHeader
            title="Archived"
            hint={`${archived.length}`}
            action={
              <Button size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Hide' : 'Show'}
              </Button>
            }
          />

          {showArchived && (
            <ul className="flex flex-col gap-2">
              {archived.map((habit) => (
                <li
                  key={habit.id}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {habit.name}
                  </span>
                  <IconButton
                    aria-label={`Restore ${habit.name}`}
                    onClick={() => void updateHabit(habit.id, { archived: false })}
                  >
                    <ArchiveRestore size={15} />
                  </IconButton>
                  <IconButton
                    aria-label={`Delete ${habit.name}`}
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${habit.name}" and its entire history? Archiving keeps the history instead.`,
                        )
                      ) {
                        void deleteHabit(habit.id)
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <HabitEditor
        open={editorOpen}
        habit={editing}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  )
}

function frequencyLabel(habit: Habit): string {
  switch (habit.frequency_type) {
    case 'daily':
      return 'Every day'
    case 'weekly_days': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return [...habit.target_days]
        .sort((a, b) => a - b)
        .map((d) => names[d])
        .join(', ')
    }
    case 'x_per_week':
      return `${habit.times_per_week ?? 1}× a week`
  }
}
