/**
 * Scheduled reminder dispatcher (Section 4: Notifications).
 *
 * Invoked on a cron — every 15 minutes is a good cadence — it finds users whose
 * reminder time falls in the current bucket, works out whether they actually
 * have anything outstanding, and pushes at most two notifications: one for
 * unlogged habits and one for due or overdue tasks. Users with nothing pending
 * are skipped, so the reminder keeps meaning something.
 *
 * Deploy:  supabase functions deploy send-reminders
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
 *
 * It runs with JWT verification off, because pg_cron has no user session to
 * present. A shared secret takes its place: without it the endpoint would be
 * an open notification trigger for anyone who learned the URL.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

/** Cron cadence. A reminder fires if its time falls inside the current window. */
const BUCKET_MINUTES = 15

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const CRON_SECRET = Deno.env.get('CRON_SECRET')

/**
 * Configured on first use, not at import time.
 *
 * `setVapidDetails` throws on missing or malformed keys. At module scope that
 * throw kills the worker before the handler runs, so a deploy with unset
 * secrets returned an opaque WORKER_ERROR 500 for every request — including
 * ones that should have been rejected as unauthorized. Deferring it means
 * misconfiguration reports itself instead.
 */
let vapidReady = false

function configureWebPush(): string | null {
  if (vapidReady) return null
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must both be set.'
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    vapidReady = true
    return null
  } catch (err) {
    return `Invalid VAPID configuration: ${(err as Error).message}`
  }
}

// Service role: this runs with no user session and must read across accounts.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

interface Payload {
  title: string
  body: string
  url: string
  tag: string
}

/** Local wall-clock date and minutes-since-midnight in an IANA timezone. */
function localNow(timezone: string): { date: string; minutes: number; weekday: number } {
  const now = new Date()
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(now)
  } catch {
    return localNow('UTC')
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: Math.max(0, weekdays.indexOf(get('weekday'))),
  }
}

function minutesOf(time: string): number {
  const [hours, mins] = time.split(':')
  return Number(hours) * 60 + Number(mins)
}

/** `yyyy-MM-dd` shifted by whole days, without touching timezones. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * When a task's reminder should fire, in the user's local wall clock.
 *
 * A task with no due time is "sometime that day", so there is no instant to
 * count backwards from — those anchor to 9am rather than midnight, which would
 * put a "30 minutes before" reminder at 11:30pm the night before.
 */
const DATELESS_ANCHOR_MINUTES = 9 * 60

function triggerFor(
  dueDate: string,
  dueTime: string | null,
  leadMinutes: number,
): { date: string; minutes: number } {
  const anchor = dueTime ? minutesOf(dueTime) : DATELESS_ANCHOR_MINUTES
  let minutes = anchor - leadMinutes
  let date = dueDate
  while (minutes < 0) {
    minutes += 1440
    date = shiftDate(date, -1)
  }
  return { date, minutes }
}

async function pushToUser(userId: string, payload: Payload): Promise<number> {
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (!subscriptions?.length) return 0

  let sent = 0
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      )
      sent += 1
    } catch (err) {
      // 404/410 mean the browser threw the subscription away — so should we,
      // otherwise dead endpoints accumulate forever.
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        console.error('push failed', sub.endpoint, err)
      }
    }
  }
  return sent
}

Deno.serve(async (req) => {
  // Constant-time-ish gate. Refusing when the secret is unset is deliberate:
  // a misconfigured deploy should be inert, not wide open.
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  // `?dry=1` reports who would be notified without sending anything, so the
  // wiring can be checked without waiting for a reminder window.
  const dryRun = new URL(req.url).searchParams.get('dry') === '1'

  const vapidError = configureWebPush()
  if (vapidError && !dryRun) {
    return new Response(JSON.stringify({ error: vapidError }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { data: settingsRows, error } = await admin
    .from('user_settings')
    .select('*')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  let notified = 0
  const inspected: unknown[] = []

  for (const settings of settingsRows ?? []) {
    const { date, minutes, weekday } = localNow(settings.timezone ?? 'UTC')

    const reminderAt = settings.habit_reminder_time
      ? minutesOf(settings.habit_reminder_time)
      : null
    const inBucket =
      reminderAt !== null &&
      minutes >= reminderAt &&
      minutes < reminderAt + BUCKET_MINUTES

    /* ------------------------------------------- per-task lead reminders -- */
    //
    // These are independent of the daily digest window: a task set to remind
    // 30 minutes before 2pm has nothing to do with the evening nudge, so this
    // pass runs on every invocation.

    let taskRemindersDue = 0

    if (settings.task_reminder_enabled) {
      const { data: pending } = await admin
        .from('tasks')
        .select('id, title, due_date, due_time, remind_minutes_before')
        .eq('user_id', settings.user_id)
        .eq('status', 'open')
        .not('remind_minutes_before', 'is', null)
        .is('reminded_at', null)
        .not('due_date', 'is', null)

      for (const task of pending ?? []) {
        const trigger = triggerFor(
          task.due_date as string,
          task.due_time as string | null,
          Number(task.remind_minutes_before),
        )

        const due =
          trigger.date < date ||
          (trigger.date === date && trigger.minutes <= minutes)
        if (!due) continue
        taskRemindersDue += 1

        // Anything more than a day late is stale — a reminder for something
        // that was due last week helps nobody. Stamp it so it stays quiet.
        const stale = trigger.date < shiftDate(date, -1)

        if (!stale && !dryRun) {
          notified += await pushToUser(settings.user_id, {
            title: task.due_time ? 'Coming up' : 'Due today',
            body: task.due_time
              ? `${task.title} at ${(task.due_time as string).slice(0, 5)}`
              : (task.title as string),
            url: '/tasks',
            // Per task, so two reminders don't collapse into one notification.
            tag: `lume-task-${task.id}`,
          })
        }

        if (!dryRun) {
          await admin
            .from('tasks')
            .update({ reminded_at: new Date().toISOString() })
            .eq('id', task.id)
        }
      }
    }

    if (dryRun) {
      const { count: subs } = await admin
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', settings.user_id)
      inspected.push({
        timezone: settings.timezone,
        local_date: date,
        local_minutes: minutes,
        reminder_at: reminderAt,
        in_bucket: inBucket,
        task_reminders_due_now: taskRemindersDue,
        subscriptions: subs ?? 0,
        vapid: vapidError ?? 'configured',
      })
      continue
    }

    if (!inBucket) continue

    /* --------------------------------------------------- unlogged habits -- */

    const { data: habits } = await admin
      .from('habits')
      .select('id, name, frequency_type, target_days, goal_type, goal_target')
      .eq('user_id', settings.user_id)
      .eq('archived', false)

    const dueToday = (habits ?? []).filter(
      (h) =>
        h.frequency_type !== 'weekly_days' ||
        (h.target_days as number[]).includes(weekday),
    )

    if (dueToday.length > 0) {
      const { data: logs } = await admin
        .from('habit_logs')
        .select('habit_id, completed, value')
        .eq('user_id', settings.user_id)
        .eq('date', date)

      const satisfied = new Set(
        (logs ?? [])
          .filter((log) => {
            const habit = dueToday.find((h) => h.id === log.habit_id)
            if (!habit) return false
            return habit.goal_type === 'numeric'
              ? Number(log.value ?? 0) >= Number(habit.goal_target ?? 0)
              : log.completed
          })
          .map((log) => log.habit_id),
      )

      const outstanding = dueToday.filter((h) => !satisfied.has(h.id))

      if (outstanding.length > 0) {
        notified += await pushToUser(settings.user_id, {
          title: 'Still open today',
          body:
            outstanding.length === 1
              ? `${outstanding[0].name} isn't logged yet.`
              : `${outstanding.length} habits aren't logged yet.`,
          url: '/',
          tag: 'lume-habits',
        })
      }
    }

    /* ------------------------------------------------ due / overdue tasks -- */

    if (settings.task_reminder_enabled) {
      const { data: tasks } = await admin
        .from('tasks')
        .select('id, title, due_date')
        .eq('user_id', settings.user_id)
        .eq('status', 'open')
        .not('due_date', 'is', null)
        .lte('due_date', date)

      if (tasks?.length) {
        const overdue = tasks.filter((t) => t.due_date < date).length
        notified += await pushToUser(settings.user_id, {
          title: overdue > 0 ? 'Overdue tasks' : 'Due today',
          body:
            tasks.length === 1
              ? tasks[0].title
              : `${tasks.length} tasks need attention${
                  overdue > 0 ? `, ${overdue} overdue` : ''
                }.`,
          url: '/tasks',
          tag: 'lume-tasks',
        })
      }
    }
  }

  return new Response(
    JSON.stringify(dryRun ? { dry_run: true, inspected } : { notified }),
    { headers: { 'content-type': 'application/json' } },
  )
})
