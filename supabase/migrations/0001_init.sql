-- Lume — initial schema
-- Implements the data model in Section 3 of the product spec, with
-- per-user scoping + Row Level Security on every table (Section 7).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type habit_frequency as enum ('daily', 'weekly_days', 'x_per_week');
create type habit_goal_type as enum ('checkbox', 'numeric');
create type task_priority   as enum ('low', 'medium', 'high');
create type task_status     as enum ('open', 'done');
create type focus_type      as enum ('pomodoro', 'custom');

-- ---------------------------------------------------------------------------
-- life_areas
-- Referenced by habits, tasks, focus sessions and events, so it comes first.
-- ---------------------------------------------------------------------------

create table public.life_areas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  color      text not null default '#6366f1' check (color ~* '^#[0-9a-f]{6}$'),
  icon       text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index life_areas_user_sort_idx on public.life_areas (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 80),
  color      text not null default '#64748b' check (color ~* '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now()
);

create index projects_user_idx on public.projects (user_id);

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------

create table public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 80),
  frequency_type habit_frequency not null default 'daily',
  -- 0 = Sunday .. 6 = Saturday, used when frequency_type = 'weekly_days'
  target_days    smallint[] not null default '{}',
  -- used when frequency_type = 'x_per_week'
  times_per_week smallint check (times_per_week between 1 and 7),
  goal_type      habit_goal_type not null default 'checkbox',
  goal_target    numeric check (goal_target > 0),
  unit           text,
  color          text not null default '#6366f1' check (color ~* '^#[0-9a-f]{6}$'),
  icon           text,
  life_area_id   uuid references public.life_areas (id) on delete set null,
  sort_order     integer not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),

  -- A numeric habit needs a target; a checkbox habit must not carry one.
  constraint habits_numeric_goal_ck check (
    (goal_type = 'numeric'  and goal_target is not null) or
    (goal_type = 'checkbox' and goal_target is null)
  ),
  -- An x_per_week habit needs a weekly count.
  constraint habits_times_per_week_ck check (
    frequency_type <> 'x_per_week' or times_per_week is not null
  ),
  -- A weekly_days habit needs at least one day, and only valid weekday numbers.
  constraint habits_target_days_ck check (
    frequency_type <> 'weekly_days' or (
      array_length(target_days, 1) between 1 and 7
      and target_days <@ array[0,1,2,3,4,5,6]::smallint[]
    )
  )
);

create index habits_user_idx on public.habits (user_id, archived, sort_order);

-- ---------------------------------------------------------------------------
-- habit_logs
-- One row per habit per day. Archiving a habit keeps its history; deleting a
-- habit removes it (archive is the non-destructive path exposed in the UI).
-- ---------------------------------------------------------------------------

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,
  date       date not null,
  completed  boolean not null default false,
  value      numeric check (value >= 0),
  created_at timestamptz not null default now(),

  unique (habit_id, date)
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, date desc);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 1 and 200),
  description  text,
  due_date     date,
  priority     task_priority not null default 'medium',
  project_id   uuid references public.projects (id) on delete set null,
  life_area_id uuid references public.life_areas (id) on delete set null,
  status       task_status not null default 'open',
  pinned       boolean not null default false,
  pinned_order smallint,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,

  -- pinned_order is meaningful only while pinned, and vice versa.
  constraint tasks_pinned_order_ck check (
    (pinned and pinned_order is not null) or
    (not pinned and pinned_order is null)
  ),
  -- completed_at tracks status so the activity log can order by it.
  constraint tasks_completed_at_ck check (
    (status = 'done' and completed_at is not null) or
    (status = 'open' and completed_at is null)
  )
);

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date);

-- Deliberately not unique: reordering pinned tasks rewrites several rows, and a
-- non-deferrable unique index would reject the intermediate state mid-shuffle.
-- The real invariant (at most 5) is enforced by the trigger below; duplicate
-- ordinals only ever cost a tie-break, which falls back to due date.
create index tasks_pinned_order_idx
  on public.tasks (user_id, pinned_order)
  where pinned;

-- Cap pinned tasks at 5 per user (Section 4: "up to 5 tasks can be pinned").
create or replace function public.enforce_pinned_task_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pinned_count integer;
begin
  if new.pinned then
    select count(*) into pinned_count
    from public.tasks
    where user_id = new.user_id
      and pinned
      and id <> new.id;

    if pinned_count >= 5 then
      raise exception 'You can pin at most 5 tasks at a time.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_pinned_limit
  before insert or update of pinned on public.tasks
  for each row execute function public.enforce_pinned_task_limit();

-- ---------------------------------------------------------------------------
-- focus_sessions
-- ---------------------------------------------------------------------------

create table public.focus_sessions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,
  started_at                timestamptz not null default now(),
  duration_minutes          numeric not null default 0 check (duration_minutes >= 0),
  planned_duration_minutes  integer not null check (planned_duration_minutes > 0),
  type                      focus_type not null default 'pomodoro',
  completed                 boolean not null default false,
  notes                     text,
  linked_task_id            uuid references public.tasks (id) on delete set null,
  life_area_id              uuid references public.life_areas (id) on delete set null,
  created_at                timestamptz not null default now()
);

create index focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- events
-- recurrence_rule uses the simple model decided in Section 9/10 — not RRULE:
--   {"freq":"daily",   "interval":1}
--   {"freq":"weekly",  "days":[2,4]}            -- 0=Sun .. 6=Sat
--   {"freq":"monthly", "day_of_month":15}
-- with an optional "until" ISO date on any of them.
-- ---------------------------------------------------------------------------

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null check (char_length(trim(title)) between 1 and 200),
  description     text,
  start_datetime  timestamptz not null,
  end_datetime    timestamptz not null,
  life_area_id    uuid references public.life_areas (id) on delete set null,
  linked_task_id  uuid references public.tasks (id) on delete set null,
  recurring       boolean not null default false,
  recurrence_rule jsonb,
  location        text,
  created_at      timestamptz not null default now(),

  constraint events_time_order_ck check (end_datetime >= start_datetime),
  constraint events_recurrence_ck check (
    (recurring and recurrence_rule is not null) or
    (not recurring and recurrence_rule is null)
  ),
  constraint events_recurrence_freq_ck check (
    recurrence_rule is null or
    recurrence_rule ->> 'freq' in ('daily', 'weekly', 'monthly')
  )
);

create index events_user_start_idx on public.events (user_id, start_datetime);
create index events_user_recurring_idx on public.events (user_id) where recurring;

-- ---------------------------------------------------------------------------
-- user_settings — one row per user, created by the signup trigger below.
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  habit_reminder_time     time,
  task_reminder_enabled   boolean not null default true,
  default_pomodoro_minutes integer not null default 25 check (default_pomodoro_minutes between 1 and 240),
  default_break_minutes    integer not null default 5  check (default_break_minutes between 1 and 120),
  accent                  text not null default 'purple' check (accent in ('red', 'purple', 'blue', 'white')),
  theme                   text not null default 'dark' check (theme in ('dark', 'light')),
  timezone                text not null default 'UTC',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- Broken out of the settings row (which the spec sketched as a single column)
-- so one account can be installed on several devices — each browser issues its
-- own endpoint, and a phone + laptop must both be able to receive reminders.
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Signup bootstrap: seed the default life areas (Section 3) and a settings row.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.life_areas (user_id, name, color, icon, sort_order)
  values
    (new.id, 'Personal / Health', '#22c55e', 'heart',     0),
    (new.id, 'School',            '#3b82f6', 'book-open', 1),
    (new.id, 'Job',               '#f59e0b', 'briefcase', 2),
    (new.id, 'Sport',             '#ef4444', 'dumbbell',  3);

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- activity_log — the unified feed (Section 4a). A view, not a table: every row
-- already lives somewhere else, and duplicating it would let the two drift.
-- security_invoker makes the underlying tables' RLS apply to the caller.
-- ---------------------------------------------------------------------------

create view public.activity_log
with (security_invoker = true) as
  select
    'habit'::text                       as kind,
    hl.id                               as id,
    hl.user_id                          as user_id,
    (hl.date + time '12:00')
      at time zone 'UTC'                as occurred_at,
    h.name                              as title,
    case
      when h.goal_type = 'numeric'
        then coalesce(hl.value, 0)::text || ' ' || coalesce(h.unit, '')
      else null
    end                                 as detail,
    h.life_area_id                      as life_area_id,
    hl.habit_id                         as source_id
  from public.habit_logs hl
  join public.habits h on h.id = hl.habit_id
  where hl.completed

  union all

  select
    'task'::text,
    t.id,
    t.user_id,
    t.completed_at,
    t.title,
    t.priority::text,
    t.life_area_id,
    t.id
  from public.tasks t
  where t.status = 'done' and t.completed_at is not null

  union all

  select
    'focus'::text,
    f.id,
    f.user_id,
    f.started_at,
    coalesce(t.title, 'Focus session'),
    round(f.duration_minutes)::text || ' min',
    f.life_area_id,
    f.id
  from public.focus_sessions f
  left join public.tasks t on t.id = f.linked_task_id
  where f.completed

  union all

  select
    'event'::text,
    e.id,
    e.user_id,
    e.start_datetime,
    e.title,
    e.location,
    e.life_area_id,
    e.id
  from public.events e
  where e.start_datetime <= now();

-- ---------------------------------------------------------------------------
-- Row Level Security — every table is owner-only.
-- ---------------------------------------------------------------------------

alter table public.life_areas         enable row level security;
alter table public.projects           enable row level security;
alter table public.habits             enable row level security;
alter table public.habit_logs         enable row level security;
alter table public.tasks              enable row level security;
alter table public.focus_sessions     enable row level security;
alter table public.events             enable row level security;
alter table public.user_settings      enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "own life_areas" on public.life_areas
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own projects" on public.projects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own habits" on public.habits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own habit_logs" on public.habit_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own focus_sessions" on public.focus_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own events" on public.events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own settings" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own push_subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Both functions above are trigger bodies and are never meant to be called
-- directly, but PostgREST exposes anything in `public` as an RPC endpoint by
-- default. Revoke EXECUTE so /rest/v1/rpc/... cannot reach them.
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_pinned_task_limit() from public, anon, authenticated;
