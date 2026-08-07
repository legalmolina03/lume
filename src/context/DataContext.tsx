import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { toDateKey } from '../lib/dates'
import type {
  CalendarEvent,
  EventPatch,
  FocusSession,
  Habit,
  HabitPatch,
  HabitLog,
  LifeArea,
  LifeAreaPatch,
  Project,
  ProjectPatch,
  Task,
  TaskPatch,
} from '../lib/types'
import { useAuth } from './AuthContext'

/**
 * One store for everything the dashboard cross-references.
 *
 * The home screen shows habits, tasks and events together, and the activity log
 * spans all of them, so per-feature fetching would mean the same rows loaded
 * several times over. At personal scale the whole working set is small enough
 * to hold in memory; the two unbounded tables (habit logs and focus sessions)
 * are windowed rather than loaded whole.
 */

/** A year of history — enough for the contribution heatmap and any streak. */
const HABIT_LOG_WINDOW_DAYS = 400
const FOCUS_WINDOW_DAYS = 180
const EVENT_WINDOW_DAYS = 180

interface DataValue {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>

  lifeAreas: LifeArea[]
  projects: Project[]
  habits: Habit[]
  habitLogs: HabitLog[]
  tasks: Task[]
  events: CalendarEvent[]
  focusSessions: FocusSession[]

  createLifeArea: (input: Partial<LifeArea> & { name: string }) => Promise<void>
  updateLifeArea: (id: string, patch: LifeAreaPatch) => Promise<void>
  deleteLifeArea: (id: string) => Promise<void>
  reorderLifeAreas: (orderedIds: string[]) => Promise<void>

  createProject: (input: { name: string; color?: string }) => Promise<void>
  updateProject: (id: string, patch: ProjectPatch) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  createHabit: (input: Partial<Habit> & { name: string }) => Promise<void>
  updateHabit: (id: string, patch: HabitPatch) => Promise<void>
  deleteHabit: (id: string) => Promise<void>

  setHabitLog: (
    habitId: string,
    date: string,
    patch: { completed?: boolean; value?: number | null },
  ) => Promise<void>

  createTask: (input: Partial<Task> & { title: string }) => Promise<Task>
  updateTask: (id: string, patch: TaskPatch) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  setTaskDone: (id: string, done: boolean) => Promise<void>
  setTaskPinned: (id: string, pinned: boolean) => Promise<void>
  reorderPinnedTasks: (orderedIds: string[]) => Promise<void>

  createEvent: (
    input: Partial<CalendarEvent> & {
      title: string
      start_datetime: string
      end_datetime: string
    },
  ) => Promise<void>
  updateEvent: (id: string, patch: EventPatch) => Promise<void>
  deleteEvent: (id: string) => Promise<void>

  saveFocusSession: (
    input: Partial<FocusSession> & { planned_duration_minutes: number },
  ) => Promise<void>
  deleteFocusSession: (id: string) => Promise<void>

  lifeAreaById: (id: string | null) => LifeArea | null
  projectById: (id: string | null) => Project | null
  taskById: (id: string | null) => Task | null
}

const DataContext = createContext<DataValue | null>(null)

/** The most a user may pin at once (Section 4). Mirrored by a DB trigger. */
export const MAX_PINNED_TASKS = 5

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // Keyed on the id, not the user object. Supabase hands back a fresh session
  // (and so a fresh `user`) on every token refresh and visibility change, and
  // depending on the object identity re-ran this whole nine-query load every
  // few seconds while the app sat idle.
  const userId = user?.id ?? null

  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setLifeAreas([])
      setProjects([])
      setHabits([])
      setHabitLogs([])
      setTasks([])
      setEvents([])
      setFocusSessions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const now = new Date()
    const logsSince = toDateKey(subDays(now, HABIT_LOG_WINDOW_DAYS))
    const focusSince = subDays(now, FOCUS_WINDOW_DAYS).toISOString()
    const eventsSince = subDays(now, EVENT_WINDOW_DAYS).toISOString()

    const [areasRes, projectsRes, habitsRes, logsRes, tasksRes, eventsRes, focusRes] =
      await Promise.all([
        supabase.from('life_areas').select('*').order('sort_order'),
        supabase.from('projects').select('*').order('name'),
        supabase.from('habits').select('*').order('sort_order'),
        supabase.from('habit_logs').select('*').gte('date', logsSince),
        supabase.from('tasks').select('*').order('due_date', {
          ascending: true,
          nullsFirst: false,
        }),
        // Recurring events are kept regardless of age: their base row may be
        // months old while occurrences still land inside the visible window.
        supabase
          .from('events')
          .select('*')
          .or(`start_datetime.gte.${eventsSince},recurring.eq.true`)
          .order('start_datetime'),
        supabase
          .from('focus_sessions')
          .select('*')
          .gte('started_at', focusSince)
          .order('started_at', { ascending: false }),
      ])

    const firstError = [
      areasRes.error,
      projectsRes.error,
      habitsRes.error,
      logsRes.error,
      tasksRes.error,
      eventsRes.error,
      focusRes.error,
    ].find(Boolean)

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setLifeAreas(areasRes.data ?? [])
    setProjects(projectsRes.data ?? [])
    setHabits(habitsRes.data ?? [])
    setHabitLogs(logsRes.data ?? [])
    setTasks(tasksRes.data ?? [])
    setEvents(eventsRes.data ?? [])
    setFocusSessions(focusRes.data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<DataValue>(() => {
    const uid = userId ?? ''

    const upsertLocal = <T extends { id: string }>(
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      row: T,
    ) => {
      setter((prev) => {
        const idx = prev.findIndex((r) => r.id === row.id)
        if (idx === -1) return [...prev, row]
        const next = [...prev]
        next[idx] = row
        return next
      })
    }

    return {
      loading,
      error,
      refresh,
      lifeAreas,
      projects,
      habits,
      habitLogs,
      tasks,
      events,
      focusSessions,

      /* ---------------------------------------------------- life areas -- */

      async createLifeArea(input) {
        const maxOrder = lifeAreas.reduce(
          (max, a) => Math.max(max, a.sort_order),
          -1,
        )
        const { data, error: err } = await supabase
          .from('life_areas')
          .insert({
            user_id: uid,
            name: input.name,
            color: input.color ?? '#6366f1',
            icon: input.icon ?? null,
            sort_order: maxOrder + 1,
          })
          .select()
          .single()
        if (err) throw err
        setLifeAreas((prev) =>
          [...prev, data].sort((a, b) => a.sort_order - b.sort_order),
        )
      },

      async updateLifeArea(id, patch) {
        const { data, error: err } = await supabase
          .from('life_areas')
          .update(patch)
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        upsertLocal(setLifeAreas, data)
      },

      async deleteLifeArea(id) {
        const { error: err } = await supabase
          .from('life_areas')
          .delete()
          .eq('id', id)
        if (err) throw err
        setLifeAreas((prev) => prev.filter((a) => a.id !== id))
        // The FKs are ON DELETE SET NULL, so items keep existing untagged.
        setHabits((prev) =>
          prev.map((h) => (h.life_area_id === id ? { ...h, life_area_id: null } : h)),
        )
        setTasks((prev) =>
          prev.map((t) => (t.life_area_id === id ? { ...t, life_area_id: null } : t)),
        )
        setEvents((prev) =>
          prev.map((e) => (e.life_area_id === id ? { ...e, life_area_id: null } : e)),
        )
      },

      async reorderLifeAreas(orderedIds) {
        setLifeAreas((prev) =>
          [...prev].sort(
            (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id),
          ),
        )
        await Promise.all(
          orderedIds.map((id, index) =>
            supabase.from('life_areas').update({ sort_order: index }).eq('id', id),
          ),
        )
      },

      /* ------------------------------------------------------ projects -- */

      async createProject(input) {
        const { data, error: err } = await supabase
          .from('projects')
          .insert({
            user_id: uid,
            name: input.name,
            color: input.color ?? '#64748b',
          })
          .select()
          .single()
        if (err) throw err
        setProjects((prev) => [...prev, data])
      },

      async updateProject(id, patch) {
        const { data, error: err } = await supabase
          .from('projects')
          .update(patch)
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        upsertLocal(setProjects, data)
      },

      async deleteProject(id) {
        const { error: err } = await supabase.from('projects').delete().eq('id', id)
        if (err) throw err
        setProjects((prev) => prev.filter((p) => p.id !== id))
        setTasks((prev) =>
          prev.map((t) => (t.project_id === id ? { ...t, project_id: null } : t)),
        )
      },

      /* -------------------------------------------------------- habits -- */

      async createHabit(input) {
        const maxOrder = habits.reduce((max, h) => Math.max(max, h.sort_order), -1)
        const { data, error: err } = await supabase
          .from('habits')
          .insert({
            user_id: uid,
            name: input.name,
            frequency_type: input.frequency_type ?? 'daily',
            target_days: input.target_days ?? [],
            times_per_week: input.times_per_week ?? null,
            goal_type: input.goal_type ?? 'checkbox',
            goal_target: input.goal_target ?? null,
            unit: input.unit ?? null,
            color: input.color ?? '#6366f1',
            icon: input.icon ?? null,
            life_area_id: input.life_area_id ?? null,
            sort_order: maxOrder + 1,
          })
          .select()
          .single()
        if (err) throw err
        setHabits((prev) => [...prev, data])
      },

      async updateHabit(id, patch) {
        const { data, error: err } = await supabase
          .from('habits')
          .update(patch)
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        upsertLocal(setHabits, data)
      },

      async deleteHabit(id) {
        const { error: err } = await supabase.from('habits').delete().eq('id', id)
        if (err) throw err
        setHabits((prev) => prev.filter((h) => h.id !== id))
        setHabitLogs((prev) => prev.filter((l) => l.habit_id !== id))
      },

      async setHabitLog(habitId, date, patch) {
        const existing = habitLogs.find(
          (l) => l.habit_id === habitId && l.date === date,
        )
        const { data, error: err } = await supabase
          .from('habit_logs')
          .upsert(
            {
              user_id: uid,
              habit_id: habitId,
              date,
              completed: patch.completed ?? existing?.completed ?? false,
              value:
                patch.value !== undefined ? patch.value : (existing?.value ?? null),
            },
            { onConflict: 'habit_id,date' },
          )
          .select()
          .single()
        if (err) throw err
        upsertLocal(setHabitLogs, data)
      },

      /* --------------------------------------------------------- tasks -- */

      async createTask(input) {
        const { data, error: err } = await supabase
          .from('tasks')
          .insert({
            user_id: uid,
            title: input.title,
            description: input.description ?? null,
            due_date: input.due_date ?? null,
            priority: input.priority ?? 'medium',
            project_id: input.project_id ?? null,
            life_area_id: input.life_area_id ?? null,
          })
          .select()
          .single()
        if (err) throw err
        setTasks((prev) => [...prev, data])
        return data
      },

      async updateTask(id, patch) {
        const { data, error: err } = await supabase
          .from('tasks')
          .update(patch)
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        upsertLocal(setTasks, data)
      },

      async deleteTask(id) {
        const { error: err } = await supabase.from('tasks').delete().eq('id', id)
        if (err) throw err
        setTasks((prev) => prev.filter((t) => t.id !== id))
      },

      async setTaskDone(id, done) {
        // completed_at and status move together — a CHECK constraint requires it.
        const { data, error: err } = await supabase
          .from('tasks')
          .update({
            status: done ? 'done' : 'open',
            completed_at: done ? new Date().toISOString() : null,
            // Finishing a task releases its pin so the slot frees up.
            ...(done ? { pinned: false, pinned_order: null } : {}),
          })
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        upsertLocal(setTasks, data)
      },

      async setTaskPinned(id, pinned) {
        if (pinned) {
          const pinnedCount = tasks.filter((t) => t.pinned).length
          if (pinnedCount >= MAX_PINNED_TASKS) {
            throw new Error(
              `You can pin at most ${MAX_PINNED_TASKS} tasks. Unpin one first.`,
            )
          }
        }
        const nextOrder = pinned
          ? tasks.reduce((max, t) => Math.max(max, t.pinned_order ?? -1), -1) + 1
          : null
        const { data, error: err } = await supabase
          .from('tasks')
          .update({ pinned, pinned_order: nextOrder })
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        upsertLocal(setTasks, data)
      },

      async reorderPinnedTasks(orderedIds) {
        setTasks((prev) =>
          prev.map((t) => {
            const index = orderedIds.indexOf(t.id)
            return index === -1 ? t : { ...t, pinned_order: index }
          }),
        )
        await Promise.all(
          orderedIds.map((id, index) =>
            supabase.from('tasks').update({ pinned_order: index }).eq('id', id),
          ),
        )
      },

      /* -------------------------------------------------------- events -- */

      async createEvent(input) {
        const { data, error: err } = await supabase
          .from('events')
          .insert({
            user_id: uid,
            title: input.title,
            description: input.description ?? null,
            start_datetime: input.start_datetime,
            end_datetime: input.end_datetime,
            life_area_id: input.life_area_id ?? null,
            linked_task_id: input.linked_task_id ?? null,
            recurring: Boolean(input.recurrence_rule),
            recurrence_rule: input.recurrence_rule ?? null,
            location: input.location ?? null,
          })
          .select()
          .single()
        if (err) throw err
        setEvents((prev) => [...prev, data])
      },

      async updateEvent(id, patch) {
        const next = { ...patch }
        if ('recurrence_rule' in patch) {
          next.recurring = Boolean(patch.recurrence_rule)
        }
        const { data, error: err } = await supabase
          .from('events')
          .update(next)
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        upsertLocal(setEvents, data)
      },

      async deleteEvent(id) {
        const { error: err } = await supabase.from('events').delete().eq('id', id)
        if (err) throw err
        setEvents((prev) => prev.filter((e) => e.id !== id))
      },

      /* --------------------------------------------------------- focus -- */

      async saveFocusSession(input) {
        const { data, error: err } = await supabase
          .from('focus_sessions')
          .insert({
            user_id: uid,
            started_at: input.started_at ?? new Date().toISOString(),
            duration_minutes: input.duration_minutes ?? 0,
            planned_duration_minutes: input.planned_duration_minutes,
            type: input.type ?? 'pomodoro',
            completed: input.completed ?? false,
            notes: input.notes ?? null,
            linked_task_id: input.linked_task_id ?? null,
            life_area_id: input.life_area_id ?? null,
          })
          .select()
          .single()
        if (err) throw err
        setFocusSessions((prev) => [data, ...prev])
      },

      async deleteFocusSession(id) {
        const { error: err } = await supabase
          .from('focus_sessions')
          .delete()
          .eq('id', id)
        if (err) throw err
        setFocusSessions((prev) => prev.filter((s) => s.id !== id))
      },

      /* ------------------------------------------------------- lookups -- */

      lifeAreaById: (id) => lifeAreas.find((a) => a.id === id) ?? null,
      projectById: (id) => projects.find((p) => p.id === id) ?? null,
      taskById: (id) => tasks.find((t) => t.id === id) ?? null,
    }
  }, [
    userId,
    loading,
    error,
    refresh,
    lifeAreas,
    projects,
    habits,
    habitLogs,
    tasks,
    events,
    focusSessions,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
