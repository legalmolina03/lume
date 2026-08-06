import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Task, TaskPriority } from '../../lib/types'
import { useData } from '../../context/DataContext'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/Card'
import { Field, Input, Segmented, Select, Textarea } from '../ui/Field'

interface Draft {
  title: string
  description: string
  due_date: string
  priority: TaskPriority
  project_id: string
  life_area_id: string
}

function draftFrom(task: Task | null): Draft {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    due_date: task?.due_date ?? '',
    priority: task?.priority ?? 'medium',
    project_id: task?.project_id ?? '',
    life_area_id: task?.life_area_id ?? '',
  }
}

export function TaskEditor({
  open,
  task,
  onClose,
}: {
  open: boolean
  task: Task | null
  onClose: () => void
}) {
  const { lifeAreas, projects, createTask, updateTask, deleteTask } = useData()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(task))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(draftFrom(task))
      setError(null)
    }
  }, [open, task])

  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }))

  async function save() {
    if (!draft.title.trim()) {
      setError('Give the task a title.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        due_date: draft.due_date || null,
        priority: draft.priority,
        project_id: draft.project_id || null,
        life_area_id: draft.life_area_id || null,
      }
      if (task) await updateTask(task.id, payload)
      else await createTask(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the task.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          {task && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (confirm(`Delete "${task.title}"?`)) {
                  void deleteTask(task.id).then(onClose)
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
          placeholder="Finish physics problem set"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>

      <Field label="Notes">
        <Textarea
          rows={3}
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">
          <Input
            type="date"
            value={draft.due_date}
            onChange={(e) => patch({ due_date: e.target.value })}
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
      </div>

      <Field label="Priority">
        <Segmented<TaskPriority>
          label="Priority"
          value={draft.priority}
          onChange={(priority) => patch({ priority })}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </Field>

      <Field label="Project">
        <Select
          value={draft.project_id}
          onChange={(e) => patch({ project_id: e.target.value })}
        >
          <option value="">None</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  )
}
