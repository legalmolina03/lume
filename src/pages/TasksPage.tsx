import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useData, MAX_PINNED_TASKS } from '../context/DataContext'
import type { Task, TaskPriority } from '../lib/types'
import { Button, IconButton } from '../components/ui/Button'
import { Card, EmptyState, SectionHeader } from '../components/ui/Card'
import { Field, Segmented, Select } from '../components/ui/Field'
import { TaskCard } from '../components/tasks/TaskCard'
import { TaskEditor } from '../components/tasks/TaskEditor'

type SortKey = 'due' | 'priority'

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

/** Undated tasks sort last, whichever key is chosen. */
function byDueDate(a: Task, b: Task): number {
  if (a.due_date === b.due_date) return a.title.localeCompare(b.title)
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date < b.due_date ? -1 : 1
}

function byPriority(a: Task, b: Task): number {
  const delta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return delta !== 0 ? delta : byDueDate(a, b)
}

export function TasksPage() {
  const { tasks, projects, lifeAreas, reorderPinnedTasks } = useData()
  const [editing, setEditing] = useState<Task | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [sort, setSort] = useState<SortKey>('due')
  const [areaFilter, setAreaFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [showDone, setShowDone] = useState(false)

  const pinned = useMemo(
    () =>
      tasks
        .filter((t) => t.pinned && t.status === 'open')
        .sort((a, b) => (a.pinned_order ?? 0) - (b.pinned_order ?? 0) || byDueDate(a, b)),
    [tasks],
  )

  const open = useMemo(() => {
    const filtered = tasks.filter(
      (t) =>
        t.status === 'open' &&
        !t.pinned &&
        (!areaFilter || t.life_area_id === areaFilter) &&
        (!projectFilter || t.project_id === projectFilter),
    )
    return filtered.sort(sort === 'due' ? byDueDate : byPriority)
  }, [tasks, sort, areaFilter, projectFilter])

  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'done')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks],
  )

  function openEditor(task: Task | null) {
    setEditing(task)
    setEditorOpen(true)
  }

  function move(index: number, delta: number) {
    const next = [...pinned]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    void reorderPinnedTasks(next.map((t) => t.id))
  }

  return (
    <div className="flex flex-col gap-4">
      {pinned.length > 0 && (
        <Card>
          <SectionHeader
            title="Pinned"
            hint={`${pinned.length} of ${MAX_PINNED_TASKS} — shown first, in this order`}
          />
          <ul className="flex flex-col gap-2">
            {pinned.map((task, index) => (
              <li key={task.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <TaskCard task={task} onEdit={openEditor} />
                </div>
                <div className="flex shrink-0 flex-col">
                  <IconButton
                    aria-label={`Move "${task.title}" up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="h-5"
                  >
                    <ChevronUp size={14} />
                  </IconButton>
                  <IconButton
                    aria-label={`Move "${task.title}" down`}
                    disabled={index === pinned.length - 1}
                    onClick={() => move(index, 1)}
                    className="h-5"
                  >
                    <ChevronDown size={14} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionHeader
          title="Tasks"
          hint={`${open.length} open`}
          action={
            <Button variant="primary" size="sm" onClick={() => openEditor(null)}>
              <Plus size={14} />
              New task
            </Button>
          }
        />

        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="Sort by">
            <Segmented<SortKey>
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'due', label: 'Due date' },
                { value: 'priority', label: 'Priority' },
              ]}
            />
          </Field>

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

          <Field label="Project">
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {open.length === 0 ? (
          <EmptyState
            title="Nothing open here."
            hint={
              areaFilter || projectFilter
                ? 'Try clearing the filters.'
                : 'Add a task to get started.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} onEdit={openEditor} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card>
          <SectionHeader
            title="Done"
            hint={`${done.length}`}
            action={
              <Button size="sm" onClick={() => setShowDone((v) => !v)}>
                {showDone ? 'Hide' : 'Show'}
              </Button>
            }
          />
          {showDone && (
            <ul className="flex flex-col gap-2">
              {done.slice(0, 50).map((task) => (
                <li key={task.id}>
                  <TaskCard task={task} onEdit={openEditor} showPin={false} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <TaskEditor
        open={editorOpen}
        task={editing}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  )
}
