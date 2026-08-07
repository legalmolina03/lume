/**
 * Row shapes for every table in supabase/migrations/0001_init.sql, plus the
 * `Database` type the Supabase client is generic over so queries are checked
 * at compile time.
 */

export type HabitFrequency = 'daily' | 'weekly_days' | 'x_per_week'
export type HabitGoalType = 'checkbox' | 'numeric'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'open' | 'done'
export type FocusType = 'pomodoro' | 'custom'
export type AccentName = 'red' | 'purple' | 'blue' | 'white'
export type ThemeName = 'dark' | 'light'

export type LifeArea = {
  id: string
  user_id: string
  name: string
  color: string
  icon: string | null
  sort_order: number
  created_at: string
}

export type Project = {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export type Habit = {
  id: string
  user_id: string
  name: string
  frequency_type: HabitFrequency
  /** 0 = Sunday .. 6 = Saturday. Only meaningful for `weekly_days`. */
  target_days: number[]
  /** Only meaningful for `x_per_week`. */
  times_per_week: number | null
  goal_type: HabitGoalType
  goal_target: number | null
  unit: string | null
  color: string
  icon: string | null
  life_area_id: string | null
  sort_order: number
  archived: boolean
  created_at: string
}

export type HabitLog = {
  id: string
  user_id: string
  habit_id: string
  /** `yyyy-MM-dd` in the user's local time. */
  date: string
  completed: boolean
  value: number | null
  created_at: string
}

export type Task = {
  id: string
  user_id: string
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  project_id: string | null
  life_area_id: string | null
  status: TaskStatus
  pinned: boolean
  pinned_order: number | null
  created_at: string
  completed_at: string | null
}

export type FocusSession = {
  id: string
  user_id: string
  started_at: string
  duration_minutes: number
  planned_duration_minutes: number
  type: FocusType
  completed: boolean
  notes: string | null
  linked_task_id: string | null
  life_area_id: string | null
  created_at: string
}

/**
 * The simple recurrence model settled in Section 9/10 — deliberately not RRULE.
 */
export type RecurrenceRule =
  | { freq: 'daily'; until?: string }
  | { freq: 'weekly'; days: number[]; until?: string }
  | { freq: 'monthly'; day_of_month: number; until?: string }

export type CalendarEvent = {
  id: string
  user_id: string
  title: string
  description: string | null
  start_datetime: string
  end_datetime: string
  life_area_id: string | null
  linked_task_id: string | null
  recurring: boolean
  recurrence_rule: RecurrenceRule | null
  location: string | null
  created_at: string
}

/** One materialised occurrence of an event, produced by expanding recurrence. */
export type EventOccurrence = {
  event: CalendarEvent
  start: Date
  end: Date
  /** Stable per-occurrence key: event id + occurrence date. */
  key: string
}

export type UserSettings = {
  user_id: string
  habit_reminder_time: string | null
  task_reminder_enabled: boolean
  default_pomodoro_minutes: number
  default_break_minutes: number
  accent: AccentName
  theme: ThemeName
  timezone: string
  /** Playlist a focus session starts. Null means "control whatever is playing". */
  spotify_playlist_uri: string | null
  spotify_playlist_name: string | null
  spotify_autoplay: boolean
  spotify_autopause: boolean
  created_at: string
  updated_at: string
}

export type SpotifyTokens = {
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string
  scope: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
}

export type ActivityKind = 'habit' | 'task' | 'focus' | 'event'

export type ActivityEntry = {
  kind: ActivityKind
  id: string
  user_id: string
  occurred_at: string
  title: string
  detail: string | null
  life_area_id: string | null
  source_id: string
}

/* -------------------------------------------------------------------------- */

type Writable<Row, Required extends keyof Row, Generated extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required | Generated>>
  Update: Partial<Omit<Row, Generated>>
  Relationships: []
}

// A type alias rather than an interface: postgrest-js matches the schema
// against `Record<string, GenericTable>`, and only type literals get the
// implicit index signature that comparison needs. As an interface, every
// query resolves to `never`.
export type Database = {
  public: {
    Tables: {
      life_areas: Writable<LifeArea, 'user_id' | 'name', 'id' | 'created_at'>
      projects: Writable<Project, 'user_id' | 'name', 'id' | 'created_at'>
      habits: Writable<Habit, 'user_id' | 'name', 'id' | 'created_at'>
      habit_logs: Writable<
        HabitLog,
        'user_id' | 'habit_id' | 'date',
        'id' | 'created_at'
      >
      tasks: Writable<Task, 'user_id' | 'title', 'id' | 'created_at'>
      focus_sessions: Writable<
        FocusSession,
        'user_id' | 'planned_duration_minutes',
        'id' | 'created_at'
      >
      events: Writable<
        CalendarEvent,
        'user_id' | 'title' | 'start_datetime' | 'end_datetime',
        'id' | 'created_at'
      >
      user_settings: Writable<UserSettings, 'user_id', 'created_at'>
      spotify_tokens: Writable<
        SpotifyTokens,
        'user_id' | 'access_token' | 'refresh_token' | 'expires_at',
        'created_at'
      >
      push_subscriptions: Writable<
        PushSubscriptionRow,
        'user_id' | 'endpoint' | 'p256dh' | 'auth',
        'id' | 'created_at'
      >
    }
    Views: {
      activity_log: {
        Row: ActivityEntry
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: {
      habit_frequency: HabitFrequency
      habit_goal_type: HabitGoalType
      task_priority: TaskPriority
      task_status: TaskStatus
      focus_type: FocusType
    }
    CompositeTypes: Record<string, never>
  }
}

/**
 * Patch shapes for updates. These deliberately exclude the generated columns —
 * postgrest-js rejects `id` and `created_at` in an update payload, so a plain
 * `Partial<Row>` would not compile.
 */
type Tables = Database['public']['Tables']

export type LifeAreaPatch = Tables['life_areas']['Update']
export type ProjectPatch = Tables['projects']['Update']
export type HabitPatch = Tables['habits']['Update']
export type TaskPatch = Tables['tasks']['Update']
export type EventPatch = Tables['events']['Update']
export type SettingsPatch = Tables['user_settings']['Update']
