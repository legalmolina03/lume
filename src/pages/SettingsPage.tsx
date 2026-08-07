import { useEffect, useState } from 'react'
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronUp,
  LogOut,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ACCENTS, useSettings } from '../context/SettingsContext'
import {
  getPushState,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/push'
import type { PushState } from '../lib/push'
import type { AccentName, LifeArea, Project, ThemeName } from '../lib/types'
import { SpotifyCard } from '../components/settings/SpotifyCard'
import { Button, IconButton } from '../components/ui/Button'
import { Card, ErrorBanner, SectionHeader } from '../components/ui/Card'
import { ColorPicker, Field, Input, Segmented } from '../components/ui/Field'

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <AppearanceCard />
      <LifeAreasCard />
      <ProjectsCard />
      <FocusDefaultsCard />
      <SpotifyCard />
      <RemindersCard />
      <AccountCard />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function AppearanceCard() {
  const { theme, accent, setTheme, setAccent } = useSettings()

  return (
    <Card>
      <SectionHeader
        title="Appearance"
        hint="Applies everywhere, instantly"
      />

      <div className="flex flex-col gap-4">
        <Field label="Theme">
          <Segmented<ThemeName>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </Field>

        <Field
          label="Accent colour"
          hint="Buttons, active states and streak highlights all follow this."
        >
          <div className="flex gap-2">
            {ACCENTS.map(({ name, label, swatch }) => (
              <button
                key={name}
                type="button"
                aria-label={label}
                aria-pressed={accent === name}
                onClick={() => setAccent(name as AccentName)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-transform ${
                  accent === name
                    ? 'border-text scale-105'
                    : 'border-border hover:scale-105'
                }`}
                style={{ backgroundColor: swatch }}
              >
                {accent === name && (
                  <Check
                    size={15}
                    strokeWidth={3}
                    className={name === 'white' ? 'text-black' : 'text-white'}
                  />
                )}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function LifeAreasCard() {
  const {
    lifeAreas,
    createLifeArea,
    updateLifeArea,
    deleteLifeArea,
    reorderLifeAreas,
  } = useData()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  // Renames are held locally and committed on blur or Enter — writing per
  // keystroke would be one round trip per character.
  const [nameDraft, setNameDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function beginEdit(area: LifeArea) {
    setEditingId(area.id)
    setNameDraft(area.name)
  }

  function commitName(area: LifeArea) {
    const trimmed = nameDraft.trim()
    setEditingId(null)
    if (!trimmed || trimmed === area.name) return
    void updateLifeArea(area.id, { name: trimmed }).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not rename the area.'),
    )
  }

  function move(index: number, delta: number) {
    const next = [...lifeAreas]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    void reorderLifeAreas(next.map((a) => a.id))
  }

  async function add() {
    if (!newName.trim()) return
    try {
      await createLifeArea({ name: newName.trim() })
      setNewName('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the area.')
    }
  }

  return (
    <Card>
      <SectionHeader
        title="Life areas"
        hint="Tag habits, tasks, focus sessions and events"
      />

      <ErrorBanner message={error} />

      <ul className="mb-3 flex flex-col gap-2">
        {lifeAreas.map((area, index) => (
          <li key={area.id} className="rounded-xl border border-border">
            <div className="flex items-center gap-2 px-3 py-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: area.color }}
              />

              {editingId === area.id ? (
                <Input
                  value={nameDraft}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => commitName(area)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName(area)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => beginEdit(area)}
                  className="min-w-0 flex-1 truncate text-left text-sm"
                >
                  {area.name}
                </button>
              )}

              <IconButton
                aria-label={`Move ${area.name} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ChevronUp size={15} />
              </IconButton>
              <IconButton
                aria-label={`Move ${area.name} down`}
                disabled={index === lifeAreas.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown size={15} />
              </IconButton>
              <IconButton
                aria-label={
                  editingId === area.id
                    ? `Done editing ${area.name}`
                    : `Edit ${area.name}`
                }
                onClick={() =>
                  editingId === area.id ? commitName(area) : beginEdit(area)
                }
              >
                {editingId === area.id ? <X size={15} /> : <Check size={15} />}
              </IconButton>
              <IconButton
                aria-label={`Delete ${area.name}`}
                onClick={() => {
                  if (
                    confirm(
                      `Delete "${area.name}"? Items tagged with it keep existing, just untagged.`,
                    )
                  ) {
                    void deleteLifeArea(area.id)
                  }
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>

            {editingId === area.id && (
              <div className="border-t border-border px-3 py-2">
                <ColorPicker
                  value={area.color}
                  onChange={(color) => void updateLifeArea(area.id, { color })}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Input
          value={newName}
          placeholder="New life area"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
          }}
        />
        <Button variant="primary" onClick={() => void add()}>
          <Plus size={14} />
          Add
        </Button>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function ProjectsCard() {
  const { projects, createProject, updateProject, deleteProject } = useData()
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  function beginEdit(project: Project) {
    setEditingId(project.id)
    setNameDraft(project.name)
  }

  function commitName(project: Project) {
    const trimmed = nameDraft.trim()
    setEditingId(null)
    if (!trimmed || trimmed === project.name) return
    void updateProject(project.id, { name: trimmed }).catch(() => {})
  }

  return (
    <Card>
      <SectionHeader title="Projects" hint="Optional grouping for tasks" />

      {projects.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id} className="rounded-xl border border-border">
              <div className="flex items-center gap-2 px-3 py-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />

                {editingId === project.id ? (
                  <Input
                    value={nameDraft}
                    autoFocus
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => commitName(project)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitName(project)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => beginEdit(project)}
                    className="min-w-0 flex-1 truncate text-left text-sm"
                  >
                    {project.name}
                  </button>
                )}

                <IconButton
                  aria-label={
                    editingId === project.id
                      ? `Done editing ${project.name}`
                      : `Edit ${project.name}`
                  }
                  onClick={() =>
                    editingId === project.id
                      ? commitName(project)
                      : beginEdit(project)
                  }
                >
                  {editingId === project.id ? <X size={15} /> : <Check size={15} />}
                </IconButton>
                <IconButton
                  aria-label={`Delete ${project.name}`}
                  onClick={() => {
                    if (confirm(`Delete "${project.name}"? Its tasks stay.`)) {
                      void deleteProject(project.id)
                    }
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>

              {editingId === project.id && (
                <div className="border-t border-border px-3 py-2">
                  <ColorPicker
                    value={project.color}
                    onChange={(color) => void updateProject(project.id, { color })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={name}
          placeholder="New project"
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          variant="primary"
          onClick={() => {
            if (!name.trim()) return
            void createProject({ name: name.trim() }).then(() => setName(''))
          }}
        >
          <Plus size={14} />
          Add
        </Button>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function FocusDefaultsCard() {
  const { settings, updateSettings } = useSettings()

  return (
    <Card>
      <SectionHeader
        title="Focus defaults"
        hint="Starting values — adjustable per session"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Focus (minutes)">
          <Input
            type="number"
            min={1}
            max={240}
            value={settings?.default_pomodoro_minutes ?? 25}
            onChange={(e) =>
              void updateSettings({
                default_pomodoro_minutes: Math.min(
                  240,
                  Math.max(1, Number(e.target.value) || 1),
                ),
              }).catch(() => {})
            }
          />
        </Field>
        <Field label="Break (minutes)">
          <Input
            type="number"
            min={1}
            max={120}
            value={settings?.default_break_minutes ?? 5}
            onChange={(e) =>
              void updateSettings({
                default_break_minutes: Math.min(
                  120,
                  Math.max(1, Number(e.target.value) || 1),
                ),
              }).catch(() => {})
            }
          />
        </Field>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function RemindersCard() {
  const { user } = useAuth()
  const { settings, updateSettings } = useSettings()
  const [pushState, setPushState] = useState<PushState>('default')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getPushState().then(setPushState)
  }, [])

  async function toggle() {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      setPushState(
        pushState === 'granted-subscribed'
          ? await unsubscribeFromPush()
          : await subscribeToPush(user.id),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change reminders.')
    } finally {
      setBusy(false)
    }
  }

  const subscribed = pushState === 'granted-subscribed'

  return (
    <Card>
      <SectionHeader title="Reminders" hint="Browser push notifications" />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-4">
        {!isPushSupported() ? (
          <p className="text-xs text-muted">
            This browser doesn't support push notifications. Installing Lume to
            your home screen usually enables them.
          </p>
        ) : pushState === 'denied' ? (
          <p className="text-xs text-muted">
            Notifications are blocked for this site. Re-allow them in your
            browser's site settings, then come back.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {subscribed ? 'Reminders are on' : 'Reminders are off'}
              </p>
              <p className="text-[11px] text-muted">
                Evening nudge for unlogged habits, plus due and overdue tasks.
              </p>
            </div>
            <Button
              variant={subscribed ? 'secondary' : 'primary'}
              onClick={() => void toggle()}
              disabled={busy}
            >
              {subscribed ? <BellOff size={14} /> : <Bell size={14} />}
              {busy ? 'Working…' : subscribed ? 'Turn off' : 'Turn on'}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
          <Field label="Habit reminder time">
            <Input
              type="time"
              value={settings?.habit_reminder_time?.slice(0, 5) ?? '20:00'}
              onChange={(e) =>
                void updateSettings({
                  habit_reminder_time: e.target.value || null,
                }).catch(() => {})
              }
            />
          </Field>

          <Field label="Task reminders">
            <Segmented<'on' | 'off'>
              label="Task reminders"
              value={settings?.task_reminder_enabled === false ? 'off' : 'on'}
              onChange={(next) =>
                void updateSettings({
                  task_reminder_enabled: next === 'on',
                }).catch(() => {})
              }
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </Field>
        </div>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function AccountCard() {
  const { user, signOut } = useAuth()

  return (
    <Card>
      <SectionHeader title="Account" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{user?.email}</p>
        <Button onClick={() => void signOut()}>
          <LogOut size={14} />
          Sign out
        </Button>
      </div>
    </Card>
  )
}
