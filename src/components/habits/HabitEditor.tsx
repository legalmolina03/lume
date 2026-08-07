import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Habit, HabitFrequency, HabitGoalType } from '../../lib/types'
import { useData } from '../../context/DataContext'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/Card'
import {
  ColorPicker,
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
  WeekdayPicker,
} from '../ui/Field'

interface Draft {
  name: string
  life_area_id: string
  frequency_type: HabitFrequency
  target_days: number[]
  times_per_week: number
  goal_type: HabitGoalType
  goal_target: number
  unit: string
  step: number
  color: string
  notes: string
  reminder_time: string
}

function draftFrom(habit: Habit | null): Draft {
  return {
    name: habit?.name ?? '',
    life_area_id: habit?.life_area_id ?? '',
    frequency_type: habit?.frequency_type ?? 'daily',
    target_days: habit?.target_days ?? [1, 3, 5],
    times_per_week: habit?.times_per_week ?? 3,
    goal_type: habit?.goal_type ?? 'checkbox',
    goal_target: habit?.goal_target ?? 8,
    unit: habit?.unit ?? '',
    step: habit?.step ?? 1,
    color: habit?.color ?? '#6366f1',
    notes: habit?.notes ?? '',
    reminder_time: habit?.reminder_time?.slice(0, 5) ?? '',
  }
}

export function HabitEditor({
  open,
  habit,
  onClose,
}: {
  open: boolean
  habit: Habit | null
  onClose: () => void
}) {
  const { lifeAreas, createHabit, updateHabit, deleteHabit } = useData()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(habit))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(draftFrom(habit))
      setError(null)
    }
  }, [open, habit])

  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }))

  async function save() {
    if (!draft.name.trim()) {
      setError('Give the habit a name.')
      return
    }
    if (draft.frequency_type === 'weekly_days' && draft.target_days.length === 0) {
      setError('Pick at least one day of the week.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: draft.name.trim(),
        life_area_id: draft.life_area_id || null,
        frequency_type: draft.frequency_type,
        // Only the field the chosen frequency actually uses is sent; the
        // others are nulled so stale values can't fail the CHECK constraints.
        target_days: draft.frequency_type === 'weekly_days' ? draft.target_days : [],
        times_per_week:
          draft.frequency_type === 'x_per_week' ? draft.times_per_week : null,
        goal_type: draft.goal_type,
        goal_target: draft.goal_type === 'numeric' ? draft.goal_target : null,
        unit: draft.goal_type === 'numeric' ? draft.unit.trim() || null : null,
        step: draft.goal_type === 'numeric' ? Math.max(1, draft.step) : 1,
        color: draft.color,
        notes: draft.notes.trim() || null,
        reminder_time: draft.reminder_time || null,
      }

      if (habit) {
        await updateHabit(habit.id, payload)
      } else {
        await createHabit(payload)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the habit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={habit ? 'Edit habit' : 'New habit'}
      onClose={onClose}
      footer={
        <>
          {habit && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                // Deleting takes the history with it, so the confirm points at
                // archiving — the non-destructive option people usually want.
                if (
                  confirm(
                    `Delete "${habit.name}" and its entire history? This cannot be undone.\n\nArchiving keeps the history and hides the habit instead.`,
                  )
                ) {
                  void deleteHabit(habit.id).then(onClose)
                }
              }}
            >
              <Trash2 size={14} />
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <ErrorBanner message={error} />

      <Field label="Name">
        <Input
          value={draft.name}
          autoFocus
          placeholder="Drink water"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>

      <Field label="Life area">
        <Select
          value={draft.life_area_id}
          onChange={(e) => patch({ life_area_id: e.target.value })}
        >
          <option value="">None</option>
          {lifeAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="How often">
        <Segmented<HabitFrequency>
          label="Frequency"
          value={draft.frequency_type}
          onChange={(frequency_type) => patch({ frequency_type })}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekly_days', label: 'Certain days' },
            { value: 'x_per_week', label: 'X per week' },
          ]}
        />
      </Field>

      {draft.frequency_type === 'weekly_days' && (
        <Field label="Which days">
          <WeekdayPicker
            value={draft.target_days}
            onChange={(target_days) => patch({ target_days })}
          />
        </Field>
      )}

      {draft.frequency_type === 'x_per_week' && (
        <Field label="Times per week" hint="Streaks are counted in weeks.">
          <Input
            type="number"
            min={1}
            max={7}
            value={draft.times_per_week}
            onChange={(e) =>
              patch({ times_per_week: Number(e.target.value) || 1 })
            }
          />
        </Field>
      )}

      <Field label="Goal">
        <Segmented<HabitGoalType>
          label="Goal type"
          value={draft.goal_type}
          onChange={(goal_type) => patch({ goal_type })}
          options={[
            { value: 'checkbox', label: 'Just tick it off' },
            { value: 'numeric', label: 'Hit a number' },
          ]}
        />
      </Field>

      {draft.goal_type === 'numeric' && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target">
            <Input
              type="number"
              min={1}
              value={draft.goal_target}
              onChange={(e) => patch({ goal_target: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="Unit">
            <Input
              value={draft.unit}
              placeholder="glasses"
              onChange={(e) => patch({ unit: e.target.value })}
            />
          </Field>
          <Field label="Step" hint="Per tap">
            <Input
              type="number"
              min={1}
              value={draft.step}
              onChange={(e) => patch({ step: Number(e.target.value) || 1 })}
            />
          </Field>
        </div>
      )}

      <Field
        label="Reminder time"
        hint="Overrides the account-wide evening nudge. Blank uses that."
      >
        <Input
          type="time"
          value={draft.reminder_time}
          onChange={(e) => patch({ reminder_time: e.target.value })}
        />
      </Field>

      <Field label="Notes" hint="Why this habit matters, or how to do it.">
        <Textarea
          rows={2}
          value={draft.notes}
          placeholder="Two glasses with each meal."
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>

      <Field label="Colour">
        <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
      </Field>
    </Modal>
  )
}
