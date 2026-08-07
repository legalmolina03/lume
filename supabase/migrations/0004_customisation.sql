-- Task due times and per-task reminders -------------------------------------
--
-- due_date stays a date: most tasks are "sometime that day", and forcing a
-- time on them would be a lie. due_time is the optional refinement, and a
-- reminder only makes sense once a due date exists.

alter table public.tasks
  add column due_time time,
  add column remind_minutes_before integer
    check (remind_minutes_before is null or remind_minutes_before between 0 and 10080),
  -- Set when a reminder is delivered, so the dispatcher never sends twice.
  add column reminded_at timestamptz;

alter table public.tasks
  add constraint tasks_reminder_needs_due_date check (
    remind_minutes_before is null or due_date is not null
  );

create index tasks_reminder_idx
  on public.tasks (user_id, due_date)
  where status = 'open' and remind_minutes_before is not null and reminded_at is null;

-- Richer habits ---------------------------------------------------------------

alter table public.habits
  add column notes text,
  -- Per-habit reminder time, overriding the account-wide evening nudge.
  add column reminder_time time,
  -- How much one tap of + adds on a numeric habit. Counting 8 glasses one at a
  -- time is fine; logging 500 steps at a time is not.
  add column step numeric not null default 1 check (step > 0);

-- Customisable section order and dashboard preferences ------------------------

alter table public.user_settings
  add column section_order text[] not null
    default array['habits','tasks','focus','calendar','activity'],
  add column dashboard_task_sort text not null default 'due'
    check (dashboard_task_sort in ('due','priority')),
  -- Which layers the calendar draws.
  add column calendar_overlay text not null default 'both'
    check (calendar_overlay in ('events','tasks','both')),
  add column week_view_vertical boolean not null default true,
  -- Focus lock-down: hide everything but the timer during a session.
  add column focus_lockdown boolean not null default false;
