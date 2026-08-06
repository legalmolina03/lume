import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import type { CalendarEvent, RecurrenceRule } from '../../lib/types'
import { useData } from '../../context/DataContext'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/Card'
import {
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
  WeekdayPicker,
} from '../ui/Field'

type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly'

interface Draft {
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  life_area_id: string
  linked_task_id: string
  location: string
  repeat: RepeatMode
  days: number[]
  dayOfMonth: number
  until: string
}

/** `datetime-local`-friendly split of a stored timestamp. */
function draftFrom(event: CalendarEvent | null, fallbackDate: Date): Draft {
  const start = event ? new Date(event.start_datetime) : fallbackDate
  const end = event ? new Date(event.end_datetime) : new Date(fallbackDate.getTime() + 3_600_000)
  const rule = event?.recurrence_rule ?? null

  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    date: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endTime: format(end, 'HH:mm'),
    life_area_id: event?.life_area_id ?? '',
    linked_task_id: event?.linked_task_id ?? '',
    location: event?.location ?? '',
    repeat: rule?.freq ?? 'none',
    days: rule?.freq === 'weekly' ? rule.days : [start.getDay()],
    dayOfMonth: rule?.freq === 'monthly' ? rule.day_of_month : start.getDate(),
    until: rule?.until ?? '',
  }
}

function buildRule(draft: Draft): RecurrenceRule | null {
  const until = draft.until || undefined
  switch (draft.repeat) {
    case 'none':
      return null
    case 'daily':
      return { freq: 'daily', until }
    case 'weekly':
      return { freq: 'weekly', days: draft.days, until }
    case 'monthly':
      return { freq: 'monthly', day_of_month: draft.dayOfMonth, until }
  }
}

export function EventEditor({
  open,
  event,
  defaultDate,
  onClose,
}: {
  open: boolean
  event: CalendarEvent | null
  defaultDate: Date
  onClose: () => void
}) {
  const { lifeAreas, tasks, createEvent, updateEvent, deleteEvent } = useData()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(event, defaultDate))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(draftFrom(event, defaultDate))
      setError(null)
    }
  }, [open, event, defaultDate])

  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }))

  async function save() {
    if (!draft.title.trim()) {
      setError('Give the event a title.')
      return
    }

    const start = new Date(`${draft.date}T${draft.startTime}`)
    const end = new Date(`${draft.date}T${draft.endTime}`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Check the date and times.')
      return
    }
    if (end < start) {
      setError('The end time is before the start time.')
      return
    }
    if (draft.repeat === 'weekly' && draft.days.length === 0) {
      setError('Pick at least one day to repeat on.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        life_area_id: draft.life_area_id || null,
        linked_task_id: draft.linked_task_id || null,
        location: draft.location.trim() || null,
        recurrence_rule: buildRule(draft),
      }
      if (event) await updateEvent(event.id, payload)
      else await createEvent(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={event ? 'Edit event' : 'New event'}
      onClose={onClose}
      footer={
        <>
          {event && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (confirm(`Delete "${event.title}"?`)) {
                  void deleteEvent(event.id).then(onClose)
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

      <Field label="Title">
        <Input
          value={draft.title}
          autoFocus
          placeholder="Gym"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Date">
          <Input
            type="date"
            value={draft.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </Field>
        <Field label="Start">
          <Input
            type="time"
            value={draft.startTime}
            onChange={(e) => patch({ startTime: e.target.value })}
          />
        </Field>
        <Field label="End">
          <Input
            type="time"
            value={draft.endTime}
            onChange={(e) => patch({ endTime: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
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

        <Field label="Linked task">
          <Select
            value={draft.linked_task_id}
            onChange={(e) => patch({ linked_task_id: e.target.value })}
          >
            <option value="">None</option>
            {tasks
              .filter((t) => t.status === 'open')
              .map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      <Field label="Location">
        <Input
          value={draft.location}
          placeholder="Optional"
          onChange={(e) => patch({ location: e.target.value })}
        />
      </Field>

      <Field label="Repeats">
        <Segmented<RepeatMode>
          label="Repeat"
          value={draft.repeat}
          onChange={(repeat) => patch({ repeat })}
          options={[
            { value: 'none', label: 'Never' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
      </Field>

      {draft.repeat === 'weekly' && (
        <Field label="On these days">
          <WeekdayPicker value={draft.days} onChange={(days) => patch({ days })} />
        </Field>
      )}

      {draft.repeat === 'monthly' && (
        <Field
          label="Day of the month"
          hint="Months without this date are skipped rather than shifted."
        >
          <Input
            type="number"
            min={1}
            max={31}
            value={draft.dayOfMonth}
            onChange={(e) =>
              patch({
                dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
              })
            }
          />
        </Field>
      )}

      {draft.repeat !== 'none' && (
        <Field label="Until" hint="Leave empty to repeat indefinitely.">
          <Input
            type="date"
            value={draft.until}
            onChange={(e) => patch({ until: e.target.value })}
          />
        </Field>
      )}

      <Field label="Notes">
        <Textarea
          rows={2}
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>
    </Modal>
  )
}
