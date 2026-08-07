import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pause, Play, Square, SkipForward, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useData } from '../context/DataContext'
import { useSettings } from '../context/SettingsContext'
import { useFocusTimer } from '../hooks/useFocusTimer'
import { useSpotify } from '../hooks/useSpotify'
import { SpotifyBar } from '../components/focus/SpotifyBar'
import { formatClock, formatDuration } from '../lib/dates'
import { Button, IconButton } from '../components/ui/Button'
import { Card, EmptyState, SectionHeader } from '../components/ui/Card'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { LifeAreaChip } from '../components/Signals'

/**
 * Durations are fully adjustable (Section 4) — 25/5 is only where the sliders
 * start, and whatever the user picks is saved back to their settings so the
 * next session opens on the same numbers.
 */
export function FocusPage() {
  const {
    tasks,
    lifeAreas,
    focusSessions,
    saveFocusSession,
    deleteFocusSession,
    lifeAreaById,
    taskById,
  } = useData()
  const { settings, updateSettings } = useSettings()
  const [searchParams] = useSearchParams()
  const spotify = useSpotify({ poll: true })

  const [workMinutes, setWorkMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [notes, setNotes] = useState('')
  const [taskId, setTaskId] = useState('')
  const [areaId, setAreaId] = useState('')

  // Adopt the stored defaults once they arrive, unless the dashboard passed an
  // explicit duration along with the "start focus session" tap.
  const requestedMinutes = Number(searchParams.get('minutes')) || null

  useEffect(() => {
    if (!settings) return
    setWorkMinutes(requestedMinutes ?? settings.default_pomodoro_minutes)
    setBreakMinutes(settings.default_break_minutes)
  }, [settings, requestedMinutes])

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === 'open'),
    [tasks],
  )

  const persist = useCallback(
    async (elapsedMinutes: number, completed: boolean, startedAt: Date | null) => {
      await saveFocusSession({
        started_at: (startedAt ?? new Date()).toISOString(),
        duration_minutes: Number(elapsedMinutes.toFixed(2)),
        planned_duration_minutes: workMinutes,
        type: workMinutes === 25 && breakMinutes === 5 ? 'pomodoro' : 'custom',
        completed,
        notes: notes.trim() || null,
        linked_task_id: taskId || null,
        life_area_id: areaId || null,
      })
      setNotes('')
    },
    [saveFocusSession, workMinutes, breakMinutes, notes, taskId, areaId],
  )

  const notify = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icons/icon-192.png' })
    }
  }, [])

  // The phase flips to 'break' before the completion handler runs, so the work
  // phase's start time is kept aside to stamp the saved session.
  const startedAtRef = useRef<Date | null>(null)

  const timer = useFocusTimer({
    workMinutes,
    breakMinutes,
    onWorkComplete: (elapsed) => {
      void persist(elapsed, true, startedAtRef.current)
      notify('Focus session done', `Time for a ${breakMinutes} minute break.`)
      // The break is when you step away, so the music should stop with you.
      if (settings?.spotify_autopause !== false) void spotify.pause()
    },
    onBreakComplete: () => notify('Break over', 'Ready for another round?'),
  })

  /** Starts the chosen playlist, or resumes whatever was queued. */
  function startMusic() {
    if (settings?.spotify_autoplay === false) return
    if (!spotify.connected) return
    void spotify.play(settings?.spotify_playlist_uri ?? undefined)
  }

  useEffect(() => {
    if (timer.startedAt) startedAtRef.current = timer.startedAt
  }, [timer.startedAt])

  const ring = 2 * Math.PI * 54

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionHeader
          title="Focus"
          hint={
            timer.phase === 'break'
              ? 'On a break'
              : timer.phase === 'work'
                ? 'In session'
                : 'Ready'
          }
        />

        <div className="flex flex-col items-center gap-5 py-2">
          <div className="relative h-40 w-40">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="var(--border)"
                strokeWidth="6"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - timer.progress)}
                className="transition-[stroke-dashoffset] duration-300 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums">
                {formatClock(timer.remaining)}
              </span>
              <span className="text-[11px] text-muted">
                {timer.phase === 'break' ? 'Break' : 'Focus'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {timer.phase === 'idle' && (
              <Button
                variant="primary"
                onClick={() => {
                  timer.startWork()
                  startMusic()
                }}
              >
                <Play size={15} />
                Start {workMinutes} min
              </Button>
            )}

            {timer.phase !== 'idle' && (
              <>
                {timer.running ? (
                  <Button onClick={timer.pause}>
                    <Pause size={15} />
                    Pause
                  </Button>
                ) : (
                  <Button variant="primary" onClick={timer.resume}>
                    <Play size={15} />
                    Resume
                  </Button>
                )}

                {timer.phase === 'work' ? (
                  <Button
                    onClick={() => {
                      const startedAt = timer.startedAt
                      const { elapsedMinutes } = timer.stop()
                      if (elapsedMinutes >= 0.5) {
                        void persist(elapsedMinutes, false, startedAt)
                      }
                      if (settings?.spotify_autopause !== false) void spotify.pause()
                    }}
                  >
                    <Square size={15} />
                    End early
                  </Button>
                ) : (
                  <Button onClick={timer.skipBreak}>
                    <SkipForward size={15} />
                    Skip break
                  </Button>
                )}
              </>
            )}
          </div>

          {timer.phase === 'idle' && (
            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              <Field label="Focus (minutes)">
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={workMinutes}
                  onChange={(e) => {
                    const next = Math.min(240, Math.max(1, Number(e.target.value) || 1))
                    setWorkMinutes(next)
                    void updateSettings({ default_pomodoro_minutes: next }).catch(
                      () => {},
                    )
                  }}
                />
              </Field>
              <Field label="Break (minutes)">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={breakMinutes}
                  onChange={(e) => {
                    const next = Math.min(120, Math.max(1, Number(e.target.value) || 1))
                    setBreakMinutes(next)
                    void updateSettings({ default_break_minutes: next }).catch(() => {})
                  }}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
          <SpotifyBar spotify={spotify} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Working on">
              <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Nothing specific</option>
                {openTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Life area">
              <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">None</option>
                {lifeAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Session notes"
            hint="Park a distraction here instead of chasing it."
          >
            <Textarea
              rows={3}
              value={notes}
              placeholder="Kept thinking about the email — deal with it after."
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Past sessions" hint={`${focusSessions.length}`} />

        {focusSessions.length === 0 ? (
          <EmptyState title="No focus sessions logged yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {focusSessions.slice(0, 30).map((session) => {
              const task = taskById(session.linked_task_id)
              const area = lifeAreaById(session.life_area_id)
              return (
                <li
                  key={session.id}
                  className="rounded-xl border border-border px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-medium">
                          {formatDuration(session.duration_minutes)}
                        </span>
                        <span className="text-muted">
                          {format(
                            new Date(session.started_at),
                            'EEE d MMM, HH:mm',
                          )}
                        </span>
                        {!session.completed && (
                          <span className="text-muted">(ended early)</span>
                        )}
                        {task && <span className="text-muted">· {task.title}</span>}
                        {area && <LifeAreaChip area={area} />}
                      </div>
                      {session.notes && (
                        <p className="mt-1 text-xs whitespace-pre-wrap text-muted">
                          {session.notes}
                        </p>
                      )}
                    </div>

                    <IconButton
                      aria-label={`Delete focus session from ${format(
                        new Date(session.started_at),
                        'd MMM HH:mm',
                      )}`}
                      onClick={() => {
                        if (confirm('Delete this focus session? This cannot be undone.')) {
                          void deleteFocusSession(session.id)
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
